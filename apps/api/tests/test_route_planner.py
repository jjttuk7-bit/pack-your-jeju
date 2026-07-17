from __future__ import annotations

from apps.api.engine.route_planner import (
    estimated_segment,
    haversine_meters,
    route_plan_fingerprint,
)


def test_haversine_is_symmetric_and_zero_for_same_point() -> None:
    a = {"lat": 33.4996, "lng": 126.5312}
    b = {"lat": 33.4507, "lng": 126.5707}

    assert haversine_meters(a, a) == 0
    assert haversine_meters(a, b) == haversine_meters(b, a)


def test_estimated_segment_is_explicitly_estimated() -> None:
    segment = estimated_segment(
        {"lat": 33.4996, "lng": 126.5312},
        {"lat": 33.4507, "lng": 126.5707},
        mode="driving",
    )

    assert segment["status"] == "estimated_route"
    assert segment["provider"] == "route-travel-v1"
    assert segment["distance_m"] > 0
    assert segment["duration_s"] > 0


def test_route_fingerprint_changes_when_order_or_mode_changes() -> None:
    items = [{"id": "a", "day": 1}, {"id": "b", "day": 1}]

    original = route_plan_fingerprint(items, mode="driving")

    assert original != route_plan_fingerprint(list(reversed(items)), mode="driving")
    assert original != route_plan_fingerprint(items, mode="walking")
