"""process.py 매핑 로직 테스트 — DB 없이 순수 함수만."""
from __future__ import annotations

from datetime import datetime, timezone

from apps.pipelines import process as proc


def _base(**over):
    item = {
        "contentsid": "CNTS_1",
        "title": "새별오름",
        "contentscd": {"value": "c1", "label": "관광지"},
        "region1cd": {"value": "region1", "label": "제주시"},
        "region2cd": {"value": "12", "label": "애월"},
        "address": "제주특별자치도 제주시 애월읍",
        "roadaddress": None,
        "latitude": 33.36,
        "longitude": 126.35,
        "tag": "오름",
        "alltag": "",
        "phoneno": "*",
    }
    item.update(over)
    return item


# ---- region 매핑 ----

def test_region2cd_direct_match_aewol():
    assert proc.resolve_region(_base()) == "aewol"


def test_region2cd_hangyeong_merges_to_hallim():
    it = _base(region2cd={"value": "14", "label": "한경"})
    assert proc.resolve_region(it) == "hallim"


def test_region2cd_jungmun_merges_to_andeok():
    it = _base(region2cd={"value": "24", "label": "중문"})
    assert proc.resolve_region(it) == "andeok"


def test_region1cd_fallback_when_region2_missing():
    it = _base(region2cd=None, region1cd={"value": "region2", "label": "서귀포시"})
    assert proc.resolve_region(it) == "seogwipo"


def test_address_keyword_fallback_when_codes_missing():
    it = _base(region2cd=None, region1cd=None, address="제주특별자치도 서귀포시 성산읍")
    assert proc.resolve_region(it) == "seongsan"


def test_region_none_when_all_signals_missing():
    it = _base(region2cd=None, region1cd=None, address=None, roadaddress=None)
    assert proc.resolve_region(it) is None


# ---- category 매핑 ----

def test_c1_with_oreum_title_becomes_oreum():
    assert proc.classify_category(_base(title="새별오름")) == "oreum"


def test_c1_with_beach_tag_becomes_beach():
    it = _base(title="협재해수욕장", tag="해수욕장")
    assert proc.classify_category(it) == "beach"


def test_c1_forest_becomes_forest():
    it = _base(title="곶자왈 도립공원", tag="곶자왈")
    assert proc.classify_category(it) == "forest"


def test_c1_viewpoint_becomes_viewpoint():
    it = _base(title="일몰 전망대", tag="노을")
    assert proc.classify_category(it) == "viewpoint"


def test_c1_unmatched_becomes_other_not_dropped():
    it = _base(title="무슨무슨공원", tag="공원")
    assert proc.classify_category(it) == "other"


def test_c4_cafe_keyword_becomes_cafe():
    it = _base(contentscd={"value": "c4", "label": "음식점"}, title="어느카페", tag="카페")
    assert proc.classify_category(it) == "cafe"


def test_c4_food_default():
    it = _base(contentscd={"value": "c4", "label": "음식점"}, title="흑돼지집", tag="맛집")
    assert proc.classify_category(it) == "food"


def test_c2_market_becomes_market():
    it = _base(contentscd={"value": "c2", "label": "쇼핑"}, title="제주민속오일장", tag="오일장")
    assert proc.classify_category(it) == "market"


def test_c2_non_market_becomes_shopping():
    it = _base(contentscd={"value": "c2", "label": "쇼핑"}, title="면세점", tag="쇼핑")
    assert proc.classify_category(it) == "shopping"


def test_c3_accommodation_becomes_accommodation():
    it = _base(contentscd={"value": "c3", "label": "숙박"}, title="제주 호텔")
    assert proc.classify_category(it) == "accommodation"


def test_c5_festival_becomes_festival():
    it = _base(contentscd={"value": "c5", "label": "축제/행사"}, title="어느축제")
    assert proc.classify_category(it) == "festival"


def test_c5_culture_keyword_becomes_culture():
    it = _base(contentscd={"value": "c5", "label": "축제/행사"}, title="제주 전시회", tag="전시")
    assert proc.classify_category(it) == "culture"


def test_c6_citrus_becomes_experience():
    it = _base(contentscd={"value": "c6", "label": "테마여행"}, title="감귤따기 체험", tag="감귤")
    assert proc.classify_category(it) == "experience"


def test_c6_non_citrus_experience_keyword_becomes_experience():
    it = _base(contentscd={"value": "c6", "label": "테마여행"}, title="승마 체험", tag="")
    assert proc.classify_category(it) == "experience"


# ---- 좌표 bbox ----

def test_coords_inside_bbox_passes_through():
    lat, lng = proc.resolve_coords(_base())
    assert (lat, lng) == (33.36, 126.35)


def test_coords_outside_bbox_are_nulled():
    it = _base(latitude=37.5, longitude=126.9)  # 서울
    assert proc.resolve_coords(it) == (None, None)


def test_coords_missing_are_none():
    assert proc.resolve_coords(_base(latitude=None, longitude=None)) == (None, None)


# ---- process_item 통합 ----

def test_process_item_c5_returns_festival_place():
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    it = _base(contentscd={"value": "c5", "label": "축제/행사"})
    p = proc.process_item(it, fetched_at=fetched_at)
    assert p is not None
    assert p.category == "festival"


def test_process_item_ok_returns_processed_place():
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    p = proc.process_item(_base(), fetched_at=fetched_at)
    assert p is not None
    assert p.external_id == "CNTS_1"
    assert p.name == "새별오름"
    assert p.category == "oreum"
    assert p.region_normalized == "aewol"
    assert p.info_type == "static"
    # +90일 강제
    assert (p.valid_until - fetched_at).days == 90


def test_process_item_no_region_dropped():
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    it = _base(region2cd=None, region1cd=None, address=None, roadaddress=None)
    assert proc.process_item(it, fetched_at=fetched_at) is None


def test_process_item_phone_star_treated_as_missing():
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    p = proc.process_item(_base(phoneno="*"), fetched_at=fetched_at)
    assert p is not None
    assert "phone" not in p.amenities


def test_process_item_phone_kept_when_real():
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    p = proc.process_item(_base(phoneno="064-000-0000"), fetched_at=fetched_at)
    assert p is not None
    assert p.amenities["phone"] == "064-000-0000"


def test_upsert_places_uses_single_batch_execute(monkeypatch):
    fetched_at = datetime(2026, 7, 4, tzinfo=timezone.utc)
    rows = [
        proc.process_item(_base(contentsid=f"CNTS_{i}"), fetched_at=fetched_at)
        for i in range(2)
    ]
    calls = []

    class FakeConnection:
        def execute(self, statement, params):
            calls.append((statement, params))

    class FakeBegin:
        def __enter__(self):
            return FakeConnection()

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeEngine:
        def begin(self):
            return FakeBegin()

    monkeypatch.setattr(proc.db, "get_engine", lambda: FakeEngine())

    assert proc.upsert_places([row for row in rows if row is not None]) == 2
    assert len(calls) == 1
    assert isinstance(calls[0][1], list)
    assert len(calls[0][1]) == 2
