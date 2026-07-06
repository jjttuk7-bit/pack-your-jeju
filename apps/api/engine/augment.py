"""폼 필드 증강 (Phase E) — 사용자가 채운 값을 데이터 근거로 확장 제안.

원칙 (CLAUDE.md):
  - 규칙 1: 카운트·조합 계산은 결정적 SQL. LLM은 이유 문구(reason)만.
  - 규칙 3: 없는 조합은 'coverage_gap' 톤 유지 ('없다' 단언 금지).
  - 규칙 6: LLM 없어도 제안은 나오게 (카운트 문구 템플릿 폴백).

제안 종류:
  add_region:      인접 지역에 선택된 순간들이 얼마나 있는지 → 추가 제안
  add_moment:      동행자·목적 기반 어울리는 순간 중 verified 많은 것 → 추가 제안
  tune_purpose:    동행자와 자주 함께 나오는 목적 미매칭 시 튜닝 제안
  hint_note_tag:   special_notes 힌트 (v1에는 없음, 확장 여지)

호출 흐름:
  form_state → 필드 검증 → 각 종류별 후보 수집 → 근거 계산 (SQL COUNT) →
  Top-K 필터 → (선택) LLM 이유 문구 → 응답
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from sqlalchemy import text

from apps.api import db
from apps.api.engine import filters as filters_mod
from apps.api.engine import haruban as haruban_mod  # 라벨 매핑 재활용
from apps.api.engine import llm


# ─── 매핑 상수 ─────────────────────────

REGION_LABEL_KO = haruban_mod.REGION_LABEL_KO
MOMENT_LABEL_KO = haruban_mod.MOMENT_LABEL_KO
COMPANION_LABEL_KO = haruban_mod.COMPANION_LABEL_KO
PURPOSE_LABEL_KO = haruban_mod.PURPOSE_LABEL_KO

# 인접 지역 매핑 (search.REGION_GROUP과 별개 — 여기선 '함께 다니기 좋은' 조합 관점)
NEIGHBOR_REGIONS: dict[str, tuple[str, ...]] = {
    "jeju_city": ("aewol", "jocheon"),
    "aewol":     ("jeju_city", "hallim"),
    "hallim":    ("aewol",),
    "jocheon":   ("jeju_city", "gujwa"),
    "gujwa":     ("jocheon", "seongsan", "udo"),
    "seongsan":  ("gujwa", "pyoseon"),
    "udo":       ("gujwa",),
    "pyoseon":   ("seongsan", "namwon"),
    "namwon":    ("pyoseon", "seogwipo"),
    "seogwipo":  ("namwon", "andeok"),
    "andeok":    ("seogwipo", "daejeong"),
    "daejeong":  ("andeok",),
}

# 동행자 × 목적 조합 → 어울리는 순간 힌트 (경험적, 발표 기준 · 폼 스코프 안).
# 카드 매핑이 자연스러운 조합만.
AFFINITY: dict[tuple[str, str], tuple[str, ...]] = {
    ("couple", "healing"):     ("quiet_cafe", "sunset", "gotjawal"),
    ("couple", "sightseeing"): ("sunset", "oreum", "quiet_cafe"),
    ("couple", "food"):        ("local_food", "quiet_cafe", "local_market"),
    ("family", "sightseeing"): ("oreum", "beach_walk", "local_market"),
    ("family", "healing"):     ("beach_walk", "gotjawal", "quiet_cafe"),
    ("kids",   "sightseeing"): ("beach_walk", "citrus", "oreum"),
    ("kids",   "activity"):    ("beach_walk", "oreum", "citrus"),
    ("parents","healing"):     ("quiet_cafe", "beach_walk", "local_market"),
    ("parents","food"):        ("local_food", "local_market", "quiet_cafe"),
    ("solo",   "healing"):     ("quiet_cafe", "gotjawal", "sunset"),
    ("solo",   "sightseeing"): ("oreum", "sunset", "gotjawal"),
    ("friend", "food"):        ("local_food", "local_market", "quiet_cafe"),
    ("friend", "activity"):    ("beach_walk", "oreum", "citrus"),
}


# ─── 응답 타입 ─────────────────────────

@dataclass(frozen=True)
class Suggestion:
    field: str            # 'regions' | 'moments' | 'purpose'
    kind: str             # 'add' | 'tune'
    values: list[str]     # 폼에 반영할 값들 (지역 코드 · 순간 id · purpose id)
    labels: list[str]     # 사용자 노출 라벨
    reason: str           # 이유 (LLM 있으면 자연문, 없으면 템플릿)
    counts: dict          # 근거 카운트 (verified/total 등)


@dataclass(frozen=True)
class AugmentResult:
    available: bool
    suggestions: list[Suggestion] = field(default_factory=list)
    llm_used: bool = False
    reason: str = ""


# ─── SQL 근거 계산 ─────────────────────

def _count_by_region_moments(regions: Iterable[str], moments: Iterable[str]) -> dict[str, dict]:
    """각 region에서 (선택된 moments의 primary_category ANY) verified 후보 카운트.

    반환: {region: {"total": N, "categories": {cat: n, ...}}}
    """
    regions = list(regions)
    if not regions:
        return {}
    categories = [
        filters_mod.MOMENT_TO_CATEGORY[m]
        for m in moments if m in filters_mod.MOMENT_TO_CATEGORY
    ]

    out: dict[str, dict] = {r: {"total": 0, "categories": {}} for r in regions}
    engine = db.get_engine()
    with engine.connect() as conn:
        if categories:
            rows = conn.execute(
                text(
                    "SELECT region_normalized AS region, category, COUNT(*) AS n "
                    "  FROM place "
                    " WHERE tombstoned=false "
                    "   AND region_normalized = ANY(:regions) "
                    "   AND category = ANY(:categories) "
                    " GROUP BY region_normalized, category"
                ),
                {"regions": regions, "categories": categories},
            ).all()
            for row in rows:
                r = row.region
                out[r]["total"] += int(row.n)
                out[r]["categories"][row.category] = int(row.n)
        else:
            # moments 없이 호출된 경우 — 전체 카운트만
            rows = conn.execute(
                text(
                    "SELECT region_normalized AS region, COUNT(*) AS n "
                    "  FROM place "
                    " WHERE tombstoned=false AND region_normalized = ANY(:regions) "
                    " GROUP BY region_normalized"
                ),
                {"regions": regions},
            ).all()
            for row in rows:
                out[row.region]["total"] = int(row.n)
    return out


def _count_by_moment(regions: Iterable[str], moment: str) -> int:
    """특정 (regions × moment)에서 verified 후보 카운트."""
    cat = filters_mod.MOMENT_TO_CATEGORY.get(moment)
    if not cat:
        return 0
    regions = list(regions)
    if not regions:
        return 0
    engine = db.get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT COUNT(*) AS n "
                "  FROM place "
                " WHERE tombstoned=false "
                "   AND region_normalized = ANY(:regions) "
                "   AND category = :category"
            ),
            {"regions": regions, "category": cat},
        ).first()
    return int(row.n) if row else 0


# ─── 제안 생성 로직 ────────────────────

_MIN_CANDIDATES_FOR_ADD = 2  # verified 후보가 이 이상일 때만 추가 제안


def _suggest_add_regions(
    picked_regions: list[str],
    picked_moments: list[str],
) -> list[Suggestion]:
    """선택 지역의 이웃에서 순간 후보가 충분히 많으면 추가 제안."""
    if not picked_regions or not picked_moments:
        return []

    # 이웃 지역 후보 (선택 지역들의 이웃 합집합 − 이미 선택)
    picked_set = set(picked_regions)
    neighbors: set[str] = set()
    for r in picked_regions:
        for n in NEIGHBOR_REGIONS.get(r, ()):
            if n not in picked_set:
                neighbors.add(n)
    if not neighbors:
        return []

    counts = _count_by_region_moments(sorted(neighbors), picked_moments)

    # 각 이웃 지역별 개별 제안. total이 임계 이상만 채택.
    suggestions: list[Suggestion] = []
    for region, info in counts.items():
        total = info.get("total", 0)
        if total < _MIN_CANDIDATES_FOR_ADD:
            continue
        region_ko = REGION_LABEL_KO.get(region, region)
        moments_ko = " · ".join(MOMENT_LABEL_KO.get(m, m) for m in picked_moments)
        suggestions.append(Suggestion(
            field="regions",
            kind="add",
            values=[region],
            labels=[region_ko],
            reason=(
                f"{region_ko}에서도 {moments_ko} 관련 {total}곳이 저희 데이터에서 확인돼요."
            ),
            counts={"total": total, "by_category": info.get("categories", {})},
        ))

    # total 순 정렬 후 상위 2개.
    suggestions.sort(key=lambda s: s.counts.get("total", 0), reverse=True)
    return suggestions[:2]


def _suggest_add_moments(
    picked_regions: list[str],
    picked_moments: list[str],
    companion: str,
    purpose: str,
) -> list[Suggestion]:
    """AFFINITY에서 순간 후보를 뽑아, 사용자 지역에 verified 후보가 있으면 제안."""
    affinity = AFFINITY.get((companion, purpose)) or ()
    candidates = [m for m in affinity if m not in set(picked_moments)]
    if not candidates or not picked_regions:
        return []

    suggestions: list[Suggestion] = []
    for m in candidates:
        n = _count_by_moment(picked_regions, m)
        if n < _MIN_CANDIDATES_FOR_ADD:
            continue
        moment_ko = MOMENT_LABEL_KO.get(m, m)
        companion_ko = COMPANION_LABEL_KO.get(companion, companion)
        purpose_ko = PURPOSE_LABEL_KO.get(purpose, purpose)
        regions_ko = " · ".join(REGION_LABEL_KO.get(r, r) for r in picked_regions)
        suggestions.append(Suggestion(
            field="moments",
            kind="add",
            values=[m],
            labels=[moment_ko],
            reason=(
                f"{companion_ko} {purpose_ko} 조합에는 {moment_ko}도 자주 함께 나와요. "
                f"{regions_ko}에 {n}곳 확인됐어요."
            ),
            counts={"total": n},
        ))
    # count 순 상위 2.
    suggestions.sort(key=lambda s: s.counts.get("total", 0), reverse=True)
    return suggestions[:2]


def _refine_reasons_with_llm(suggestions: list[Suggestion]) -> tuple[list[Suggestion], bool]:
    """LLM으로 reason 톤만 다듬음. 실패하거나 미가용이면 원문 유지.

    LLM은 절대로 새 사실을 넣지 않는다 — labels/counts는 이미 결정적으로 계산됨.
    프롬프트에 '주어진 카운트와 라벨 밖의 이름·수치 지어내지 마라' 명시.
    """
    if not suggestions or not llm.is_available():
        return suggestions, False

    import json as _json
    payload = {
        "suggestions": [
            {
                "field": s.field,
                "labels": s.labels,
                "counts": s.counts,
                "current_reason": s.reason,
            }
            for s in suggestions
        ]
    }
    system = (
        "너는 '하루방'이다. 제주 여행 준비 서비스의 조언자.\n"
        "말투: 부드러운 존댓말, 한두 문장, 이모지 없이.\n\n"
        "역할: 아래 JSON의 각 suggestion에 대해 current_reason을 자연스러운\n"
        "한국어 한두 문장으로 다듬어라.\n"
        "절대 규칙:\n"
        "- counts와 labels 안의 숫자·이름 밖으로 지어내지 마라.\n"
        "- '가장 좋은' 같은 단정 대신 '저희 데이터에 확인된' 톤 유지.\n"
        "- 반드시 아래 JSON 스키마 그대로 반환:\n"
        '{"refined": ["문장1", "문장2", ...]}\n'
        "  · 배열 순서는 입력 suggestions 순서와 동일.\n"
        "  · 배열 길이도 동일."
    )
    user = "다음 JSON에 근거해서만 답하라:\n" + _json.dumps(payload, ensure_ascii=False, indent=2)

    resp = llm.complete(system=system, user=user, max_completion_tokens=500, temperature=0.3)
    if not resp.available or not resp.text:
        return suggestions, False

    text_out = resp.text.strip()
    if text_out.startswith("```"):
        text_out = text_out.strip("`")
        if text_out.startswith("json"):
            text_out = text_out[4:]
        text_out = text_out.strip()

    try:
        parsed = _json.loads(text_out)
        refined = parsed.get("refined") or []
        if not isinstance(refined, list) or len(refined) != len(suggestions):
            return suggestions, False
    except _json.JSONDecodeError:
        return suggestions, False

    out: list[Suggestion] = []
    for s, r in zip(suggestions, refined):
        if isinstance(r, str) and r.strip():
            out.append(Suggestion(
                field=s.field, kind=s.kind,
                values=s.values, labels=s.labels,
                reason=r.strip(), counts=s.counts,
            ))
        else:
            out.append(s)
    return out, True


# ─── 퍼블릭 진입점 ─────────────────────

def build_augment(form_state: dict) -> AugmentResult:
    """폼 상태 → 필드별 증강 제안 리스트.

    Phase D(build_intro)와 달리 항상 시도 — 트리거는 프론트 debounce 담당.
    """
    regions_raw = form_state.get("regions") or (
        [form_state["region"]] if form_state.get("region") else []
    )
    regions = [r for r in regions_raw if r in filters_mod.REGIONS]
    moments = [
        m for m in (form_state.get("moments") or [])
        if m in filters_mod.MOMENT_TO_CATEGORY
    ]
    companion = form_state.get("companion") or ""
    purpose = form_state.get("purpose") or ""

    all_suggestions: list[Suggestion] = []
    all_suggestions.extend(_suggest_add_regions(regions, moments))
    all_suggestions.extend(_suggest_add_moments(regions, moments, companion, purpose))

    if not all_suggestions:
        return AugmentResult(available=True, suggestions=[], llm_used=False)

    refined, llm_used = _refine_reasons_with_llm(all_suggestions)
    return AugmentResult(available=True, suggestions=refined, llm_used=llm_used)
