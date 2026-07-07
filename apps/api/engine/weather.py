"""KMA API Hub weather client.

The configured key is for apihub.kma.go.kr. This module keeps weather as a
public-data signal: it fetches a KMA short regional forecast and converts only
weather-risk phrases into conservative recommendation signals.
"""
from __future__ import annotations

import os
import re
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


KMA_API_HUB_ENDPOINT = "https://apihub.kma.go.kr/api/typ01/url/fct_shrt_reg.php"

SIGNAL_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("heavy_rain", ("호우", "많은 비", "강한 비", "폭우"), "호우 주의"),
    ("rain", ("비", "강수", "소나기"), "비 예보"),
    ("wind", ("강풍", "바람이 강", "매우 강하게", "돌풍"), "강풍 주의"),
    ("wave", ("풍랑", "물결이 높", "너울"), "풍랑 주의"),
    ("fog", ("안개", "가시거리"), "안개 주의"),
    ("heat", ("폭염", "무더위", "열대야"), "더위 주의"),
    ("snow", ("눈", "대설"), "눈 예보"),
)


def _service_key() -> tuple[str, str]:
    """Return configured KMA key and env name without exposing the value."""
    for name in ("KMA_SERVICE_KEY", "KMA_API_KEY", "WEATHER_API_KEY"):
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
            "기상청 API허브 응답은 확인했지만 여행자가 읽을 수 있는 문장형 예보가 없어 "
            "최신 예보 원문 확인이 필요합니다."
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
        labels = ["날씨 특이 신호 없음"] if text else ["예보 문장 확인 필요"]

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


def smoke_kma_nowcast(region: str = "jeju_city") -> dict[str, Any]:
    key, key_name = _service_key()
    if not key:
        return {
            "available": False,
            "reason": "KMA_SERVICE_KEY or KMA_API_KEY not set",
            "key_configured": False,
            "provider": "kma_api_hub",
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
        parsed["reason"] = "KMA API Hub returned an empty forecast body"
    return parsed
