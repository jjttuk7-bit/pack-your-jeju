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

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from apps.api.engine import fix_requests, visit_signals
from apps.api.engine.filters import MomentFilter
from apps.api.engine.search import (
    PlaceHit,
    TransitCheck,
    search_candidate_page,
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
    note: str | None = None                  # 완화 검색 결과 등 부가 설명
    region_normalized: str = ""              # 지역별 요일 그룹핑에 사용 (assemble.dispatch_itinerary)
    # 상세 확장 UI에서 노출 — 근거 있는 값만. 결측은 None으로 두어 프론트가 '미확인' 표기.
    address: str | None = None
    category: str = ""
    lat: float | None = None
    lng: float | None = None
    amenities: dict = field(default_factory=dict)
    hygiene_grade: str | None = None
    trust_score: int = 0
    score_breakdown: dict = field(default_factory=dict)
    check_required: list[str] = field(default_factory=list)
    fix_request: dict | None = None


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
    total_count: int | None = None
    next_cursor: str | None = None


@dataclass(frozen=True)
class TrustProfile:
    score: int
    breakdown: dict
    check_required: list[str]


# ---- 사용자 문구 (TRUST_ENGINE §2) ----

MSG_COVERAGE_GAP = "저희가 참조하는 공공데이터 기준으로 확인되지 않습니다."
MSG_CONTRADICTED = "폐업/변경이 확인됩니다."
MSG_OUT_OF_SCOPE = "제주 여행 정보 범위 밖입니다."

# amenity key(내부 필터 키) → 사용자 노출 한글 라벨.
# 필터 로직은 여전히 영어 key로 판단하고, note 생성 시에만 라벨 치환.
_AMENITY_KO: dict[str, str] = {
    "kids":          "아이 동반",
    "accessibility": "접근성",
    "parking":       "주차",
}


# ---- 배지 판정 ----

def badge_item(
    hit: PlaceHit,
    mf: MomentFilter,
    *,
    now: datetime,
    note: str | None = None,
    weather_snapshot: dict | None = None,
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
            label = _AMENITY_KO.get(key, key)
            reasons.append(f"{label} 관련 정보 미확인")
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
    profile = compute_trust_profile(
        hit,
        mf,
        transit=t,
        now=now,
        visit_signal=visit_signals.latest_visit_signal(hit.external_id),
        weather_snapshot=weather_snapshot,
    )

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
        region_normalized=hit.region_normalized or "",
        address=hit.address,
        category=hit.category,
        lat=hit.lat,
        lng=hit.lng,
        amenities=hit.amenities if isinstance(hit.amenities, dict) else {},
        hygiene_grade=hit.hygiene_grade,
        trust_score=profile.score,
        score_breakdown=profile.breakdown,
        check_required=profile.check_required,
        fix_request=fix_requests.fetch_fix_request_summary(hit.external_id) if hit.has_fix_request else None,
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


def _weather_meta(weather_snapshot: dict | None) -> dict:
    if not weather_snapshot:
        return {}
    meta: dict = {
        "provider": weather_snapshot.get("provider"),
        "risk_level": weather_snapshot.get("risk_level"),
        "signals": list(weather_snapshot.get("signals") or []),
        "labels": list(weather_snapshot.get("labels") or []),
        "issued_at_label": weather_snapshot.get("issued_at_label"),
    }
    summary = weather_snapshot.get("summary")
    if summary:
        meta["summary"] = str(summary)
    return {k: v for k, v in meta.items() if v not in (None, [], "")}


def _weather_score(weather_snapshot: dict | None) -> tuple[int, str, dict]:
    meta = _weather_meta(weather_snapshot)
    if not weather_snapshot or not weather_snapshot.get("available"):
        return 10, "weather_check_required", meta

    risk_level = str(weather_snapshot.get("risk_level") or "normal")
    signals = set(str(s) for s in (weather_snapshot.get("signals") or []))
    if risk_level == "normal" and not signals:
        return 15, "weather_clear", meta

    if signals & {"heavy_rain", "wind", "wave", "fog", "snow"}:
        return 6, "weather_risk_caution", meta
    if signals & {"rain", "heat"}:
        return 9, "weather_watch", meta
    return 10, "weather_check_required", meta


def compute_trust_profile(
    hit: PlaceHit,
    mf: MomentFilter,
    *,
    transit: TransitCheck,
    now: datetime,
    visit_signal: dict | None = None,
    weather_snapshot: dict | None = None,
) -> TrustProfile:
    """제안서 100점 루브릭의 규칙 기반 MVP.

    점수는 새 사실을 만들지 않고, DB 필드·교통 검증·방문 신호만 사용한다.
    날씨는 기상청 API허브 예보 신호가 있으면 야외 카테고리 점수에 반영하고,
    없거나 실패하면 야외 카테고리에 "확인 필요"를 남기는 보수적 점수다.
    """
    check_required: list[str] = []
    trip_end_dt = datetime.combine(mf.trip_end, datetime.min.time(), tzinfo=timezone.utc)
    valid_until = _to_utc(hit.valid_until)

    if hit.tombstoned:
        public_points = 0
        public_status = "contradicted"
        check_required.append("public_data")
    elif hit.has_fix_request:
        public_points = 18
        public_status = "fix_request"
        check_required.append("public_data")
    else:
        public_points = 30
        public_status = "matched"

    missing_user_condition = _missing_required_amenity(hit, mf)
    if missing_user_condition:
        user_points = 8
        user_status = "missing_required_amenity"
        check_required.append("user_condition")
    else:
        user_points = 20
        user_status = "matched"

    outdoor_categories = {"oreum", "beach", "viewpoint", "forest", "experience"}
    is_outdoor = hit.category in outdoor_categories
    weather_meta: dict = {}
    if is_outdoor:
        weather_points, weather_status, weather_meta = _weather_score(weather_snapshot)
        if weather_status != "weather_clear":
            check_required.append("weather")
        for signal in weather_meta.get("signals", []):
            if signal in {"wind", "wave", "heavy_rain", "fog", "heat", "snow"}:
                check_required.append(f"weather:{signal}")
    else:
        weather_points = 15
        weather_status = "low_weather_dependency"
        weather_meta = _weather_meta(weather_snapshot)

    if transit.parking or transit.bus_walkable:
        movement_points = 10
        movement_status = "reachable"
    else:
        movement_points = 4
        movement_status = "access_unconfirmed"
        check_required.append("movement")

    if valid_until <= trip_end_dt:
        operation_points = 3
        operation_status = "expired_or_due"
        check_required.append("operation_info")
    elif hit.info_type in {"periodic", "seasonal"}:
        operation_points = 8
        operation_status = "date_rule_required"
    else:
        operation_points = 10
        operation_status = "valid"

    visit_status = str((visit_signal or {}).get("status") or "no_signal")
    if visit_status in {"visited", "satisfied"}:
        visit_points = 10
    elif visit_status == "not_visited":
        visit_points = 4
        check_required.append("visit_feedback")
    elif visit_status in {"changed", "info_mismatch", "unsatisfied"}:
        visit_points = 0
        check_required.append("visit_feedback")
    else:
        visit_points = 5

    recency_days = (valid_until - now).days
    if recency_days >= 30:
        recency_points = 5
        recency_status = "fresh"
    elif recency_days >= 0:
        recency_points = 2
        recency_status = "near_expiry"
        check_required.append("recency")
    else:
        recency_points = 0
        recency_status = "expired"
        check_required.append("recency")

    breakdown = {
        "public_data_match": {
            "points": public_points,
            "max": 30,
            "status": public_status,
        },
        "user_condition_fit": {
            "points": user_points,
            "max": 20,
            "status": user_status,
        },
        "weather_fit": {
            "points": weather_points,
            "max": 15,
            "status": weather_status,
            **weather_meta,
        },
        "movement_feasibility": {
            "points": movement_points,
            "max": 10,
            "status": movement_status,
        },
        "operation_info": {
            "points": operation_points,
            "max": 10,
            "status": operation_status,
        },
        "visit_signal": {
            "points": visit_points,
            "max": 10,
            "status": visit_status,
        },
        "recency": {
            "points": recency_points,
            "max": 5,
            "status": recency_status,
        },
    }
    score = sum(int(v["points"]) for v in breakdown.values())
    if hit.tombstoned:
        score = min(score, 40)
    return TrustProfile(
        score=max(0, min(100, score)),
        breakdown=breakdown,
        check_required=list(dict.fromkeys(check_required)),
    )


# ---- 섹션 판정 (fallback 4분기) ----

# 완화 재시도 후에도 뭐가 있는지 없는지가 커버리지 판정의 근거.
# 지역·카테고리별 stats는 로그와 응답에 첨부해 "왜 없다고 했는지"를 관측 가능하게 한다.


def judge_section(
    mf: MomentFilter,
    *,
    limit: int = 5,
    strict_fn: Callable[[MomentFilter, int], list[PlaceHit]] = None,
    relaxed_fn: Callable[[MomentFilter, int], list[PlaceHit]] = None,
    weather_snapshot: dict | None = None,
) -> Section:
    now = datetime.now(timezone.utc)
    strict = (strict_fn or _strict_default)(mf, limit)
    uses_default_search = strict_fn is None and relaxed_fn is None

    if strict:
        items = [badge_item(h, mf, now=now, weather_snapshot=weather_snapshot) for h in strict]
        observed_reasons: list[str] = []
        if len(items) < limit:
            relaxed = (relaxed_fn or _relaxed_default)(mf, limit)
            seen = {h.external_id for h in strict}
            topups = [h for h in relaxed if h.external_id not in seen]
            if topups:
                observed_reasons.append("retrieval_miss")
                items.extend(
                    badge_item(
                        h,
                        mf,
                        now=now,
                        note="인근 지역 결과",
                        weather_snapshot=weather_snapshot,
                    )
                    for h in topups[: max(0, limit - len(items))]
                )
        page = search_candidate_page(mf, limit=limit) if uses_default_search else None
        return Section(
            moment=mf.moment,
            items=items,
            fallback=None,
            observed_reasons=observed_reasons,
            total_count=page.total_count if page else len(items),
            next_cursor=page.next_cursor if page else None,
        )

    # strict 실패 → relaxed 재시도 (retrieval_miss 관측용 기록)
    relaxed = (relaxed_fn or _relaxed_default)(mf, limit)
    if relaxed:
        items = [
            badge_item(h, mf, now=now, note="인근 지역 결과", weather_snapshot=weather_snapshot)
            for h in relaxed
        ]
        page = search_candidate_page(mf, limit=limit) if uses_default_search else None
        return Section(
            moment=mf.moment,
            items=items,
            fallback=None,
            observed_reasons=["retrieval_miss"],
            total_count=page.total_count if page else len(items),
            next_cursor=page.next_cursor if page else None,
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
        total_count=0,
        next_cursor=None,
    )


def _strict_default(mf: MomentFilter, limit: int) -> list[PlaceHit]:
    return search_strict(mf, limit=limit)


def _relaxed_default(mf: MomentFilter, limit: int) -> list[PlaceHit]:
    return search_relaxed(mf, limit=limit)
