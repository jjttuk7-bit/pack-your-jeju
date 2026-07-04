"""fallback 4분기 판정 + 항목별 배지 (TRUST_ENGINE.md §2·§3).

인식론 규칙:
  - coverage_gap은 절대 "없다"고 단언하지 않는다.
  - contradicted만 적극 진술 허용.
  - retrieval_miss는 사용자에게 노출되지 않지만 관측용 로그에 남긴다 (Q2 결정).

판정 순서 (moment당):
  0. contradicted 앵커가 질의에 직접 매칭되면 → contradicted 섹션 반환 (Day2에선 스텁: 앵커 미구현)
  1. strict 검색 후보 있음 → 항목별 배지
  2. 없음 → relaxed 재시도 (retrieval_miss로 관측 로그에만 기록)
  3. relaxed도 없음 → coverage_gap
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from apps.api.engine.filters import MomentFilter
from apps.api.engine.search import (
    PlaceHit,
    TransitCheck,
    search_relaxed,
    search_strict,
    transit_check,
)

# ---- 결과 타입 ----

Badge = str  # verified | caution | contradicted | reference | coverage_gap
Reason = str  # out_of_scope | contradicted | retrieval_miss | coverage_gap


@dataclass(frozen=True)
class BadgedItem:
    name: str
    badge: Badge
    external_id: str
    sources: list[dict]
    freshness: dict
    transit: dict
    note: str | None = None  # 완화 검색 결과 등 부가 설명


@dataclass(frozen=True)
class Fallback:
    reason: Reason
    message: str
    stats: dict | None = None


@dataclass(frozen=True)
class Section:
    moment: str
    items: list[BadgedItem]
    fallback: Fallback | None
    observed_reasons: list[Reason]  # 관측용 (retrieval_miss가 recovery된 경우 포함)


# ---- 사용자 문구 (TRUST_ENGINE §2) ----

MSG_COVERAGE_GAP = "저희가 참조하는 공공데이터 기준으로 확인되지 않습니다."
MSG_CONTRADICTED = "폐업/변경이 확인됩니다."
MSG_OUT_OF_SCOPE = "제주 여행 정보 범위 밖입니다."


# ---- 배지 판정 ----

def badge_item(
    hit: PlaceHit,
    mf: MomentFilter,
    *,
    now: datetime,
    note: str | None = None,
) -> BadgedItem:
    """단일 place에 대해 배지 결정 (TRUST_ENGINE §3).

    caution 사유가 복수일 수 있다 (수정요청 이력 + kids 결측 등).
    "결측 자체를 신호로 드리는 게 정직한 방식" (MOMENT_CARDS 동행자 규칙)에
    맞춰 여러 사유를 note에 모두 담는다.
    """
    badge: Badge
    reasons: list[str] = []
    trip_end_dt = datetime.combine(mf.trip_end, datetime.min.time(), tzinfo=timezone.utc)

    if hit.tombstoned:
        badge = "contradicted"
        reasons.append("폐업/이전 확인")
    else:
        # 여러 caution 사유를 병합 수집
        if hit.valid_until <= trip_end_dt:
            reasons.append("정보 유효기간 경과/임박")
        if hit.has_fix_request:
            reasons.append("이용자 정보 수정요청 이력")
        if _missing_required_amenity(hit, mf):
            key = mf.required_amenities[0]
            reasons.append(f"{key} 관련 정보 미확인")
        badge = "caution" if reasons else "verified"
    reason = " · ".join(reasons) if reasons else None

    freshness = {
        "info_type": hit.info_type,
        "valid_until": hit.valid_until.isoformat() if hit.valid_until else None,
    }
    sources: list[dict] = []
    if hit.source_url:
        sources.append({"name": "비짓제주", "url": hit.source_url})

    t = transit_check(hit.lat, hit.lng)
    transit = {
        "parking": t.parking,
        "parking_count": t.parking_count,
        "bus_walkable": t.bus_walkable,
    }

    display_note = note
    if reason and not display_note:
        display_note = reason
    elif reason and display_note:
        display_note = f"{display_note} · {reason}"

    return BadgedItem(
        name=hit.name,
        badge=badge,
        external_id=hit.external_id,
        sources=sources,
        freshness=freshness,
        transit=transit,
        note=display_note,
    )


def _missing_required_amenity(hit: PlaceHit, mf: MomentFilter) -> bool:
    """companion 요구 amenity 결측 감지. 결측 시 caution 하향 (MOMENT_CARDS 동행자 규칙)."""
    for key in mf.required_amenities:
        val = hit.amenities.get(key) if isinstance(hit.amenities, dict) else None
        if val is None or val is False:
            return True
    return False


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---- 섹션 판정 (fallback 4분기) ----

# 완화 재시도 후에도 뭐가 있는지 없는지가 커버리지 판정의 근거.
# 지역·카테고리별 stats는 로그와 응답에 첨부해 "왜 없다고 했는지"를 관측 가능하게 한다.


def judge_section(
    mf: MomentFilter,
    *,
    limit: int = 3,
    strict_fn: Callable[[MomentFilter, int], list[PlaceHit]] = None,
    relaxed_fn: Callable[[MomentFilter, int], list[PlaceHit]] = None,
) -> Section:
    now = datetime.now(timezone.utc)
    strict = (strict_fn or _strict_default)(mf, limit)

    if strict:
        items = [badge_item(h, mf, now=now) for h in strict]
        return Section(moment=mf.moment, items=items, fallback=None, observed_reasons=[])

    # strict 실패 → relaxed 재시도 (retrieval_miss 관측용 기록)
    relaxed = (relaxed_fn or _relaxed_default)(mf, limit)
    if relaxed:
        items = [
            badge_item(h, mf, now=now, note="인근 지역 결과")
            for h in relaxed
        ]
        return Section(
            moment=mf.moment,
            items=items,
            fallback=None,
            observed_reasons=["retrieval_miss"],
        )

    # 여전히 없음 → coverage_gap
    return Section(
        moment=mf.moment,
        items=[],
        fallback=Fallback(
            reason="coverage_gap",
            message=MSG_COVERAGE_GAP,
            stats={
                "region": mf.region,
                "primary_category": mf.primary_category,
            },
        ),
        observed_reasons=["coverage_gap"],
    )


def _strict_default(mf: MomentFilter, limit: int) -> list[PlaceHit]:
    return search_strict(mf, limit=limit)


def _relaxed_default(mf: MomentFilter, limit: int) -> list[PlaceHit]:
    return search_relaxed(mf, limit=limit)
