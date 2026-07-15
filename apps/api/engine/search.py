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

import base64
import binascii
import json
import math
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Callable, Iterable, Sequence

from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection

from apps.api import db
from apps.api.engine.filters import MomentFilter

DEFAULT_LIMIT = 5               # moment당 5개까지 노출
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


@dataclass(frozen=True)
class CandidatePage:
    items: list[PlaceHit]
    total_count: int
    has_more: bool
    next_cursor: str | None


@dataclass(frozen=True)
class CandidateCursor:
    exact_rank: int
    fix_rank: int
    updated_at: datetime
    row_id: int
    total_count: int = 0
    seen_count: int = 0


@dataclass(frozen=True)
class CandidateBatch:
    items: list[PlaceHit]
    last_cursor: CandidateCursor | None
    has_more: bool


# ---- 검색 SQL ----

_BASE_SELECT = """
    SELECT external_id, name, category, region_normalized, address,
           lat, lng, info_type, valid_until, amenities,
           has_fix_request, tombstoned, source_url, hygiene_grade
      FROM place
     WHERE tombstoned = false
       AND region_normalized = ANY(:regions)
       AND category = ANY(:categories)
       AND valid_until >= :now
     ORDER BY has_fix_request DESC, updated_at DESC, id ASC
     LIMIT :limit
"""

_CANDIDATE_PAGE_SELECT = """
    SELECT id,
           COALESCE(updated_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') AS cursor_updated_at,
           CASE WHEN region_normalized = ANY(:exact_regions) THEN 1 ELSE 0 END AS exact_rank,
           CASE WHEN has_fix_request THEN 1 ELSE 0 END AS fix_rank,
           external_id, name, category, region_normalized, address,
           lat, lng, info_type, valid_until, amenities,
           has_fix_request, tombstoned, source_url, hygiene_grade
      FROM place
     WHERE tombstoned = false
       AND region_normalized = ANY(:regions)
       AND category = ANY(:categories)
       AND valid_until >= :now
       {cursor_clause}
     ORDER BY (region_normalized = ANY(:exact_regions)) DESC,
              has_fix_request DESC,
              COALESCE(updated_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') DESC,
              id ASC
     LIMIT :fetch_limit
"""

_CANDIDATE_CURSOR_CLAUSE = """
       AND (
            CASE WHEN region_normalized = ANY(:exact_regions) THEN 1 ELSE 0 END < :cursor_exact
         OR (
              CASE WHEN region_normalized = ANY(:exact_regions) THEN 1 ELSE 0 END = :cursor_exact
              AND CASE WHEN has_fix_request THEN 1 ELSE 0 END < :cursor_fix
            )
         OR (
              CASE WHEN region_normalized = ANY(:exact_regions) THEN 1 ELSE 0 END = :cursor_exact
              AND CASE WHEN has_fix_request THEN 1 ELSE 0 END = :cursor_fix
              AND COALESCE(updated_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') < :cursor_updated_at
            )
         OR (
              CASE WHEN region_normalized = ANY(:exact_regions) THEN 1 ELSE 0 END = :cursor_exact
              AND CASE WHEN has_fix_request THEN 1 ELSE 0 END = :cursor_fix
              AND COALESCE(updated_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') = :cursor_updated_at
              AND id > :cursor_id
            )
       )
"""

