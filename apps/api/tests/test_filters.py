"""filters.py 단위 테스트 — Day1 종료 기준."""
from __future__ import annotations

from datetime import date

import pytest

from apps.api.engine.filters import (
    COMPANION_REQUIRED_AMENITIES,
    MOMENT_TO_CATEGORY,
    PURPOSE_TO_CATEGORIES,
    REGIONS,
    Filters,
    PackRequest,
    UnknownCompanion,
    UnknownMoment,
    UnknownPurpose,
    UnknownRegion,
    build_filters,
)


def _req(**overrides) -> PackRequest:
    base = dict(
        region="aewol",
        start_date="2026-07-03",
        days=3,
        companion="family",
        purpose="healing",
        moments=["oreum", "local_market"],
    )
    base.update(overrides)
    return PackRequest.from_dict(base)


# ---- 매핑 테이블 무결성 ----

def test_regions_has_12_jeju_values():
    assert len(REGIONS) == 12
    assert "aewol" in REGIONS and "udo" in REGIONS


def test_moment_to_category_covers_all_8_cards():
    expected = {"oreum", "beach_walk", "sunset", "local_market",
                "local_food", "quiet_cafe", "gotjawal", "citrus"}
    assert set(MOMENT_TO_CATEGORY) == expected


def test_purpose_to_categories_covers_prd_purposes():
    assert set(PURPOSE_TO_CATEGORIES) == {
        "healing", "sightseeing", "food", "activity", "hocance",
    }


def test_companion_required_amenities_covers_prd_companions():
    assert set(COMPANION_REQUIRED_AMENITIES) == {
        "solo", "couple", "friend", "family", "kids", "parents",
    }


# ---- build_filters happy path ----

def test_build_filters_happy_path():
    f = build_filters(_req())
    assert isinstance(f, Filters)
    assert f.region == "aewol"
    assert f.trip_start == date(2026, 7, 3)
    # days=3 → inclusive end는 7/5
    assert f.trip_end == date(2026, 7, 5)
    assert f.companion == "family"
    assert f.purpose == "healing"
    assert len(f.per_moment) == 2


def test_moment_filter_primary_matches_card_mapping():
    f = build_filters(_req(moments=["oreum"]))
    mf = f.per_moment[0]
    assert mf.moment == "oreum"
    assert mf.primary_category == "oreum"


def test_supporting_categories_exclude_primary():
    # healing 지원 카테고리에 forest 포함. gotjawal 카드의 primary가 forest이므로 supporting에서는 빠져야 함.
    f = build_filters(_req(moments=["gotjawal"], purpose="healing"))
    mf = f.per_moment[0]
    assert mf.primary_category == "forest"
    assert "forest" not in mf.supporting_categories
    assert "cafe" in mf.supporting_categories  # healing의 다른 시그널은 남는다


def test_companion_family_requires_kids_amenity():
    f = build_filters(_req(companion="family"))
    for mf in f.per_moment:
        assert "kids" in mf.required_amenities


def test_companion_parents_requires_accessibility():
    f = build_filters(_req(companion="parents"))
    for mf in f.per_moment:
        assert "accessibility" in mf.required_amenities


def test_companion_solo_has_no_required_amenities():
    f = build_filters(_req(companion="solo"))
    for mf in f.per_moment:
        assert mf.required_amenities == ()


def test_trip_end_is_inclusive_single_day():
    f = build_filters(_req(days=1))
    assert f.trip_start == f.trip_end


# ---- 검증(에러) 경로 ----

def test_unknown_region_raises():
    with pytest.raises(UnknownRegion):
        build_filters(_req(region="busan"))


def test_unknown_moment_raises():
    with pytest.raises(UnknownMoment):
        build_filters(_req(moments=["skiing"]))


def test_unknown_companion_raises():
    with pytest.raises(UnknownCompanion):
        build_filters(_req(companion="pet"))


def test_unknown_purpose_raises():
    with pytest.raises(UnknownPurpose):
        build_filters(_req(purpose="shopping"))


def test_days_zero_raises():
    with pytest.raises(ValueError):
        build_filters(_req(days=0))
