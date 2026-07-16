"""KMA weather clients.

Weather is a public-data signal. Prefer the data.go.kr KMA VilageFcst
structured forecast, then fall back to the legacy KMA API Hub text probe.
"""
from __future__ import annotations

import json
import os
import re
from datetime import date
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


KMA_API_HUB_ENDPOINT = "https://apihub.kma.go.kr/api/typ01/url/fct_shrt_reg.php"
KMA_VILAGE_FCST_ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
KST = timezone(timedelta(hours=9))

JEJU_GRID: dict[str, tuple[int, int]] = {
    "jeju_city": (53, 38),
    "seogwipo": (52, 33),
    "aewol": (49, 38),
    "hallim": (48, 38),
    "seongsan": (60, 37),
    "jocheon": (55, 38),
    "gujwa": (59, 38),
    "andeok": (49, 32),
    "daejeong": (48, 32),
    "pyoseon": (56, 33),
    "namwon": (54, 33),
    "udo": (60, 38),
}

SKY_LABELS = {"1": "맑음", "3": "구름 많음", "4": "흐림"}
PTY_LABELS = {
    "0": "강수 없음",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
    "5": "빗방울",
    "6": "빗방울/눈날림",
    "7": "눈날림",
}

SIGNAL_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("heavy_rain", ("호우", "많은 비", "강한 비", "폭우"), "호우 주의"),
    ("rain", ("비", "강수", "소나기"), "비 예보"),
    ("wind", ("강풍", "바람이 강", "매우 강하게", "돌풍"), "강풍 주의"),
    ("wave", ("풍랑", "물결이 높", "너울"), "풍랑 주의"),
    ("fog", ("안개", "가시거리"), "안개 주의"),
    ("heat", ("폭염", "무더위", "열대야"), "더위 주의"),
    ("snow", ("눈", "대설"), "눈 예보"),
)


