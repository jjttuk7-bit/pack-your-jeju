"""KMA weather smoke client.

This module is intentionally small: it only checks whether the configured
KMA/data.go.kr key can fetch Jeju ultra-short observations. It does not feed
weather into recommendations yet.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


KMA_ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"

REGION_GRID: dict[str, tuple[int, int]] = {
    "jeju_city": (52, 38),
    "seogwipo": (52, 33),
    "aewol": (48, 38),
    "hallim": (48, 38),
    "seongsan": (60, 37),
    "gujwa": (58, 38),
    "udo": (60, 38),
}


def _service_key() -> tuple[str, str]:
    """Return configured KMA key and env name without exposing the value."""
    for name in ("KMA_SERVICE_KEY", "KMA_API_KEY", "WEATHER_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value, name
    return "", ""


def _latest_ultra_srt_base(now: datetime | None = None) -> tuple[str, str]:
    """KMA ultra-short nowcast is hourly; use a conservative base time."""
    kst = timezone(timedelta(hours=9))
    current = now.astimezone(kst) if now else datetime.now(kst)
    if current.minute < 45:
        current = current - timedelta(hours=1)
    return current.strftime("%Y%m%d"), current.strftime("%H00")


def smoke_kma_nowcast(region: str = "jeju_city") -> dict[str, Any]:
    key, key_name = _service_key()
    if not key:
        return {
            "available": False,
            "reason": "KMA_SERVICE_KEY or KMA_API_KEY not set",
            "key_configured": False,
        }

    nx, ny = REGION_GRID.get(region, REGION_GRID["jeju_city"])
    base_date, base_time = _latest_ultra_srt_base()
    params = {
        "pageNo": "1",
        "numOfRows": "30",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
    }
    # Preserve already-encoded data.go.kr keys while encoding decoded keys.
    url = f"{KMA_ENDPOINT}?serviceKey={quote(key, safe='%')}&{urlencode(params)}"
    req = Request(url, headers={"User-Agent": "pack-your-jeju/0.1"})

    try:
        with urlopen(req, timeout=8) as resp:
            status = getattr(resp, "status", 200)
            raw = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return {
            "available": False,
            "reason": f"{type(e).__name__}: {e}",
            "key_configured": True,
            "key_env": key_name,
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        }

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "available": False,
            "reason": "KMA returned non-JSON response",
            "http_status": status,
            "key_configured": True,
            "key_env": key_name,
            "sample": raw[:180],
        }

    response = data.get("response") or {}
    header = response.get("header") or {}
    body = response.get("body") or {}
    items = (((body.get("items") or {}).get("item")) or [])
    return {
        "available": header.get("resultCode") == "00",
        "key_configured": True,
        "key_env": key_name,
        "http_status": status,
        "result_code": header.get("resultCode"),
        "result_msg": header.get("resultMsg"),
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
        "item_count": len(items),
        "sample_items": [
            {
                "category": it.get("category"),
                "value": it.get("obsrValue"),
                "base_date": it.get("baseDate"),
                "base_time": it.get("baseTime"),
            }
            for it in items[:8]
        ],
    }
