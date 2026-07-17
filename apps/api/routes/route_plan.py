from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from apps.api.engine.route_planner import (
    build_day_proposal,
    estimated_segment,
    route_plan_fingerprint,
)
from apps.api.engine.route_provider import RouteProvider


router = APIRouter(prefix="/route", tags=["route-plan"])


class RouteLocationBody(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=32.0, le=34.0)
    lng: float = Field(ge=125.0, le=128.0)


class RoutePlanItemBody(RouteLocationBody):
    id: str = Field(min_length=1, max_length=220)
    day: int = Field(ge=1, le=14)
    daypart: Literal["morning", "afternoon", "evening"]
    fixed: bool = False
    weather_status: str | None = Field(default=None, max_length=40)
    operating_check_required: bool = False


class RoutePlanBody(BaseModel):
    mode: Literal["driving", "transit", "walking"] = "driving"
    origin: RouteLocationBody
    destination: RouteLocationBody
    items: list[RoutePlanItemBody] = Field(min_length=1, max_length=24)
    dismissed_proposal_fingerprints: list[str] = Field(
        default_factory=list,
        max_length=100,
    )


@router.post("/plan")
def create_route_plan(body: RoutePlanBody) -> dict[str, Any]:
    provider = RouteProvider()
    items = [item.model_dump() for item in body.items]
    origin = body.origin.model_dump()
    destination = body.destination.model_dump()
    items_by_day: dict[int, list[dict[str, Any]]] = {}
    for item in items:
        items_by_day.setdefault(int(item["day"]), []).append(item)

    day_results: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    all_segments: list[dict[str, Any]] = []
    operations: list[dict[str, Any]] = []
    reasons: list[str] = []
    saved_duration_s = 0
    saved_distance_m = 0

    for day, day_items in sorted(items_by_day.items()):
        matrix, day_failures = _build_matrix(
            provider,
            day_items,
            origin=origin,
            destination=destination,
            mode=body.mode,
        )
        failures.extend(day_failures)
        all_segments.extend(dict(segment) for segment in matrix.values())
        result = build_day_proposal(
            day_items,
            matrix=matrix,
            mode=body.mode,
        )
        day_proposal = result.pop("proposal")
        if day_proposal:
            operations.extend(day_proposal["operations"])
            reasons.extend(day_proposal["reasons"])
            saved_duration_s += int(day_proposal["saved_duration_s"])
            saved_distance_m += int(day_proposal["saved_distance_m"])
        day_results.append({"day": day, **result})

    base_fingerprint = route_plan_fingerprint(
        items,
        mode=body.mode,
        origin=origin,
        destination=destination,
    )
    recommended_items = _recommended_items(items, day_results)
    recommended_fingerprint = route_plan_fingerprint(
        recommended_items,
        mode=body.mode,
        origin=origin,
        destination=destination,
    )
    proposal = None
    if operations and recommended_fingerprint not in set(body.dismissed_proposal_fingerprints):
        proposal = {
            "proposal_id": f"proposal-{recommended_fingerprint.removeprefix('route-')}",
            "fingerprint": recommended_fingerprint,
            "base_plan_fingerprint": base_fingerprint,
            "operations": operations,
            "saved_duration_s": saved_duration_s,
            "saved_distance_m": saved_distance_m,
            "reasons": list(dict.fromkeys(reasons)),
        }

    status = _overall_status(day_results)
    verified_segments = sum(
        1 for segment in all_segments if segment.get("status") == "verified_route"
    )
    estimated_segments = sum(
        1 for segment in all_segments if segment.get("status") == "estimated_route"
    )
    providers = sorted(
        {str(segment.get("provider")) for segment in all_segments if segment.get("provider")}
    )
    return {
        "status": status,
        "headline": (
            "이동 부담을 줄일 수 있는 동선을 제안합니다."
            if proposal
            else "현재 동선이 적절합니다."
        ),
        "partial": bool(failures) or status == "mixed_route",
        "days": day_results,
        "proposal": proposal,
        "provider_meta": {
            "providers": providers,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "verified_segments": verified_segments,
            "estimated_segments": estimated_segments,
            "failures": failures,
        },
    }


def _build_matrix(
    provider: RouteProvider,
    items: list[dict[str, Any]],
    *,
    origin: dict[str, Any],
    destination: dict[str, Any],
    mode: str,
) -> tuple[dict[tuple[str, str], dict[str, Any]], list[dict[str, str]]]:
    points: dict[str, dict[str, Any]] = {
        "origin": origin,
        **{str(item["id"]): item for item in items},
        "destination": destination,
    }
    pairs = [
        (start_id, goal_id)
        for start_id in points
        for goal_id in points
        if start_id != goal_id
    ]
    matrix: dict[tuple[str, str], dict[str, Any]] = {}
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=min(4, len(pairs))) as executor:
        futures = {
            executor.submit(
                provider.segment,
                points[start_id],
                points[goal_id],
                mode=mode,
            ): (start_id, goal_id)
            for start_id, goal_id in pairs
        }
        for future in as_completed(futures):
            start_id, goal_id = futures[future]
            try:
                segment = future.result()
            except Exception as exc:
                segment = estimated_segment(
                    points[start_id],
                    points[goal_id],
                    mode=mode,
                )
                reason = f"{type(exc).__name__}: {exc}"
                segment["fallback_reason"] = reason
                failures.append(
                    {"from_id": start_id, "to_id": goal_id, "reason": reason}
                )
            matrix[(start_id, goal_id)] = segment
    return matrix, failures


def _recommended_items(
    items: list[dict[str, Any]],
    day_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_id = {str(item["id"]): item for item in items}
    ordered: list[dict[str, Any]] = []
    for result in day_results:
        ordered.extend(by_id[item_id] for item_id in result["recommended_item_ids"])
    return ordered


def _overall_status(day_results: list[dict[str, Any]]) -> str:
    statuses = {str(result["recommended"]["status"]) for result in day_results}
    if statuses == {"verified_route"}:
        return "verified_route"
    if statuses == {"estimated_route"}:
        return "estimated_route"
    if statuses == {"unavailable"}:
        return "unavailable"
    return "mixed_route"
