from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.api.engine import weather as weather_mod
from apps.api.engine.weather_report import (
    aggregate_dayparts,
    build_weather_proposals,
    evaluate_itinerary_impact,
)


router = APIRouter(prefix="/weather", tags=["weather-report"])


class WeatherPlanItemBody(BaseModel):
    id: str = Field(min_length=1, max_length=220)
    name: str = Field(min_length=1, max_length=200)
    day: int = Field(ge=1, le=14)
    date: date
    daypart: Literal["morning", "afternoon", "evening"]
    start_time: str | None = Field(default=None, max_length=5)
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    region: str = Field(min_length=1, max_length=40)
    moment: str = Field(min_length=1, max_length=80)
    fixed: bool = False
    reservation_note: str | None = Field(default=None, max_length=300)


class WeatherReportBody(BaseModel):
    start_date: date
    days: int = Field(ge=1, le=14)
    regions: list[str] = Field(default_factory=list, max_length=12)
    items: list[WeatherPlanItemBody] = Field(default_factory=list, max_length=100)
    dismissed_proposal_fingerprints: list[str] = Field(
        default_factory=list,
        max_length=100,
    )


STATUS_RANK = {
    "unknown": 0,
    "suitable": 1,
    "prepare": 2,
    "adjust": 3,
    "official_check": 4,
}


def _headline(status: str, *, partial: bool) -> str:
    headlines = {
        "official_check": "이동편 공식 운항 확인이 필요한 일정이 있습니다.",
        "adjust": "날씨를 고려해 바꿔볼 일정을 제안합니다.",
        "prepare": "일정은 유지하되 비·바람 준비를 권합니다.",
        "suitable": "현재 예보에서는 일정 변경 신호가 없습니다.",
        "unknown": "확인 가능한 예보가 부족해 일정을 자동 판단하지 않습니다.",
    }
    headline = headlines[status]
    if partial:
        return f"{headline} 일부 지역 예보는 확인하지 못했습니다."
    return headline


def _distinct_regions(body: WeatherReportBody) -> list[str]:
    # 일정에 실제 포함된 지역만 조회해 외부 호출 수와 대기 시간을 제한한다.
    return list(dict.fromkeys(item.region for item in body.items))


def _fetch_regions(body: WeatherReportBody, regions: list[str]) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=min(3, len(regions))) as executor:
        futures = {
            executor.submit(
                weather_mod.smoke_kma_nowcast,
                region,
                target_start=body.start_date,
                target_days=body.days,
            ): region
            for region in regions
        }
        for future in as_completed(futures):
            region = futures[future]
            try:
                results[region] = future.result()
            except Exception as exc:  # upstream failure must not collapse other regions
                results[region] = {
                    "available": False,
                    "provider": "kma_vilage_fcst",
                    "reason": f"{type(exc).__name__}: {exc}",
                }
    return results


@router.post("/report")
def create_weather_report(body: WeatherReportBody) -> dict[str, Any]:
    if not body.items:
        raise HTTPException(status_code=400, detail="여행 일정이 한 개 이상 필요합니다.")

    regions = _distinct_regions(body)
    unknown_regions = [region for region in regions if region not in weather_mod.JEJU_GRID]
    if unknown_regions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 제주 지역입니다: {', '.join(unknown_regions)}",
        )

    snapshots = _fetch_regions(body, regions)
    available_regions = [
        region for region in regions if snapshots.get(region, {}).get("available")
    ]
    unavailable_regions = [region for region in regions if region not in available_regions]
    partial = bool(available_regions) and bool(unavailable_regions)

    periods: list[dict[str, Any]] = []
    period_lookup: dict[tuple[str, str, str], dict[str, Any]] = {}
    for region in available_regions:
        snapshot = snapshots[region]
        region_periods = aggregate_dayparts(
            region,
            list(snapshot.get("hourly_forecasts") or []),
        )
        for period in region_periods:
            period["source_issued_at"] = snapshot.get("source_issued_at")
            period["source_issued_at_label"] = snapshot.get("source_issued_at_label")
            period_lookup[(region, period["date"], period["daypart"])] = period
        periods.extend(region_periods)

    items = [item.model_dump(mode="json") for item in body.items]
    impacts: list[dict[str, Any]] = []
    for item in items:
        period = period_lookup.get(
            (item["region"], item["date"], item["daypart"]),
            {
                "region": item["region"],
                "date": item["date"],
                "daypart": item["daypart"],
                "available": False,
            },
        )
        impact = evaluate_itinerary_impact(item, period)
        impact["forecast_issued_at"] = period.get("source_issued_at")
        impacts.append(impact)

    proposals = build_weather_proposals(
        items,
        impacts,
        dismissed=set(body.dismissed_proposal_fingerprints),
    )
    if available_regions:
        status = max(
            (str(impact["status"]) for impact in impacts),
            key=lambda value: STATUS_RANK.get(value, 0),
        )
    else:
        status = "unknown"

    issues = [
        {
            "region": region,
            "source_issued_at": snapshots[region].get("source_issued_at"),
            "source_issued_at_label": snapshots[region].get("source_issued_at_label"),
        }
        for region in available_regions
    ]
    failures = [
        {
            "region": region,
            "reason": str(snapshots.get(region, {}).get("reason") or "forecast unavailable"),
        }
        for region in unavailable_regions
    ]
    return {
        "status": status,
        "headline": _headline(status, partial=partial),
        "periods": periods,
        "impacts": impacts,
        "proposals": proposals,
        "forecast_meta": {
            "provider": "kma_vilage_fcst",
            "requested_regions": regions,
            "available_regions": available_regions,
            "unavailable_regions": unavailable_regions,
            "partial": partial,
            "issues": issues,
            "failures": failures,
        },
    }
