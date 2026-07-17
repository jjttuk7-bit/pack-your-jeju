"""Travel-weather decision reporting from normalized KMA forecasts."""
from __future__ import annotations

from collections import Counter
import hashlib
from statistics import mean
from typing import Any


DAYPART_HOURS: dict[str, range] = {
    "morning": range(6, 12),
    "afternoon": range(12, 18),
    "evening": range(18, 24),
}
SKY_RANK = {"맑음": 0, "구름 많음": 1, "흐림": 2, "하늘상태 확인 중": 3}
PRECIPITATION_RANK = {
    "강수 없음": 0,
    "빗방울": 1,
    "빗방울/눈날림": 2,
    "소나기": 3,
    "비": 4,
    "비/눈": 5,
    "눈날림": 6,
    "눈": 7,
    "강수형태 확인 중": 8,
}
MOMENT_WEATHER_PROFILE = {
    "oreum": "outdoor_hike",
    "gotjawal": "outdoor_hike",
    "beach_walk": "coast",
    "sunset": "coast",
    "festival_event": "outdoor_event",
    "local_market": "outdoor_event",
    "culture_stop": "indoor",
    "quiet_cafe": "indoor",
    "local_food": "indoor",
    "souvenir_shopping": "indoor",
}
OUTDOOR_PROFILES = {"outdoor_hike", "coast", "outdoor_event"}
ACTUAL_PRECIPITATION = {
    "비",
    "비/눈",
    "눈",
    "소나기",
    "빗방울",
    "빗방울/눈날림",
    "눈날림",
}
WEATHER_POLICY_VERSION = "weather-travel-v1"


def _daypart_for_time(value: str) -> str | None:
    try:
        hour = int(value.split(":", 1)[0])
    except (AttributeError, TypeError, ValueError):
        return None
    return next((name for name, hours in DAYPART_HOURS.items() if hour in hours), None)


def _numbers(rows: list[dict[str, Any]], key: str) -> list[float]:
    return [float(row[key]) for row in rows if row.get(key) is not None]


def _representative_label(
    rows: list[dict[str, Any]],
    key: str,
    rank: dict[str, int],
    fallback: str,
) -> str:
    labels = [str(row[key]) for row in rows if row.get(key)]
    if not labels:
        return fallback
    counts = Counter(labels)
    return max(counts, key=lambda label: (counts[label], rank.get(label, -1)))


