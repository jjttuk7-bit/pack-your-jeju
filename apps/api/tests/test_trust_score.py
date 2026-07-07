from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from apps.api.engine.filters import MomentFilter
from apps.api.engine.search import PlaceHit, TransitCheck
from apps.api.engine.trust import compute_trust_profile


def _mf(required_amenities: tuple[str, ...] = ("kids",)) -> MomentFilter:
    return MomentFilter(
        moment="oreum",
        primary_category="oreum",
        supporting_categories=(),
        regions=("aewol",),
        trip_start=date(2026, 7, 7),
        trip_end=date(2026, 7, 9),
        required_amenities=required_amenities,
    )


def _hit(**overrides) -> PlaceHit:
    data = {
        "external_id": "p1",
        "name": "테스트오름",
        "category": "oreum",
        "region_normalized": "aewol",
        "address": "제주시 애월읍",
        "lat": 33.4,
        "lng": 126.3,
        "info_type": "static",
        "valid_until": datetime(2026, 10, 1, tzinfo=timezone.utc),
        "amenities": {"kids": True},
        "has_fix_request": False,
        "tombstoned": False,
        "source_url": "https://example.test",
        "hygiene_grade": None,
    }
    data.update(overrides)
    return PlaceHit(**data)


def test_trust_profile_scores_verified_item_with_breakdown():
    profile = compute_trust_profile(
        _hit(),
        _mf(),
        transit=TransitCheck(parking=True, parking_count=2, bus_walkable=True),
        now=datetime(2026, 7, 7, tzinfo=timezone.utc),
        visit_signal=None,
    )

    assert profile.score >= 85
    assert set(profile.breakdown) == {
        "public_data_match",
        "user_condition_fit",
        "weather_fit",
        "movement_feasibility",
        "operation_info",
        "visit_signal",
        "recency",
    }
    assert profile.breakdown["public_data_match"]["points"] == 30
    assert "weather" in profile.check_required


def test_trust_profile_flags_missing_amenity_and_fix_request():
    profile = compute_trust_profile(
        _hit(amenities={}, has_fix_request=True),
        _mf(required_amenities=("kids",)),
        transit=TransitCheck(parking=False, parking_count=0, bus_walkable=False),
        now=datetime(2026, 7, 7, tzinfo=timezone.utc),
        visit_signal={"status": "info_mismatch"},
    )

    assert profile.score < 70
    assert "user_condition" in profile.check_required
    assert "movement" in profile.check_required
    assert "visit_feedback" in profile.check_required


def test_trust_profile_penalizes_expired_and_contradicted_item():
    profile = compute_trust_profile(
        _hit(
            tombstoned=True,
            valid_until=datetime(2026, 7, 1, tzinfo=timezone.utc),
        ),
        _mf(required_amenities=()),
        transit=TransitCheck(parking=True, parking_count=1, bus_walkable=False),
        now=datetime(2026, 7, 7, tzinfo=timezone.utc),
        visit_signal=None,
    )

    assert profile.score <= 45
    assert "operation_info" in profile.check_required
    assert "public_data" in profile.check_required
