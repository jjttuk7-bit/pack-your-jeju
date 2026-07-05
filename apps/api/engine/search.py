"""place / food / transit 검색.

원칙 (TRUST_ENGINE.md §1):
  - moment별로 primary_category(강한 신호) 우선, 부족하면 supporting_categories 완화
  - 지역은 region_normalized 정확 일치가 우선, 부족하면 상위 시(제주시/서귀포시)로 완화
  - 재시도는 trust.py에서 1회 트리거하며, 여기서는 인터페이스만 제공

완화 규칙:
  - 지역 확대: 우리 12값 → 상위 그룹(제주시권/서귀포시권/우도).
    강한 신호 시엔 정확 일치, 완화 시엔 그룹 전체.
  - 카테고리 확대: primary만 → primary + supporting(purpose 시그널).

교통 배지 (transit_check):
  - parking: 1km 이내 주차장 개수
  - busstop: 500m 이내 정류장 존재 (bus_walkable)
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Sequence

from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection

from apps.api import db
from apps.api.engine.filters import MomentFilter

DEFAULT_LIMIT = 3               # moment당 3개까지 노출
PARKING_RADIUS_KM = 1.0
BUSSTOP_RADIUS_KM = 0.5

# 12 region → 상위 시권. 지역 확대(relaxed) 시 이 그룹의 다른 region까지 허용.
REGION_GROUP: dict[str, tuple[str, ...]] = {
    "jeju_city": ("jeju_city", "aewol", "hallim", "jocheon", "gujwa"),
    "aewol":     ("jeju_city", "aewol", "hallim"),
    "hallim":    ("jeju_city", "aewol", "hallim"),
    "jocheon":   ("jeju_city", "jocheon", "gujwa"),
    "gujwa":     ("jocheon", "gujwa", "udo"),
    "seogwipo":  ("seogwipo", "andeok", "daejeong", "namwon", "pyoseon", "seongsan"),
    "seongsan":  ("seongsan", "pyoseon", "gujwa"),
    "andeok":    ("seogwipo", "andeok", "daejeong"),
    "daejeong":  ("seogwipo", "andeok", "daejeong"),
    "namwon":    ("seogwipo", "namwon", "pyoseon"),
    "pyoseon":   ("seogwipo", "pyoseon", "namwon", "seongsan"),
    "udo":       ("udo", "gujwa"),
}


# ---- 결과 타입 ----

@dataclass(frozen=True)
class PlaceHit:
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
    has_fix_request: bool
    tombstoned: bool
    source_url: str | None
    hygiene_grade: str | None


@dataclass(frozen=True)
class TransitCheck:
    parking: bool
    parking_count: int
    bus_walkable: bool


# ---- 검색 SQL ----

_BASE_SELECT = """
    SELECT external_id, name, category, region_normalized, address,
           lat, lng, info_type, valid_until, amenities,
           has_fix_request, tombstoned, source_url, hygiene_grade
      FROM place
     WHERE tombstoned = false
       AND region_normalized = ANY(:regions)
       AND category = ANY(:categories)
     ORDER BY has_fix_request DESC, updated_at DESC, id ASC
     LIMIT :limit
"""
# 정렬 규칙 (정직함 시연 정책):
#   1) has_fix_request DESC — 신뢰 하향 신호가 있는 항목을 오히려 상위로 올려
#      사용자에게 caution 배지가 확실히 노출되도록 한다. "조용히 뒤로 밀지 않고
#      배지로 신호"라는 MOMENT_CARDS 정신을 능동적으로 강화.
#   2) updated_at DESC — 최신 데이터 우선
#   3) id ASC — 결정론적 tiebreaker (골든셋 재현성)


def _run_query(
    conn: Connection,
    *,
    regions: Sequence[str],
    categories: Sequence[str],
    now: datetime,
    limit: int,
) -> list[PlaceHit]:
    stmt = text(_BASE_SELECT).bindparams(
        bindparam("regions", expanding=False),
        bindparam("categories", expanding=False),
    )
    rows = conn.execute(
        stmt,
        {
            "regions": list(regions),
            "categories": list(categories),
            "now": now,
            "limit": limit,
        },
    ).all()
    return [_row_to_hit(r) for r in rows]


def _row_to_hit(r) -> PlaceHit:
    amenities = r.amenities if isinstance(r.amenities, dict) else {}
    return PlaceHit(
        external_id=r.external_id,
        name=r.name,
        category=r.category,
        region_normalized=r.region_normalized,
        address=r.address,
        lat=r.lat,
        lng=r.lng,
        info_type=r.info_type,
        valid_until=r.valid_until,
        amenities=amenities,
        has_fix_request=bool(r.has_fix_request),
        tombstoned=bool(r.tombstoned),
        source_url=r.source_url,
        hygiene_grade=r.hygiene_grade,
    )


# ---- 퍼블릭 검색 함수 ----

def search_strict(mf: MomentFilter, *, limit: int = DEFAULT_LIMIT) -> list[PlaceHit]:
    """정확 매칭: 선택된 regions 정확 + primary_category만.

    사용자가 여러 지역을 선택했으면 그 지역들의 합집합을 검색한다.
    """
    now = datetime.now(timezone.utc)
    with db.get_engine().connect() as conn:
        return _run_query(
            conn,
            regions=mf.regions,
            categories=(mf.primary_category,),
            now=now,
            limit=limit,
        )


def search_relaxed(mf: MomentFilter, *, limit: int = DEFAULT_LIMIT) -> list[PlaceHit]:
    """완화 매칭: 각 region을 상위 시권으로 확대한 합집합. 카테고리는 primary 유지.

    TRUST_ENGINE.md §2 규칙: "완화 재시도 1회 (지역 확대: 읍면동 → 시 단위)".
    """
    now = datetime.now(timezone.utc)
    expanded: set[str] = set()
    for r in mf.regions:
        for g in REGION_GROUP.get(r, (r,)):
            expanded.add(g)
    categories = (mf.primary_category,)
    with db.get_engine().connect() as conn:
        return _run_query(
            conn,
            regions=tuple(sorted(expanded)),
            categories=categories,
            now=now,
            limit=limit,
        )


# ---- 교통 근접 판정 (하버사인) ----

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def transit_check(lat: float | None, lng: float | None) -> TransitCheck:
    """근접 주차장/정류장 확인. 좌표가 없으면 모두 False."""
    if lat is None or lng is None:
        return TransitCheck(parking=False, parking_count=0, bus_walkable=False)

    # transit_point 데이터가 아직 없어도(Day2 R1 몫) 크래시 없이 False 반환하도록 방어.
    parking_count = 0
    bus_walkable = False
    try:
        with db.get_engine().connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT kind, lat, lng FROM transit_point
                     WHERE lat BETWEEN :lat_min AND :lat_max
                       AND lng BETWEEN :lng_min AND :lng_max
                    """
                ),
                {
                    "lat_min": lat - 0.02,
                    "lat_max": lat + 0.02,
                    "lng_min": lng - 0.03,
                    "lng_max": lng + 0.03,
                },
            ).all()
    except Exception:
        return TransitCheck(parking=False, parking_count=0, bus_walkable=False)

    for row in rows:
        d = haversine_km(lat, lng, row.lat, row.lng)
        if row.kind == "parking" and d <= PARKING_RADIUS_KM:
            parking_count += 1
        elif row.kind == "busstop" and d <= BUSSTOP_RADIUS_KM:
            bus_walkable = True
    return TransitCheck(
        parking=parking_count > 0,
        parking_count=parking_count,
        bus_walkable=bus_walkable,
    )