_CANDIDATE_COUNT_SELECT = """
    SELECT COUNT(*)
      FROM place
     WHERE tombstoned = false
       AND region_normalized = ANY(:regions)
       AND category = ANY(:categories)
       AND valid_until >= :now
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


def _expanded_regions(mf: MomentFilter) -> tuple[str, ...]:
    expanded: set[str] = set()
    for region in mf.regions:
        expanded.update(REGION_GROUP.get(region, (region,)))
    return tuple(sorted(expanded))


def _query_candidate_batch(
    mf: MomentFilter,
    *,
    cursor: CandidateCursor | None,
    limit: int,
) -> CandidateBatch:
    params = {
        "regions": list(_expanded_regions(mf)),
        "exact_regions": list(mf.regions),
        "categories": [mf.primary_category],
        "now": datetime.now(timezone.utc),
        "fetch_limit": limit + 1,
    }
    if cursor:
        params.update(
            {
                "cursor_exact": cursor.exact_rank,
                "cursor_fix": cursor.fix_rank,
                "cursor_updated_at": cursor.updated_at,
                "cursor_id": cursor.row_id,
            }
        )
    query = _CANDIDATE_PAGE_SELECT.format(
        cursor_clause=_CANDIDATE_CURSOR_CLAUSE if cursor else "",
    )
    with db.get_engine().connect() as conn:
        rows = conn.execute(text(query), params).all()
    has_more = len(rows) > limit
    visible_rows = rows[:limit]
    last = visible_rows[-1] if visible_rows else None
    return CandidateBatch(
        items=[_row_to_hit(row) for row in visible_rows],
        last_cursor=(
            CandidateCursor(
                exact_rank=int(last.exact_rank),
                fix_rank=int(last.fix_rank),
                updated_at=last.cursor_updated_at,
                row_id=int(last.id),
            )
            if last
            else None
        ),
        has_more=has_more,
    )


def count_candidates(mf: MomentFilter) -> int:
    with db.get_engine().connect() as conn:
        value = conn.execute(
            text(_CANDIDATE_COUNT_SELECT),
            {
                "regions": list(_expanded_regions(mf)),
                "categories": [mf.primary_category],
                "now": datetime.now(timezone.utc),
            },
        ).scalar_one()
    return int(value)


def _encode_cursor(cursor: CandidateCursor) -> str:
    payload = json.dumps(
        {
            "exact": cursor.exact_rank,
            "fix": cursor.fix_rank,
            "updated_at": cursor.updated_at.isoformat(),
            "id": cursor.row_id,
            "total": cursor.total_count,
            "seen": cursor.seen_count,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str | None) -> CandidateCursor | None:
    if not cursor:
        return None
    if len(cursor) > 512:
        raise ValueError("invalid candidate cursor")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        exact_rank = payload["exact"]
        fix_rank = payload["fix"]
        row_id = payload["id"]
        total_count = payload["total"]
        seen_count = payload["seen"]
        updated_at = datetime.fromisoformat(payload["updated_at"])
        if (
            type(exact_rank) is not int
            or exact_rank not in (0, 1)
            or type(fix_rank) is not int
            or fix_rank not in (0, 1)
            or type(row_id) is not int
            or row_id < 1
            or type(total_count) is not int
            or total_count < 0
            or type(seen_count) is not int
            or seen_count < 0
            or seen_count > total_count
            or updated_at.tzinfo is None
        ):
            raise ValueError
        return CandidateCursor(
            exact_rank,
            fix_rank,
            updated_at,
            row_id,
            total_count,
            seen_count,
        )
    except (
        ValueError,
        TypeError,
        KeyError,
        UnicodeDecodeError,
        binascii.Error,
        json.JSONDecodeError,
    ) as exc:
        raise ValueError("invalid candidate cursor") from exc


def search_candidate_page(
    mf: MomentFilter,
    *,
    cursor: str | None = None,
    limit: int = DEFAULT_LIMIT,
    page_fn: Callable[..., CandidateBatch] | None = None,
    count_fn: Callable[[MomentFilter], int] | None = None,
) -> CandidatePage:
    decoded_cursor = _decode_cursor(cursor)
    batch = (page_fn or _query_candidate_batch)(mf, cursor=decoded_cursor, limit=limit)
    seen_count = (decoded_cursor.seen_count if decoded_cursor else 0) + len(batch.items)
    if decoded_cursor:
        total_count = (
            max(decoded_cursor.total_count, seen_count + 1)
            if batch.has_more
            else seen_count
        )
    else:
        total_count = (count_fn or count_candidates)(mf)
        if batch.has_more:
            total_count = max(total_count, seen_count + 1)
        else:
            total_count = seen_count
    next_cursor = (
        replace(
            batch.last_cursor,
            total_count=total_count,
            seen_count=seen_count,
        )
        if batch.has_more and batch.last_cursor
        else None
    )
    return CandidatePage(
        items=batch.items,
        total_count=total_count,
        has_more=batch.has_more,
        next_cursor=_encode_cursor(next_cursor) if next_cursor else None,
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
