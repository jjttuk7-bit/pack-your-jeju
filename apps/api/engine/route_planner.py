from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Literal, Mapping, Sequence


RouteMode = Literal["driving", "transit", "walking"]
RouteStatus = Literal[
    "verified_route",
    "estimated_route",
    "mixed_route",
    "unavailable",
]

POLICY_VERSION = "route-travel-v1"
MODE_SPEED_KMH: dict[RouteMode, float] = {
    "driving": 38.0,
    "transit": 24.0,
    "walking": 4.5,
}
MODE_DISTANCE_FACTOR: dict[RouteMode, float] = {
    "driving": 1.28,
    "transit": 1.40,
    "walking": 1.15,
}


def haversine_meters(
    start: Mapping[str, float],
    goal: Mapping[str, float],
) -> int:
    """Return the great-circle distance between two WGS84 points in meters."""

    start_lat = math.radians(float(start["lat"]))
    goal_lat = math.radians(float(goal["lat"]))
    lat_delta = goal_lat - start_lat
    lng_delta = math.radians(float(goal["lng"]) - float(start["lng"]))
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(start_lat) * math.cos(goal_lat) * math.sin(lng_delta / 2) ** 2
    )
    distance = 2 * 6_371_000 * math.asin(min(1.0, math.sqrt(haversine)))
    return int(round(distance))


def estimated_segment(
    start: Mapping[str, float],
    goal: Mapping[str, float],
    *,
    mode: RouteMode,
) -> dict[str, Any]:
    """Build an explicit service-policy estimate, never an official route claim."""

    direct_distance = haversine_meters(start, goal)
    distance_m = int(round(direct_distance * MODE_DISTANCE_FACTOR[mode]))
    speed_mps = MODE_SPEED_KMH[mode] * 1_000 / 3_600
    duration_s = int(round(distance_m / speed_mps)) if distance_m else 0
    return {
        "distance_m": distance_m,
        "duration_s": duration_s,
        "status": "estimated_route",
        "provider": POLICY_VERSION,
        "policy_version": POLICY_VERSION,
        "geometry": [
            {"lat": float(start["lat"]), "lng": float(start["lng"])},
            {"lat": float(goal["lat"]), "lng": float(goal["lng"])},
        ],
    }


def route_plan_fingerprint(
    items: Sequence[Mapping[str, Any]],
    *,
    mode: RouteMode,
    origin: Mapping[str, Any] | None = None,
    destination: Mapping[str, Any] | None = None,
) -> str:
    payload = {
        "mode": mode,
        "origin": _fingerprint_location(origin),
        "destination": _fingerprint_location(destination),
        "items": [
            {
                "id": item.get("id"),
                "day": item.get("day"),
                "fixed": bool(item.get("fixed", False)),
                "lat": item.get("lat"),
                "lng": item.get("lng"),
            }
            for item in items
        ],
    }
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return f"route-{hashlib.sha256(encoded).hexdigest()[:16]}"


