from __future__ import annotations

from apps.api.engine.route_planner import (
    build_day_proposal,
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


def _item(item_id: str, *, fixed: bool = False) -> dict[str, object]:
    return {
        "id": item_id,
        "day": 1,
        "fixed": fixed,
        "lat": 33.4,
        "lng": 126.5,
    }


def _segment(duration_s: int, distance_m: int | None = None) -> dict[str, object]:
    return {
        "duration_s": duration_s,
        "distance_m": distance_m if distance_m is not None else duration_s * 10,
        "status": "verified_route",
        "provider": "fixture",
        "geometry": [],
    }


def _fixed_anchor_matrix() -> dict[tuple[str, str], dict[str, object]]:
    ids = ["origin", "far", "near", "fixed", "end", "destination"]
    matrix = {
        (start, goal): _segment(4_000)
        for start in ids
        for goal in ids
        if start != goal
    }
    matrix.update(
        {
            ("origin", "far"): _segment(1_000),
            ("far", "near"): _segment(1_000),
            ("near", "fixed"): _segment(1_000),
            ("origin", "near"): _segment(100),
            ("near", "far"): _segment(100),
            ("far", "fixed"): _segment(100),
            ("fixed", "end"): _segment(100),
            ("end", "destination"): _segment(100),
        }
    )
    return matrix


def test_day_proposal_never_moves_fixed_item() -> None:
    items = [_item("far"), _item("near"), _item("fixed", fixed=True), _item("end")]

    result = build_day_proposal(items, matrix=_fixed_anchor_matrix())

    assert result["recommended_item_ids"] == ["near", "far", "fixed", "end"]
    assert result["recommended_item_ids"][2] == "fixed"
    assert result["proposal"]["operations"] == [
        {
            "type": "reorder_day_items",
            "day": 1,
            "ordered_item_ids": ["near", "far", "fixed", "end"],
        }
    ]


def test_day_proposal_is_deterministic_and_preserves_ids() -> None:
    items = [_item("far"), _item("near"), _item("fixed", fixed=True), _item("end")]

    first = build_day_proposal(items, matrix=_fixed_anchor_matrix())
    second = build_day_proposal(items, matrix=_fixed_anchor_matrix())

    assert first == second
    assert sorted(first["recommended_item_ids"]) == sorted(item["id"] for item in items)


def test_no_proposal_when_improvement_is_below_threshold() -> None:
    items = [_item("a"), _item("b"), _item("c")]
    ids = ["origin", "a", "b", "c", "destination"]
    matrix = {
        (start, goal): _segment(100)
        for start in ids
        for goal in ids
        if start != goal
    }

    result = build_day_proposal(items, matrix=matrix)

    assert result["proposal"] is None
    assert result["headline"] == "현재 동선이 적절합니다."
