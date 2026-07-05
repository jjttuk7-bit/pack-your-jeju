"""폼 입력 → 검색 필터 변환.

핵심 원칙 (CLAUDE.md 절대 규칙 1):
  LLM을 쓰지 않는다. 폼이 이미 구조화 필터를 제공하므로 매핑 테이블로 충분하다.

매핑 근거:
  - region: 지역 선택 UI 12값이 place.region_normalized와 1:1 (D-10, PRD §3).
  - moment→category: MOMENT_CARDS.md 표.
  - purpose→category: DECISIONS 논의로 확정된 초안 (완화 시그널로만 사용, 카드 선택보다 약함).
  - companion→required_amenities: 있으면 caution 하향, 조용히 빼지 않음 (MOMENT_CARDS §동행자).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

Region = str
Category = str
Companion = str
Purpose = str
CardId = str

REGIONS: tuple[Region, ...] = (
    "jeju_city", "seogwipo", "aewol", "hallim", "seongsan", "jocheon",
    "gujwa", "andeok", "daejeong", "pyoseon", "namwon", "udo",
)

MOMENT_TO_CATEGORY: dict[CardId, Category] = {
    "oreum": "oreum",
    "beach_walk": "beach",
    "sunset": "viewpoint",
    "local_market": "market",
    "local_food": "food",
    "quiet_cafe": "cafe",
    "gotjawal": "forest",
    "citrus": "experience",
}

# purpose는 카드 선택을 보완하는 완화 시그널.
# 강한 라우팅이 아니라 "카드가 커버하지 못하는 축에서의 취향 힌트"로만 쓴다.
PURPOSE_TO_CATEGORIES: dict[Purpose, tuple[Category, ...]] = {
    "healing":     ("forest", "cafe", "viewpoint", "beach"),
    "sightseeing": ("oreum", "beach", "viewpoint", "market", "forest"),
    "food":        ("food", "market"),
    "activity":    ("oreum", "beach", "experience"),
    "hocance":     ("cafe", "viewpoint"),
}

# companion → 항목별 배지 판정 시 결측이면 caution ⚠️로 하향할 amenity 키.
# 요구 amenity가 없다고 "조용히 빼지 않는다" (MOMENT_CARDS §동행자 규칙).
COMPANION_REQUIRED_AMENITIES: dict[Companion, tuple[str, ...]] = {
    "solo":    (),
    "couple":  (),
    "friend":  (),
    "family":  ("kids",),           # family = kids+parents 완화 버전
    "kids":    ("kids",),
    "parents": ("accessibility",),  # 오름 난이도/포장 정보 등
}


@dataclass(frozen=True)
class PackRequest:
    """PRD.md §4 /pack 요청 스키마.

    regions는 1개 이상. 여러 지역 선택 시 dispatch_itinerary가 요일별로 그룹핑한다.
    backward compat: `region` 단일 문자열도 허용 (regions=[region]으로 정규화).
    """
    regions: tuple[Region, ...]
    start_date: date
    days: int
    companion: Companion
    purpose: Purpose
    moments: tuple[CardId, ...]

    @property
    def region(self) -> Region:
        """대표 지역 (첫 번째). 하위 호환 필드."""
        return self.regions[0] if self.regions else ""

    @classmethod
    def from_dict(cls, data: dict) -> "PackRequest":
        # backward compat: `region: str` 단일 필드도 허용
        raw = data.get("regions")
        if raw is None:
            single = data.get("region")
            raw = [single] if single else []
        regions = tuple(str(r) for r in raw if r)
        if not regions:
            raise ValueError("regions or region required")
        return cls(
            regions=regions,
            start_date=date.fromisoformat(data["start_date"]),
            days=int(data["days"]),
            companion=data["companion"],
            purpose=data["purpose"],
            moments=tuple(data["moments"]),
        )


@dataclass(frozen=True)
class MomentFilter:
    """moment 하나당 만들어지는 검색 필터.

    regions는 검색 대상 지역들 (1개 이상). search_strict는 이 목록 전체를,
    search_relaxed는 각 region을 상위 시권으로 확장한 합집합을 사용한다.
    """
    moment: CardId
    primary_category: Category           # 카드 매핑 카테고리 (강한 신호)
    supporting_categories: tuple[Category, ...]  # purpose 완화 시그널 (약한 신호)
    regions: tuple[Region, ...]
    trip_start: date
    trip_end: date                       # inclusive
    required_amenities: tuple[str, ...]  # 결측 시 caution 하향용

    @property
    def region(self) -> Region:
        return self.regions[0] if self.regions else ""


@dataclass(frozen=True)
class Filters:
    """/pack 전체 요청에 대한 필터 집합."""
    regions: tuple[Region, ...]
    trip_start: date
    trip_end: date
    companion: Companion
    purpose: Purpose
    per_moment: tuple[MomentFilter, ...] = field(default_factory=tuple)


class UnknownRegion(ValueError):
    pass


class UnknownMoment(ValueError):
    pass


class UnknownCompanion(ValueError):
    pass


class UnknownPurpose(ValueError):
    pass


def build_filters(req: PackRequest) -> Filters:
    for r in req.regions:
        if r not in REGIONS:
            raise UnknownRegion(r)
    if req.companion not in COMPANION_REQUIRED_AMENITIES:
        raise UnknownCompanion(req.companion)
    if req.purpose not in PURPOSE_TO_CATEGORIES:
        raise UnknownPurpose(req.purpose)
    if req.days < 1:
        raise ValueError(f"days must be >= 1, got {req.days}")

    # trip_end는 inclusive: days=1이면 당일치기 (start == end).
    trip_end = req.start_date + timedelta(days=req.days - 1)
    required = COMPANION_REQUIRED_AMENITIES[req.companion]
    purpose_categories = PURPOSE_TO_CATEGORIES[req.purpose]

    moment_filters: list[MomentFilter] = []
    for card_id in req.moments:
        primary = MOMENT_TO_CATEGORY.get(card_id)
        if primary is None:
            raise UnknownMoment(card_id)
        # 카드 카테고리 자체는 supporting에서 제외 (중복 방지)
        supporting = tuple(c for c in purpose_categories if c != primary)
        moment_filters.append(MomentFilter(
            moment=card_id,
            primary_category=primary,
            supporting_categories=supporting,
            regions=req.regions,
            trip_start=req.start_date,
            trip_end=trip_end,
            required_amenities=required,
        ))

    return Filters(
        regions=req.regions,
        trip_start=req.start_date,
        trip_end=trip_end,
        companion=req.companion,
        purpose=req.purpose,
        per_moment=tuple(moment_filters),
    )