def _api_hub_service_key() -> tuple[str, str]:
    """Return configured legacy KMA API Hub key and env name without exposing it."""
    for name in ("KMA_SERVICE_KEY", "KMA_API_KEY", "WEATHER_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value, name
    return "", ""


def _vilage_fcst_service_key() -> tuple[str, str]:
    """Return configured data.go.kr VilageFcst key and env name without exposing it."""
    for name in ("DATA_GO_KR_SERVICE_KEY", "KMA_VILAGE_FCST_KEY", "VILAGE_FCST_SERVICE_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value, name
    return "", ""


def _decode_kma_body(raw: bytes) -> str:
    for encoding in ("utf-8", "cp949", "euc-kr"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _clean_forecast_text(raw_text: str) -> str:
    lines: list[str] = []
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith(("7777", "====", "----")):
            continue
        if _is_machine_code_row(stripped):
            continue
        lines.append(stripped)
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def _is_machine_code_row(line: str) -> bool:
    tokens = line.split()
    if len(tokens) < 5:
        return False
    digit_chars = sum(1 for ch in line if ch.isdigit())
    compact_chars = sum(1 for ch in line if not ch.isspace())
    digit_ratio = digit_chars / max(compact_chars, 1)
    long_number_tokens = sum(1 for token in tokens if re.fullmatch(r"\d{8,12}", token))
    region_code_tokens = sum(1 for token in tokens if re.fullmatch(r"\d{2}[A-Z]\d{5}", token))
    return digit_ratio > 0.45 and (long_number_tokens >= 2 or region_code_tokens >= 1)


def _issued_at_label(raw_text: str) -> str | None:
    patterns = (
        r"발표시각\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시",
        r"발표\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시",
    )
    for pattern in patterns:
        match = re.search(pattern, raw_text)
        if match:
            year, month, day, hour = match.groups()
            return f"{int(year)}년 {int(month)}월 {int(day)}일 {int(hour):02d}시 발표"
    return None


def _forecast_summary(text: str) -> str:
    if not text:
        return (
            "기상청 API 연결은 확인됐지만 현재 응답에서 비·바람·풍랑 같은 여행 판단 문장을 "
            "읽어낼 수 없습니다. 야외 일정은 출발 전 최신 예보를 한 번 더 확인해 주세요."
        )
    sentences = re.split(r"(?<=[.!?。])\s+|(?<=다\.)\s*", text)
    candidates = [s.strip() for s in sentences if s.strip()]
    if not candidates:
        return text[:180]
    return " ".join(candidates[:2])[:240]


def parse_kma_api_hub_forecast(raw_text: str) -> dict[str, Any]:
    """Normalize KMA API Hub short forecast text into weather signals."""
    text = _clean_forecast_text(raw_text)
    issued_at_label = _issued_at_label(raw_text)
    signals: list[str] = []
    labels: list[str] = []
    for signal, keywords, label in SIGNAL_RULES:
        if any(keyword in text for keyword in keywords):
            signals.append(signal)
            labels.append(label)

    if not labels:
        labels = ["날씨 특이 신호 없음"] if text else ["날씨 판단 보류"]

    severe = {"heavy_rain", "wind", "wave", "fog", "heat", "snow"}
    risk_level = "caution" if any(signal in severe for signal in signals) else (
        "watch" if signals else "normal"
    )
    result = {
        "available": bool(text),
        "provider": "kma_api_hub",
        "risk_level": risk_level,
        "signals": signals,
        "labels": labels,
        "summary": _forecast_summary(text),
        "raw_length": len(raw_text),
    }
    if issued_at_label:
        result["issued_at_label"] = issued_at_label
    return result


def _vilage_base_datetime(now: datetime | None = None) -> tuple[str, str]:
    """Return latest KMA VilageFcst base_date/base_time.

    KMA short-term forecast base times are every three hours. Use a one-hour
    buffer so the latest slot is normally published before we query it.
    """
    current = (now or datetime.now(KST)).astimezone(KST) - timedelta(hours=1)
    base_hours = (2, 5, 8, 11, 14, 17, 20, 23)
    hour = max((h for h in base_hours if h <= current.hour), default=23)
    base_day = current
    if current.hour < 2:
        base_day = current - timedelta(days=1)
    return base_day.strftime("%Y%m%d"), f"{hour:02d}00"


def _source_issue_metadata(base_date: str, base_time: str) -> dict[str, str]:
    """Expose the KMA source cycle separately from a forecast target hour."""
    issued_at = datetime.strptime(
        f"{base_date}{base_time}",
        "%Y%m%d%H%M",
    ).replace(tzinfo=KST)
    return {
        "source_issued_at": issued_at.isoformat(),
        "source_issued_at_label": (
            f"{issued_at.year}년 {issued_at.month}월 {issued_at.day}일 "
            f"{issued_at.hour:02d}시 발표"
        ),
    }


def _first_forecast_values(
    items: list[dict[str, Any]],
    *,
    target_start: date | None = None,
    target_days: int = 1,
    now: datetime | None = None,
) -> dict[str, str]:
    current_key = (now or datetime.now(KST)).astimezone(KST).strftime("%Y%m%d%H%M")
    target_dates: set[str] = set()
    if target_start:
        days = max(1, min(target_days, 3))
        target_dates = {
            (target_start + timedelta(days=idx)).strftime("%Y%m%d")
            for idx in range(days)
        }
    by_time: dict[str, dict[str, str]] = {}
    for item in items:
        fcst_date = str(item.get("fcstDate") or "")
        fcst_time = str(item.get("fcstTime") or "")
        category = str(item.get("category") or "")
        value = str(item.get("fcstValue") or "")
        if not fcst_date or not fcst_time or not category:
            continue
        if target_dates and fcst_date not in target_dates:
            continue
        key = f"{fcst_date}{fcst_time}"
        if key < current_key:
            continue
        by_time.setdefault(key, {})[category] = value
    if not by_time:
        return {}
    def sort_key(pair: tuple[str, dict[str, str]]) -> tuple[int, int, str]:
        key, values = pair
        hour = int(key[8:10])
        noon_distance = abs(hour - 12)
        return (-len(values), noon_distance, key)

    preferred = sorted(by_time.items(), key=sort_key)[0]
    values = dict(preferred[1])
    values["fcstDate"] = preferred[0][:8]
    values["fcstTime"] = preferred[0][8:]
    return values


def _forecast_values_by_day(
    items: list[dict[str, Any]],
    *,
    target_start: date | None = None,
    target_days: int = 1,
    now: datetime | None = None,
) -> list[dict[str, str]]:
    if not target_start:
        values = _first_forecast_values(items, now=now)
        return [values] if values else []

    days = max(1, min(target_days, 3))
    forecasts: list[dict[str, str]] = []
    for idx in range(days):
        target_day = target_start + timedelta(days=idx)
        values = _first_forecast_values(
            items,
            target_start=target_day,
            target_days=1,
            now=now,
        )
        if values:
            forecasts.append(values)
    return forecasts


def _hourly_forecasts(
    items: list[dict[str, Any]],
    *,
    target_start: date | None = None,
    target_days: int = 1,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Preserve public hourly values for travel-day decision reporting."""
    current_key = (now or datetime.now(KST)).astimezone(KST).strftime("%Y%m%d%H%M")
    target_dates: set[str] = set()
    if target_start:
        days = max(1, min(target_days, 3))
        target_dates = {
            (target_start + timedelta(days=idx)).strftime("%Y%m%d")
            for idx in range(days)
        }

    by_time: dict[str, dict[str, str]] = {}
    for item in items:
        fcst_date = str(item.get("fcstDate") or "")
        fcst_time = str(item.get("fcstTime") or "")
        category = str(item.get("category") or "")
        value = str(item.get("fcstValue") or "")
        if not fcst_date or not fcst_time or not category:
            continue
        if target_dates and fcst_date not in target_dates:
            continue
        key = f"{fcst_date}{fcst_time}"
        if key < current_key:
            continue
        by_time.setdefault(key, {})[category] = value

    forecasts: list[dict[str, Any]] = []
    for key, values in sorted(by_time.items()):
        if not any(category in values for category in ("SKY", "PTY", "POP", "TMP", "WSD", "REH")):
            continue
        pop = _safe_float(values.get("POP"))
        tmp = _safe_float(values.get("TMP"))
        wind = _safe_float(values.get("WSD"))
        humidity = _safe_float(values.get("REH"))
        forecasts.append(
            {
                "date": f"{key[:4]}-{key[4:6]}-{key[6:8]}",
                "time": f"{key[8:10]}:{key[10:12]}",
                "sky": SKY_LABELS.get(values.get("SKY", ""), "하늘상태 확인 중"),
                "precipitation_type": PTY_LABELS.get(
                    values.get("PTY", ""),
                    "강수형태 확인 중",
                ),
                "precipitation_probability": int(pop) if pop is not None else None,
                "temperature": tmp,
                "wind_speed": wind,
                "humidity": int(humidity) if humidity is not None else None,
            }
        )
    return forecasts


def _safe_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _risk_rank(risk_level: str) -> int:
    return {"normal": 0, "watch": 1, "caution": 2}.get(risk_level, 1)


def _snapshot_from_values(values: dict[str, str], *, region: str) -> dict[str, Any]:
    sky = SKY_LABELS.get(values.get("SKY", ""), "하늘상태 확인 중")
    pty = PTY_LABELS.get(values.get("PTY", ""), "강수형태 확인 중")
    pop = _safe_float(values.get("POP"))
    tmp = _safe_float(values.get("TMP"))
    wsd = _safe_float(values.get("WSD"))
    reh = _safe_float(values.get("REH"))

    signals: list[str] = []
    labels: list[str] = [sky]
    if values.get("PTY") and values.get("PTY") != "0":
        signals.append("rain" if values.get("PTY") in {"1", "4", "5"} else "snow")
        labels.append(f"{pty} 예보")
    if pop is not None and pop >= 60:
        signals.append("rain")
        labels.append("강수확률 높음")
    if wsd is not None and wsd >= 9:
        signals.append("wind")
        labels.append("강풍 주의")
    elif wsd is not None and wsd >= 4:
        labels.append("바람 확인")

    severe = {"wind", "snow"}
    risk_level = "caution" if any(signal in severe for signal in signals) or (pop or 0) >= 70 else (
        "watch" if signals or (wsd or 0) >= 4 or (pop or 0) >= 40 else "normal"
    )
    fcst_date = values["fcstDate"]
    fcst_time = values["fcstTime"]
    issued_at_label = f"{int(fcst_date[4:6])}월 {int(fcst_date[6:8])}일 {int(fcst_time[:2]):02d}시 예보"
    date_label = f"{int(fcst_date[4:6])}월 {int(fcst_date[6:8])}일"
    detail_parts = [sky]
    if values.get("PTY") and values.get("PTY") != "0":
        detail_parts.append(pty)
    if pop is not None:
        detail_parts.append(f"강수확률 {int(pop)}%")
    if tmp is not None:
        detail_parts.append(f"기온 {tmp:g}도")
    if wsd is not None:
        detail_parts.append(f"풍속 {wsd:g}m/s")
    if reh is not None:
        detail_parts.append(f"습도 {int(reh)}%")

    return {
        "available": True,
        "provider": "kma_vilage_fcst",
        "risk_level": risk_level,
        "signals": sorted(set(signals)),
        "labels": list(dict.fromkeys(labels)),
        "summary": f"{issued_at_label} 기준: " + " · ".join(detail_parts),
        "issued_at_label": issued_at_label,
        "date": f"{fcst_date[:4]}-{fcst_date[4:6]}-{fcst_date[6:8]}",
        "date_label": date_label,
        "region": region,
        "forecast": {
            "sky": sky,
            "precipitation_type": pty,
            "precipitation_probability": int(pop) if pop is not None else None,
            "temperature": tmp,
            "wind_speed": wsd,
            "humidity": int(reh) if reh is not None else None,
            "fcst_date": fcst_date,
            "fcst_time": fcst_time,
        },
    }


def parse_vilage_fcst_payload(
    payload: dict[str, Any],
    *,
    region: str = "jeju_city",
    target_start: date | None = None,
    target_days: int = 1,
) -> dict[str, Any]:
    """Normalize data.go.kr getVilageFcst JSON into travel weather signals."""
    response = payload.get("response") or {}
    header = response.get("header") or {}
    result_code = str(header.get("resultCode") or "")
    if result_code and result_code != "00":
        return {
            "available": False,
            "provider": "kma_vilage_fcst",
            "reason": str(header.get("resultMsg") or f"resultCode={result_code}"),
            "labels": ["날씨 판단 보류"],
            "summary": "기상청 단기예보 응답을 받았지만 정상 예보 데이터가 아닙니다. 출발 전 최신 예보를 확인해 주세요.",
        }

    items = (((response.get("body") or {}).get("items") or {}).get("item") or [])
    if not isinstance(items, list):
        items = [items]
    daily_forecasts = [
        _snapshot_from_values(values, region=region)
        for values in _forecast_values_by_day(
            items,
            target_start=target_start,
            target_days=target_days,
        )
    ]
    hourly_forecasts = _hourly_forecasts(
        items,
        target_start=target_start,
        target_days=target_days,
    )
    if not daily_forecasts:
        target_label = f"{target_start.isoformat()}부터 {target_days}일" if target_start else "현재 이후"
        return {
            "available": False,
            "provider": "kma_vilage_fcst",
            "reason": "no future forecast items",
            "labels": ["날씨 판단 보류"],
            "summary": f"기상청 단기예보에서 {target_label}에 해당하는 예보를 찾지 못했습니다. 출발 전 최신 예보를 확인해 주세요.",
        }

    primary = daily_forecasts[0]
    labels = list(dict.fromkeys(label for day in daily_forecasts for label in (day.get("labels") or [])))
    signals = sorted(set(signal for day in daily_forecasts for signal in (day.get("signals") or [])))
    risk_level = max((str(day.get("risk_level") or "normal") for day in daily_forecasts), key=_risk_rank)
    if target_start:
        summary_parts = []
        for day in daily_forecasts:
            forecast = day["forecast"]
            parts = [str(forecast.get("sky") or "날씨 확인 중")]
            if forecast.get("precipitation_type") and forecast.get("precipitation_type") != "강수 없음":
                parts.append(str(forecast["precipitation_type"]))
            if forecast.get("precipitation_probability") is not None:
                parts.append(f"강수확률 {forecast['precipitation_probability']}%")
            if forecast.get("temperature") is not None:
                parts.append(f"기온 {forecast['temperature']:g}도")
            summary_parts.append(f"{day['issued_at_label']} " + " · ".join(parts))
        summary = "여행 기간 예보: " + " / ".join(summary_parts)
    else:
        summary = str(primary.get("summary") or "")
    return {
        "available": True,
        "provider": "kma_vilage_fcst",
        "risk_level": risk_level,
        "signals": signals,
        "labels": labels,
        "summary": summary,
        "issued_at_label": primary.get("issued_at_label"),
        "region": region,
        "forecast": primary.get("forecast"),
        "daily_forecasts": daily_forecasts,
        "hourly_forecasts": hourly_forecasts,
    }


def _build_vilage_url(
    key: str,
    *,
    region: str,
    base_date: str | None = None,
    base_time: str | None = None,
) -> str:
    if base_date is None or base_time is None:
        base_date, base_time = _vilage_base_datetime()
    nx, ny = JEJU_GRID.get(region, JEJU_GRID["jeju_city"])
    params = {
        "pageNo": "1",
        "numOfRows": "1000",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
    }
    query = urlencode(params, quote_via=quote)
    return f"{KMA_VILAGE_FCST_ENDPOINT}?serviceKey={quote(key, safe='%')}&{query}"


def _fetch_vilage_fcst(
    region: str,
    key: str,
    key_name: str,
    *,
    target_start: date | None = None,
    target_days: int = 1,
) -> dict[str, Any]:
    base_date, base_time = _vilage_base_datetime()
    url = _build_vilage_url(
        key,
        region=region,
        base_date=base_date,
        base_time=base_time,
    )
    req = Request(url, headers={"User-Agent": "pack-your-jeju/0.1"})
    try:
        with urlopen(req, timeout=8) as resp:
            status = getattr(resp, "status", 200)
            raw = resp.read()
    except HTTPError as e:
        body = _decode_kma_body(e.read())
        return {
            "available": False,
            "reason": f"HTTPError: HTTP Error {e.code}: {e.reason}",
            "http_status": e.code,
            "key_configured": True,
            "key_env": key_name,
            "provider": "kma_vilage_fcst",
            "error_sample": body[:240],
        }
    except Exception as e:
        return {
            "available": False,
            "reason": f"{type(e).__name__}: {e}",
            "key_configured": True,
            "key_env": key_name,
            "provider": "kma_vilage_fcst",
        }
    try:
        payload = json.loads(_decode_kma_body(raw))
    except json.JSONDecodeError:
        return {
            "available": False,
            "reason": "KMA VilageFcst returned non-JSON body",
            "http_status": status,
            "key_configured": True,
            "key_env": key_name,
            "provider": "kma_vilage_fcst",
            "error_sample": _decode_kma_body(raw)[:240],
        }
    parsed = parse_vilage_fcst_payload(
        payload,
        region=region,
        target_start=target_start,
        target_days=target_days,
    )
    parsed.update(
        {
            "key_configured": True,
            "key_env": key_name,
            "http_status": status,
            "source": "data.go.kr getVilageFcst",
            **_source_issue_metadata(base_date, base_time),
        }
    )
    return parsed


def smoke_kma_nowcast(
    region: str = "jeju_city",
    *,
    target_start: date | None = None,
    target_days: int = 1,
) -> dict[str, Any]:
    key, key_name = _vilage_fcst_service_key()
    if key:
        return _fetch_vilage_fcst(
            region,
            key,
            key_name,
            target_start=target_start,
            target_days=target_days,
        )

    key, key_name = _api_hub_service_key()
    if not key:
        return {
            "available": False,
            "reason": "DATA_GO_KR_SERVICE_KEY not set",
            "key_configured": False,
            "provider": "kma_vilage_fcst",
        }

    params = {
        "tmfc": "0",
        "authKey": key,
    }
    url = f"{KMA_API_HUB_ENDPOINT}?{urlencode(params, quote_via=quote)}"
    req = Request(url, headers={"User-Agent": "pack-your-jeju/0.1"})

    try:
        with urlopen(req, timeout=8) as resp:
            status = getattr(resp, "status", 200)
            raw = resp.read()
    except HTTPError as e:
        body = _decode_kma_body(e.read())
        return {
            "available": False,
            "reason": f"HTTPError: HTTP Error {e.code}: {e.reason}",
            "http_status": e.code,
            "key_configured": True,
            "key_env": key_name,
            "provider": "kma_api_hub",
            "error_sample": body[:240],
        }
    except Exception as e:
        return {
            "available": False,
            "reason": f"{type(e).__name__}: {e}",
            "key_configured": True,
            "key_env": key_name,
            "provider": "kma_api_hub",
        }

    text = _decode_kma_body(raw)
    parsed = parse_kma_api_hub_forecast(text)
    parsed.update(
        {
            "key_configured": True,
            "key_env": key_name,
            "http_status": status,
            "region": region,
            "source": "apihub.kma.go.kr fct_shrt_reg.php",
        }
    )
    if not parsed["available"]:
        parsed["reason"] = "KMA API Hub returned non-narrative forecast rows"
    return parsed