def _fingerprint_location(location: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if location is None:
        return None
    return {
        "lat": location.get("lat"),
        "lng": location.get("lng"),
    }


def build_day_proposal(
    items: Sequence[Mapping[str, Any]],
    *,
    matrix: Mapping[tuple[str, str], Mapping[str, Any]],
    origin_id: str = "origin",
    destination_id: str = "destination",
    mode: RouteMode = "driving",
) -> dict[str, Any]:
    if not items:
        raise ValueError("하루 일정이 한 개 이상 필요합니다.")
    days = {int(item["day"]) for item in items}
    if len(days) != 1:
        raise ValueError("같은 Day의 일정만 동선으로 계산할 수 있습니다.")

    current_ids = [str(item["id"]) for item in items]
    recommended_ids = list(current_ids)
    fixed_indexes = [
        index for index, item in enumerate(items) if bool(item.get("fixed", False))
    ]
    boundaries = [-1, *fixed_indexes, len(items)]
    original_position = {item_id: index for index, item_id in enumerate(current_ids)}

    for boundary_index in range(len(boundaries) - 1):
        left = boundaries[boundary_index]
        right = boundaries[boundary_index + 1]
        movable = current_ids[left + 1 : right]
        if len(movable) < 2:
            continue
        previous_id = origin_id if left == -1 else current_ids[left]
        next_id = destination_id if right == len(items) else current_ids[right]
        recommended_ids[left + 1 : right] = _optimize_span(
            movable,
            previous_id=previous_id,
            next_id=next_id,
            matrix=matrix,
            original_position=original_position,
        )

    current = _summarize_route(
        current_ids,
        matrix=matrix,
        origin_id=origin_id,
        destination_id=destination_id,
    )
    recommended = _summarize_route(
        recommended_ids,
        matrix=matrix,
        origin_id=origin_id,
        destination_id=destination_id,
    )
    saved_seconds = current["total_duration_s"] - recommended["total_duration_s"]
    saved_distance = current["total_distance_m"] - recommended["total_distance_m"]
    minimum_improvement = max(600, int(current["total_duration_s"] * 0.1))
    proposal = None
    headline = "현재 동선이 적절합니다."
    if recommended_ids != current_ids and saved_seconds >= minimum_improvement:
        day = next(iter(days))
        ordered_items = [
            next(item for item in items if str(item["id"]) == item_id)
            for item_id in recommended_ids
        ]
        base_fingerprint = route_plan_fingerprint(items, mode=mode)
        proposal_fingerprint = route_plan_fingerprint(ordered_items, mode=mode)
        proposal = {
            "proposal_id": f"proposal-{proposal_fingerprint.removeprefix('route-')}",
            "fingerprint": proposal_fingerprint,
            "base_plan_fingerprint": base_fingerprint,
            "operations": [
                {
                    "type": "reorder_day_items",
                    "day": day,
                    "ordered_item_ids": recommended_ids,
                }
            ],
            "saved_duration_s": saved_seconds,
            "saved_distance_m": saved_distance,
            "reasons": [f"예상 이동시간을 {saved_seconds // 60}분 줄이는 순서입니다."],
        }
        headline = "이동 부담을 줄일 수 있는 동선을 제안합니다."

    return {
        "headline": headline,
        "current_item_ids": current_ids,
        "recommended_item_ids": recommended_ids,
        "current": current,
        "recommended": recommended,
        "proposal": proposal,
    }


def _optimize_span(
    item_ids: Sequence[str],
    *,
    previous_id: str,
    next_id: str,
    matrix: Mapping[tuple[str, str], Mapping[str, Any]],
    original_position: Mapping[str, int],
) -> list[str]:
    remaining = list(item_ids)
    ordered: list[str] = []
    current_id = previous_id
    while remaining:
        chosen = min(
            remaining,
            key=lambda candidate: (
                _duration(matrix, current_id, candidate),
                original_position[candidate],
            ),
        )
        ordered.append(chosen)
        remaining.remove(chosen)
        current_id = chosen

    improved = True
    while improved and len(ordered) > 2:
        improved = False
        best_cost = _path_duration(
            [previous_id, *ordered, next_id],
            matrix=matrix,
        )
        for start in range(len(ordered) - 1):
            for end in range(start + 2, len(ordered) + 1):
                candidate = [*ordered[:start], *reversed(ordered[start:end]), *ordered[end:]]
                candidate_cost = _path_duration(
                    [previous_id, *candidate, next_id],
                    matrix=matrix,
                )
                if candidate_cost < best_cost:
                    ordered = candidate
                    best_cost = candidate_cost
                    improved = True
    return ordered


def _summarize_route(
    item_ids: Sequence[str],
    *,
    matrix: Mapping[tuple[str, str], Mapping[str, Any]],
    origin_id: str,
    destination_id: str,
) -> dict[str, Any]:
    path = [origin_id, *item_ids, destination_id]
    segments: list[dict[str, Any]] = []
    for start_id, goal_id in zip(path, path[1:]):
        raw = dict(matrix[(start_id, goal_id)])
        raw["from_id"] = start_id
        raw["to_id"] = goal_id
        segments.append(raw)
    statuses = {str(segment.get("status", "unavailable")) for segment in segments}
    if statuses == {"verified_route"}:
        status: RouteStatus = "verified_route"
    elif statuses == {"estimated_route"}:
        status = "estimated_route"
    elif "unavailable" in statuses and len(statuses) == 1:
        status = "unavailable"
    else:
        status = "mixed_route"
    return {
        "item_ids": list(item_ids),
        "segments": segments,
        "total_duration_s": sum(int(segment["duration_s"]) for segment in segments),
        "total_distance_m": sum(int(segment["distance_m"]) for segment in segments),
        "status": status,
    }


def _duration(
    matrix: Mapping[tuple[str, str], Mapping[str, Any]],
    start_id: str,
    goal_id: str,
) -> int:
    return int(matrix[(start_id, goal_id)]["duration_s"])


def _path_duration(
    path: Sequence[str],
    *,
    matrix: Mapping[tuple[str, str], Mapping[str, Any]],
) -> int:
    return sum(_duration(matrix, start_id, goal_id) for start_id, goal_id in zip(path, path[1:]))
