"""raw_source(visitjeju) → place 정제.

DATA_PIPELINE.md §3 요구사항:
  1. 지역 정규화: 주소 → 12개 region 값. 매핑 실패는 상위 시(제주시/서귀포시)로 폴백.
  2. 카테고리 매핑: contentscd → 내부 카테고리. 카드와 매핑 안 되는 것도 category='other'로 보존.
  3. info_type/valid_until 강제. 못 채우면 place에 넣지 않는다.
  4. 좌표 검증: 제주 bbox 밖이면 좌표만 NULL, 항목은 보존.

probe(2026-07-04)로 확인된 사실 (Day2 결정 반영):
  - contentscd/region1cd/region2cd 는 nested dict {value,label,refId}.
  - 카테고리: c1 관광지 / c2 쇼핑 / c3 숙박 / c4 음식점 / c5 축제·행사 / c6 테마여행.
  - 지역 미매핑 확장: 한경(14)→hallim / 중문(24)→andeok (인접 병합).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text

from apps.api import db

# ---- 규칙 상수 ----

STATIC_TTL = timedelta(days=90)               # DATA_PIPELINE §2 static 규칙
JEJU_BBOX = (33.1, 33.6, 126.1, 127.0)        # lat_min, lat_max, lng_min, lng_max
# region2cd.value → region_normalized (filters.py REGIONS와 일치)
REGION2CD_TO_NORMALIZED: dict[str, str] = {
    "11": "jeju_city",
    "12": "aewol",
    "13": "hallim",
    "14": "hallim",     # 한경 → 한림 (Q1 결정)
    "15": "jocheon",
    "16": "gujwa",
    "17": "seongsan",
    "21": "seogwipo",
    "22": "daejeong",   # (page1엔 미출현이나 코드 예약)
    "23": "andeok",
    "24": "andeok",     # 중문 → 안덕 (Q1 결정)
    "25": "namwon",
    "26": "pyoseon",
    "31": "udo",
}

# region1cd.value 폴백 (region2cd 매핑 실패시)
REGION1CD_FALLBACK: dict[str, str] = {
    "region1": "jeju_city",
    "region2": "seogwipo",
    "region3": "udo",   # 섬 속의 섬 — 우도로 폴백
}

# 주소 문자열 폴백용 키워드 (region1cd/2cd 둘 다 실패 시)
ADDRESS_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("우도", "udo"),
    ("애월", "aewol"),
    ("한림", "hallim"), ("한경", "hallim"),
    ("조천", "jocheon"),
    ("구좌", "gujwa"),
    ("성산", "seongsan"),
    ("표선", "pyoseon"),
    ("남원", "namwon"),
    ("대정", "daejeong"),
    ("안덕", "andeok"), ("중문", "andeok"),
    ("서귀포", "seogwipo"),
    ("제주시", "jeju_city"),
)

# contentscd.value → 내부 category (LLM 없이 코드/제목/태그 기반)
# 카드 매핑 세분화는 c1(관광지) 내부에서 title/tag 키워드로 결정.
C1_OREUM_KWS = ("오름",)
C1_BEACH_KWS = ("해수욕장", "해변", "포구", "방파제")
C1_FOREST_KWS = ("곶자왈", "숲길", "수목원", "치유의숲")
C1_VIEWPOINT_KWS = ("전망대", "일몰", "노을", "선셋", "포토존")
CULTURE_KWS = (
    "박물관", "미술관", "전시", "전시관", "문화", "예술", "공연",
    "기념관", "체험관", "센터", "아트", "갤러리",
)

# c4 내부: 카페 분기
C4_CAFE_KWS = ("카페", "커피", "coffee", "cafe")

# c2 내부: 시장/오일장은 market, 나머지 쇼핑 정보는 shopping으로 보존
C2_MARKET_KWS = ("시장", "오일장")

# c6 (테마여행) 내부: 체험 신호를 experience로 보존
C6_EXPERIENCE_KWS = ("감귤", "체험", "액티비티", "승마", "요트", "공방", "클래스", "투어")


# ---- 정제 로직 ----

@dataclass(frozen=True)
class ProcessedPlace:
    external_id: str
    name: str
    category: str
    region_normalized: str
    address: str | None
    lat: float | None
    lng: float | None
    info_type: str
    valid_until: datetime
    amenities: dict
    source_url: str | None


def _get_nested_value(node: Any) -> str | None:
    """visitjeju의 {value,label,refId} dict에서 value 추출. dict 아니면 None."""
    if isinstance(node, dict):
        v = node.get("value")
        if isinstance(v, str) and v:
            return v
    return None


def resolve_region(item: dict) -> str | None:
    """region2cd → region1cd → 주소 키워드 순으로 12값에 매핑."""
    r2 = _get_nested_value(item.get("region2cd"))
    if r2 and r2 in REGION2CD_TO_NORMALIZED:
        return REGION2CD_TO_NORMALIZED[r2]

    r1 = _get_nested_value(item.get("region1cd"))
    if r1 and r1 in REGION1CD_FALLBACK:
        return REGION1CD_FALLBACK[r1]

    # 주소 폴백
    for field in ("address", "roadaddress"):
        addr = item.get(field)
        if isinstance(addr, str):
            for kw, region in ADDRESS_KEYWORDS:
                if kw in addr:
                    return region
    return None


def _has_kw(text_lower: str, kws: tuple[str, ...]) -> bool:
    return any(k in text_lower for k in kws)


def classify_category(item: dict) -> str | None:
    """contentscd.value + title/tag 키워드로 내부 category 결정.

    반환값:
      oreum|beach|cafe|food|market|forest|experience|viewpoint|culture|festival|shopping|accommodation|other
    """
    cd = _get_nested_value(item.get("contentscd"))
    title = str(item.get("title") or "")
    tag = str(item.get("tag") or "") + " " + str(item.get("alltag") or "")
    haystack = (title + " " + tag).lower()

    if cd == "c1":  # 관광지
        if _has_kw(title, C1_OREUM_KWS):
            return "oreum"
        if _has_kw(haystack, C1_BEACH_KWS):
            return "beach"
        if _has_kw(haystack, C1_FOREST_KWS):
            return "forest"
        if _has_kw(haystack, C1_VIEWPOINT_KWS):
            return "viewpoint"
        if _has_kw(haystack, CULTURE_KWS):
            return "culture"
        return "other"  # 미분류 관광지도 보존 (verify에서 쓰일 수 있음)

    if cd == "c3":  # 숙박
        return "accommodation"

    if cd == "c4":  # 음식점 (카페 포함)
        return "cafe" if _has_kw(haystack, C4_CAFE_KWS) else "food"

    if cd == "c2":  # 쇼핑
        return "market" if _has_kw(haystack, C2_MARKET_KWS) else "shopping"

    if cd == "c5":  # 축제/행사. 전시·공연 계열은 문화시설/행사로 검색 가능하게 culture로 보존.
        return "culture" if _has_kw(haystack, CULTURE_KWS) else "festival"

    if cd == "c6":  # 테마여행 → 체험관광
        return "experience" if _has_kw(haystack, C6_EXPERIENCE_KWS) else "other"

    return "other"


def resolve_coords(item: dict) -> tuple[float | None, float | None]:
    """좌표 추출 + 제주 bbox 검증. bbox 밖이면 (None, None)."""
    try:
        lat = float(item["latitude"]) if item.get("latitude") is not None else None
        lng = float(item["longitude"]) if item.get("longitude") is not None else None
    except (TypeError, ValueError):
        return None, None
    if lat is None or lng is None:
        return None, None
    lat_min, lat_max, lng_min, lng_max = JEJU_BBOX
    if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
        return None, None
    return lat, lng


def build_source_url(external_id: str) -> str:
    return f"https://www.visitjeju.net/kr/detail/view?contentsid={external_id}"


def process_item(item: dict, *, fetched_at: datetime) -> ProcessedPlace | None:
    """단일 raw 아이템 → ProcessedPlace. 스킵 조건은 None 반환."""
    ext_id = item.get("contentsid")
    name = item.get("title")
    if not isinstance(ext_id, str) or not ext_id:
        return None
    if not isinstance(name, str) or not name.strip():
        return None

    category = classify_category(item)
    if category is None:
        return None

    region = resolve_region(item)
    if region is None:
        return None  # 지역 매핑 실패는 스킵 (조용히 상위로 병합 금지)

    # info_type/valid_until: 지금은 c5/실시간 소스를 제외한 모든 항목을 static +90d.
    # seasonal(개장기간)/periodic(오일장)은 이후 별도 규칙으로 덮어씀.
    info_type = "static"
    valid_until = fetched_at + STATIC_TTL

    lat, lng = resolve_coords(item)
    address = item.get("roadaddress") or item.get("address")
    if not isinstance(address, str) or not address.strip():
        address = None

    amenities: dict = {}
    # phoneno가 "*" 이면 없음 (probe에서 확인)
    phone = item.get("phoneno")
    if isinstance(phone, str) and phone and phone != "*":
        amenities["phone"] = phone

    return ProcessedPlace(
        external_id=ext_id,
        name=name.strip(),
        category=category,
        region_normalized=region,
        address=address,
        lat=lat,
        lng=lng,
        info_type=info_type,
        valid_until=valid_until,
        amenities=amenities,
        source_url=build_source_url(ext_id),
    )


# ---- DB 반영 ----

UPSERT_PLACE_SQL = text(
    """
    INSERT INTO place (
        external_id, name, category, region_normalized,
        address, lat, lng, info_type, valid_until,
        amenities, source_url, updated_at
    )
    VALUES (
        :external_id, :name, :category, :region,
        :address, :lat, :lng, :info_type, :valid_until,
        CAST(:amenities AS jsonb), :source_url, now()
    )
    ON CONFLICT (external_id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        region_normalized = EXCLUDED.region_normalized,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        info_type = EXCLUDED.info_type,
        valid_until = EXCLUDED.valid_until,
        amenities = EXCLUDED.amenities,
        source_url = EXCLUDED.source_url,
        updated_at = now()
    """
)


def upsert_places(rows: list[ProcessedPlace]) -> int:
    if not rows:
        return 0
    engine = db.get_engine()
    with engine.begin() as conn:
        for r in rows:
            conn.execute(
                UPSERT_PLACE_SQL,
                {
                    "external_id": r.external_id,
                    "name": r.name,
                    "category": r.category,
                    "region": r.region_normalized,
                    "address": r.address,
                    "lat": r.lat,
                    "lng": r.lng,
                    "info_type": r.info_type,
                    "valid_until": r.valid_until,
                    "amenities": json.dumps(r.amenities, ensure_ascii=False),
                    "source_url": r.source_url,
                },
            )
    return len(rows)


def process_from_raw_source(*, limit: int | None = None) -> int:
    """raw_source(source='visitjeju', tombstoned=false)의 payload를 place로 정제 적재."""
    engine = db.get_engine()
    q = "SELECT external_id, payload, fetched_at FROM raw_source WHERE source='visitjeju' AND tombstoned=false"
    if limit is not None:
        q += f" ORDER BY fetched_at DESC LIMIT {int(limit)}"
    rows_out: list[ProcessedPlace] = []
    with engine.connect() as conn:
        for row in conn.execute(text(q)):
            payload = row.payload
            if isinstance(payload, str):
                payload = json.loads(payload)
            fetched_at = row.fetched_at
            if fetched_at is None:
                fetched_at = datetime.now(timezone.utc)
            processed = process_item(payload, fetched_at=fetched_at)
            if processed is not None:
                rows_out.append(processed)
    return upsert_places(rows_out)


def process_from_probe_dump(dump_path: str, *, limit: int | None = 20) -> int:
    """probe json 파일에서 즉시 seed 데이터를 place에 적재 (수집 대기 없이 개발용)."""
    with open(dump_path, encoding="utf-8") as f:
        payload = json.load(f)
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return 0
    if limit is not None:
        items = items[:limit]
    fetched_at = datetime.now(timezone.utc)
    rows: list[ProcessedPlace] = []
    for it in items:
        p = process_item(it, fetched_at=fetched_at)
        if p is not None:
            rows.append(p)
    return upsert_places(rows)


# ---- CLI ----

def main(argv: list[str] | None = None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="raw_source(visitjeju) → place 정제")
    p.add_argument("--from-probe", metavar="PATH", help="probe json에서 즉시 seed 적재")
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if args.from_probe:
        n = process_from_probe_dump(args.from_probe, limit=args.limit)
    else:
        n = process_from_raw_source(limit=args.limit)
    print(f"[process] upserted {n} places")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