def aggregate_dayparts(region: str, hourly_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group normalized hourly forecasts into travel dayparts."""
    periods: list[dict[str, Any]] = []
    dates = sorted({str(row.get("date")) for row in hourly_rows if row.get("date")})
    for forecast_date in dates:
        day_rows = [row for row in hourly_rows if row.get("date") == forecast_date]
        for daypart in DAYPART_HOURS:
            rows = [row for row in day_rows if _daypart_for_time(str(row.get("time") or "")) == daypart]
            if not rows:
                periods.append(
                    {
                        "region": region,
                        "date": forecast_date,
                        "daypart": daypart,
                        "available": False,
                    }
                )
                continue

            probabilities = _numbers(rows, "precipitation_probability")
            temperatures = _numbers(rows, "temperature")
            winds = _numbers(rows, "wind_speed")
            humidities = _numbers(rows, "humidity")
            periods.append(
                {
                    "region": region,
                    "date": forecast_date,
                    "daypart": daypart,
                    "available": True,
                    "sky": _representative_label(
                        rows,
                        "sky",
                        SKY_RANK,
                        "하늘상태 확인 중",
                    ),
                    "precipitation_type": _representative_label(
                        rows,
                        "precipitation_type",
                        PRECIPITATION_RANK,
                        "강수형태 확인 중",
                    ),
                    "precipitation_probability_max": (
                        int(max(probabilities)) if probabilities else None
                    ),
                    "temperature_min": min(temperatures) if temperatures else None,
                    "temperature_max": max(temperatures) if temperatures else None,
                    "wind_speed_average": round(mean(winds), 1) if winds else None,
                    "wind_speed_max": max(winds) if winds else None,
                    "humidity_average": round(mean(humidities)) if humidities else None,
                }
            )
    return periods


def evaluate_itinerary_impact(
    item: dict[str, Any],
    period: dict[str, Any],
) -> dict[str, Any]:
    """Evaluate one itinerary item against its region/date/daypart forecast."""
    base = {
        "item_id": item.get("id"),
        "region": item.get("region"),
        "date": item.get("date"),
        "daypart": item.get("daypart"),
        "policy_version": WEATHER_POLICY_VERSION,
        "source_label": "기상청 예보 · 제주를 담다 여행 판단 기준",
    }
    if not period.get("available"):
        return {
            **base,
            "status": "unknown",
            "signals": [],
            "reason": "해당 지역·시간대의 예보가 없어 일정 영향을 판단하지 않습니다.",
        }

    profile = MOMENT_WEATHER_PROFILE.get(str(item.get("moment") or ""))
    if profile is None:
        return {
            **base,
            "status": "unknown",
            "signals": [],
            "reason": "장소 유형이 분류되지 않아 날씨 영향을 임의로 판단하지 않습니다.",
        }
    if profile == "indoor":
        return {
            **base,
            "profile": profile,
            "status": "suitable",
            "signals": [],
            "reason": "실내 일정은 현재 비·바람 예보만으로 변경을 권하지 않습니다.",
        }

    probability = float(period.get("precipitation_probability_max") or 0)
    wind_speed = float(period.get("wind_speed_max") or 0)
    precipitation_type = str(period.get("precipitation_type") or "")
    rain_signal = probability >= 40 or precipitation_type in ACTUAL_PRECIPITATION
    wind_signal = profile in OUTDOOR_PROFILES and wind_speed >= 4
    signals = [
        signal
        for signal, active in (("rain", rain_signal), ("wind", wind_signal))
        if active
    ]

    if item.get("region") == "udo" and wind_speed >= 9:
        status = "official_check"
        reason = "강한 바람 예보가 있어 우도 이동편의 공식 운항 공지를 확인해야 합니다."
    elif probability >= 70 or precipitation_type in ACTUAL_PRECIPITATION or wind_speed >= 9:
        status = "adjust"
        reason = "비 또는 강한 바람이 야외 일정에 영향을 줄 수 있어 시간 조정을 권합니다."
    elif signals:
        status = "prepare"
        reason = "비나 바람에 대비한 준비와 이동 여유를 권합니다."
    else:
        status = "suitable"
        reason = "현재 확인된 예보에서는 일정 변경이 필요한 신호가 없습니다."

    return {
        **base,
        "profile": profile,
        "status": status,
        "signals": signals,
        "reason": reason,
    }


def _proposal_fingerprint(
    impact: dict[str, Any],
    risky_item: dict[str, Any],
    alternative_item: dict[str, Any],
) -> str:
    parts = (
        WEATHER_POLICY_VERSION,
        str(impact.get("forecast_issued_at") or "unknown"),
        str(risky_item.get("id")),
        str(alternative_item.get("id")),
        str(risky_item.get("daypart")),
        str(alternative_item.get("daypart")),
        "swap_daypart",
    )
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def build_weather_proposals(
    items: list[dict[str, Any]],
    impacts: list[dict[str, Any]],
    dismissed: set[str],
) -> list[dict[str, Any]]:
    """Build deterministic, user-approved swaps without moving fixed items."""
    items_by_id = {str(item.get("id")): item for item in items if item.get("id")}
    proposals: list[dict[str, Any]] = []

    for impact in impacts:
        if impact.get("status") != "adjust":
            continue
        risky_item = items_by_id.get(str(impact.get("item_id")))
        if not risky_item or risky_item.get("fixed"):
            continue

        alternative_item = next(
            (
                item
                for item in items
                if item.get("id") != risky_item.get("id")
                and item.get("date") == risky_item.get("date")
                and item.get("region") == risky_item.get("region")
                and item.get("daypart") != risky_item.get("daypart")
                and not item.get("fixed")
                and MOMENT_WEATHER_PROFILE.get(str(item.get("moment") or "")) == "indoor"
            ),
            None,
        )
        if alternative_item is None:
            continue

        fingerprint = _proposal_fingerprint(impact, risky_item, alternative_item)
        if fingerprint in dismissed:
            continue

        proposals.append(
            {
                "proposal_id": f"weather-{fingerprint}",
                "fingerprint": fingerprint,
                "severity": "adjust",
                "reason": impact.get("reason"),
                "signals": list(impact.get("signals") or []),
                "operations": [
                    {
                        "type": "swap_daypart",
                        "item_ids": [risky_item["id"], alternative_item["id"]],
                    }
                ],
                "affected_item_ids": [risky_item["id"], alternative_item["id"]],
                "requires_recalculation": False,
            }
        )

    return proposals
