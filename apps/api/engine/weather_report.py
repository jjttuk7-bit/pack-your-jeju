"""Travel-weather decision reporting from normalized KMA forecasts."""
from __future__ import annotations

from collections import Counter
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
