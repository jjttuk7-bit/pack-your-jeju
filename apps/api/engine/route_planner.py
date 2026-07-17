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
