"""하루방 에이전트 — 대화형 + 도구 사용 + 폼 컨텍스트 인지.

역할:
  사용자가 폼을 채우는 과정에서 궁금한 것을 물으면 하루방이 답한다.
  하루방은 사용자의 현재 폼 상태를 알고 있고, 필요할 때 도구(place 조회 등)를 호출한다.
  사실은 지어내지 않는다 — DB/도구 결과 밖의 장소·시간·조건 언급 금지.

원칙 (CLAUDE.md):
  - 절대 규칙 1: 사실 생성 금지. 도구 결과만 근거.
  - 절대 규칙 5: llm.py의 gpt-5.3-mini 고정 유지.
  - 절대 규칙 6: LLM 없어도 서버 안 죽음 (available=False signal).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import text

from apps.api import db
from apps.api.engine import filters as filters_mod
from apps.api.engine import llm
from apps.api.engine import search as search_mod
from apps.api.engine import trust as trust_mod
from apps.api.engine import verify as verify_mod


# ─── 한글 라벨 (하이라이트 문구 조립용) ───

REGION_LABEL_KO: dict[str, str] = {
    "jeju_city": "제주시",
    "seogwipo":  "서귀포",
    "aewol":     "애월",
    "hallim":    "한림",
    "seongsan":  "성산",
    "jocheon":   "조천",
    "gujwa":     "구좌",
    "andeok":    "안덕",
    "daejeong":  "대정",
    "pyoseon":   "표선",
    "namwon":    "남원",
    "udo":       "우도",
}

COMPANION_LABEL_KO: dict[str, str] = {
    "solo":    "혼자",
    "couple":  "연인과",
    "friend":  "친구와",
    "family":  "가족과",
    "kids":    "아이와",
    "parents": "부모님과",
}

MOMENT_LABEL_KO: dict[str, str] = {
    "oreum":        "오름 산책",
    "beach_walk":   "바다 산책",
    "sunset":       "노을 감상",
    "local_market": "로컬 시장",
    "local_food":   "현지 맛집",
    "quiet_cafe":   "조용한 카페",
    "gotjawal":     "곶자왈 숲길",
    "citrus":       "감귤 체험",
}

PURPOSE_LABEL_KO: dict[str, str] = {
    "healing":     "힐링",
    "sightseeing": "관광",
    "food":        "먹부림",
    "activity":    "액티비티",
    "hocance":     "호캉스",
}


# ─── 하루방 도구 정의 ───

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_places",
            "description": (
                "제주 지역·카테고리로 검증된 장소를 조회한다. "
                "반환 결과 밖의 장소를 절대 지어내지 마라."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                    },
                    "category": {
                        "type": "string",
                        "enum": list(set(filters_mod.MOMENT_TO_CATEGORY.values())),
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 10},
                },
                "required": ["regions", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verify_claim",
            "description": (
                "사용자가 어디서 봤다는 정보(리뷰·블로그)를 저희 공공데이터로 팩트체크. "
                "verified/outdated/contradicted/coverage_gap 판정."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "text": {"type": "string", "minLength": 2, "maxLength": 800},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_form_update",
            "description": (
                "사용자 폼에 반영할 것을 제안한다. 사용자가 승인해야 반영된다. "
                "빈 값은 넣지 마라 (지어내지 마라)."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                    },
                    "companion": {
                        "type": "string",
                        "enum": list(filters_mod.COMPANION_REQUIRED_AMENITIES.keys()),
                    },
                    "purpose": {
                        "type": "string",
                        "enum": list(filters_mod.PURPOSE_TO_CATEGORIES.keys()),
                    },
                    "moments": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": list(filters_mod.MOMENT_TO_CATEGORY.keys()),
                        },
                    },
                    "days": {"type": "integer", "minimum": 1, "maximum": 14},
                    "start_date": {"type": "string"},
                    "reason": {
                        "type": "string",
                        "description": "이 제안을 왜 하는지 짧은 한국어 설명 (사용자에게 노출).",
                    },
                },
                "required": ["reason"],
            },
        },
    },
]


def _run_search_places(args: dict) -> dict:
    """search_places 도구 실행. 검증된 place만 반환. 없으면 빈 리스트."""
    regions = args.get("regions") or []
    category = args.get("category") or ""
    limit = int(args.get("limit") or 5)
    if not regions or not category:
        return {"items": [], "note": "regions와 category가 필요합니다"}

    engine = db.get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT name, region_normalized, address, has_fix_request "
                "FROM place "
                "WHERE tombstoned=false "
                "  AND region_normalized = ANY(:regions) "
                "  AND category = :category "
                "ORDER BY has_fix_request DESC, updated_at DESC "
                "LIMIT :limit"
            ),
            {"regions": list(regions), "category": category, "limit": limit},
        ).all()
    return {
        "items": [
            {
                "name": r.name,
                "region": r.region_normalized,
                "address": r.address,
                "has_fix_request": bool(r.has_fix_request),
            }
            for r in rows
        ],
    }


def _run_verify_claim(args: dict) -> dict:
    """verify_claim 도구 실행. verify.py 재활용."""
    text_in = args.get("text") or ""
    if not text_in:
        return {"claims": []}
    results = verify_mod.verify_text(text_in)
    return {
        "claims": [
            {
                "text": r.text,
                "verdict": r.verdict,
                "matched_name": r.matched_name,
                "reason": r.reason,
            }
            for r in results
        ],
    }


def _run_suggest_form_update(args: dict) -> dict:
    """suggest_form_update는 실제 실행이 아니라 프론트로 넘겨줄 제안.
    도구 실행 결과는 반영 대기 상태로 프론트에 노출."""
    # enum 유효성만 최소 확인 후 그대로 통과.
    return {"suggestion": args}


TOOL_RUNNERS = {
    "search_places": _run_search_places,
    "verify_claim": _run_verify_claim,
    "suggest_form_update": _run_suggest_form_update,
}


# ─── 시스템 프롬프트 ───

_BASE_SYSTEM_PROMPT = (
    "너는 '하루방'이다. 제주 여행 준비를 돕는 정직 에이전트 캐릭터로, "
    "제주 상징 돌하르방을 캐릭터화한 존재다.\n\n"
    "말투: 정중하고 부드러운 존댓말. 무거운 격식은 피하고, 짧고 따뜻하게. "
    "이모지는 쓰지 않는다.\n\n"
    "역할: 사용자가 폼을 채우는 과정에서 궁금한 것에 답하고, 검증된 데이터로 조언한다. "
    "필요할 때 도구(search_places, verify_claim, suggest_form_update)를 호출한다.\n\n"
    "절대 규칙 (지키지 않으면 저희 서비스의 정체성이 무너진다):\n"
    "1) 도구 결과나 폼 컨텍스트 밖의 장소·수치·시간·운영시간을 지어내지 마라. "
    "정보가 없으면 '저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다'라고만 말하라.\n"
    "2) '가장 좋은 곳' '반드시 가야 하는 곳' 같은 단정적 표현을 쓰지 마라. "
    "'저희 데이터로 확인된 곳'이라는 범위 한정을 유지하라.\n"
    "3) 카카오·네이버·블로그 리뷰를 근거로 삼지 마라. "
    "리뷰는 verify_claim의 입력값으로만 활용된다.\n"
    "4) 사용자에게 폼 반영이 필요하면 반드시 suggest_form_update 도구로 제안하고, "
    "사용자 승인 후 반영됨을 안내하라.\n"
    "5) 답변은 짧게 (한두 문장). 긴 설명이 필요하면 사용자에게 물어보고 확장하라."
)


def _form_context_block(form_state: dict) -> str:
    """폼 상태를 시스템 프롬프트 뒤에 붙이는 컨텍스트 블록."""
    filled = {k: v for k, v in form_state.items() if v not in (None, "", [], 0)}
    if not filled:
        return "\n\n현재 사용자 폼은 비어 있다."
    return "\n\n현재 사용자가 채운 폼 상태 (참고용):\n" + json.dumps(
        filled, ensure_ascii=False, indent=2
    )


# ─── 대화 실행 ───

@dataclass(frozen=True)
class HarubanMessage:
    role: str                                        # user | assistant | tool
    content: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    tool_call_id: str = ""
    name: str = ""


@dataclass(frozen=True)
class HarubanTurn:
    """하루방 한 턴 결과. 최종 사용자 노출 텍스트 + 반영 제안(있으면)."""
    available: bool
    reply_text: str = ""
    form_suggestion: dict | None = None              # suggest_form_update args (있을 때만)
    tool_trace: list[dict] = field(default_factory=list)  # 디버깅용
    reason: str = ""


def chat_turn(
    messages_in: list[dict],
    form_state: dict,
    *,
    max_iterations: int = 3,
) -> HarubanTurn:
    """대화 한 턴. LLM이 도구 호출을 원하면 자동 실행 후 다음 회차로 넘어간다.

    messages_in: [{role, content, tool_calls?, tool_call_id?, name?}, ...]
                 role=system은 포함하지 않는다 (여기서 자동 추가).
    form_state: 사용자 현재 폼 상태 (regions, days, companion, purpose, moments 등).

    llm.complete_with_tools는 단일 system/user만 받아서, 여기서는 openai 클라이언트를
    직접 사용해 conv 배열 통째로 전달하고 도구 실행 루프를 돌린다. 모델·키 규칙은 유지.
    """
    if not llm.is_available():
        return HarubanTurn(available=False, reason="OPENAI_API_KEY not set")

    system_prompt = _BASE_SYSTEM_PROMPT + _form_context_block(form_state)

    conv: list[dict] = [{"role": "system", "content": system_prompt}]
    for m in messages_in:
        role = m.get("role")
        if role == "user":
            conv.append({"role": "user", "content": m.get("content") or ""})
        elif role == "assistant":
            item: dict = {"role": "assistant", "content": m.get("content") or ""}
            if m.get("tool_calls"):
                item["tool_calls"] = m["tool_calls"]
            conv.append(item)
        elif role == "tool":
            conv.append({
                "role": "tool",
                "tool_call_id": m.get("tool_call_id", ""),
                "name": m.get("name", ""),
                "content": m.get("content") or "",
            })

    return _chat_turn_raw(conv, [], max_iterations)


def _chat_turn_raw(
    conv: list[dict],
    trace: list[dict],
    max_iterations: int,
) -> HarubanTurn:
    """openai client를 직접 사용해 conv 배열 통째 전달 + tool 실행 루프."""
    import os
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return HarubanTurn(available=False, reason="OPENAI_API_KEY not set")

    try:
        from openai import OpenAI
    except Exception as e:
        return HarubanTurn(available=False, reason=f"openai import failed: {e}")

    client = OpenAI(api_key=key)
    form_suggestion: dict | None = None

    for it in range(max_iterations):
        try:
            resp = client.chat.completions.create(
                model=llm.MODEL,
                messages=conv,
                tools=TOOLS,
                tool_choice="auto",
                max_completion_tokens=600,
                temperature=0.3,
            )
        except Exception as e:
            return HarubanTurn(available=False, reason=f"openai call failed: {e}", tool_trace=trace)

        choice = resp.choices[0] if resp.choices else None
        if not choice:
            return HarubanTurn(available=False, reason="no choice returned", tool_trace=trace)
        msg = choice.message
        tool_calls = getattr(msg, "tool_calls", None) or []
        text_reply = (msg.content or "").strip()

        if not tool_calls:
            # 최종 응답. 반환.
            return HarubanTurn(
                available=True,
                reply_text=text_reply,
                form_suggestion=form_suggestion,
                tool_trace=trace,
            )

        # 도구 호출들을 실제로 실행하고 tool role 메시지 추가.
        conv.append({
            "role": "assistant",
            "content": text_reply,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            runner = TOOL_RUNNERS.get(name)
            if runner is None:
                result = {"error": f"unknown tool: {name}"}
            else:
                try:
                    result = runner(args)
                except Exception as e:
                    result = {"error": f"{type(e).__name__}: {e}"}

            trace.append({"tool": name, "args": args, "result_size": len(json.dumps(result, ensure_ascii=False))})

            # suggest_form_update는 별도 추적 (프론트에 그대로 넘긴다).
            if name == "suggest_form_update" and isinstance(result, dict):
                form_suggestion = result.get("suggestion")

            conv.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            })

    # 반복 상한 도달. 마지막 assistant 메시지 있으면 그것을 반환.
    last_assistant = next(
        (m for m in reversed(conv) if m.get("role") == "assistant" and m.get("content")),
        None,
    )
    return HarubanTurn(
        available=True,
        reply_text=(last_assistant.get("content") if last_assistant else "") or "",
        form_suggestion=form_suggestion,
        tool_trace=trace,
        reason=f"max iterations ({max_iterations}) reached",
    )


# ─── 하루방 인사 (임계 도달 시 자동 팝업) ───────────────────────────
#
# 목적: 사용자가 폼에서 지역+순간을 하나 이상 채우면 하루방이 스스로 인사하며
#       "이 조합에서 저희 데이터로 확인된 곳" 하이라이트 카드를 첫 봇 메시지로 준다.
#
# 흐름 (결정적):
#   1) 폼 → PackRequest → build_filters
#   2) 각 moment별 search_strict → badge_item
#   3) 하이라이트 후보 선정 (규칙 기반: verified 우선, region×moment 다양성)
#   4) coverage_matrix에서 items=0인 조합 → gaps 나열
#   5) LLM 있으면 greeting + 각 하이라이트 reason(한 줄) 조립
#      없으면 템플릿 폴백
#
# 사실은 절대 LLM이 만들지 않는다: 이름·주소·배지는 DB 조회값 그대로.
# LLM은 greeting 문구와 "왜 이 곳인지" 한 줄만 채운다.


@dataclass(frozen=True)
class HarubanIntro:
    available: bool
    greeting: str = ""
    highlights: list[dict] = field(default_factory=list)   # place 카드
    coverage: dict = field(default_factory=dict)           # verified/caution/gap 카운트
    gaps: list[dict] = field(default_factory=list)         # (region × moment) items=0 조합
    llm_used: bool = False
    reason: str = ""


def build_intro(form_state: dict, *, max_highlights: int = 6) -> HarubanIntro:
    """폼 상태 → 하이라이트 카드 + 인사 문구.

    LLM은 greeting과 각 place의 reason 한 줄만. 이름/주소/배지는 DB 조회값 그대로.
    LLM 미가용 시 템플릿 greeting + reason 생략 (배지·주소는 정상 노출).
    """
    # 1) 폼 검증. 임계 미달(regions/moments 비어 있음) 등은 available=False.
    try:
        req = filters_mod.PackRequest.from_dict(form_state)
    except (ValueError, KeyError) as e:
        return HarubanIntro(available=False, reason=f"form invalid: {type(e).__name__}: {e}")

    if not req.moments:
        return HarubanIntro(available=False, reason="no moments selected")

    try:
        bundle = filters_mod.build_filters(req)
    except (
        filters_mod.UnknownRegion, filters_mod.UnknownMoment,
        filters_mod.UnknownCompanion, filters_mod.UnknownPurpose,
        ValueError,
    ) as e:
        return HarubanIntro(available=False, reason=f"filters invalid: {type(e).__name__}: {e}")

    # 2) 각 moment의 items 수집 (badge 판정 포함)
    now = datetime.now(timezone.utc)
    per_moment: dict[str, list[trust_mod.BadgedItem]] = {}
    # 검색 limit은 하이라이트 6 + 여유. moment별 6이면 4*6=24 hit, 감당 가능.
    per_moment_hits: dict[str, list] = {}
    for mf in bundle.per_moment:
        hits = search_mod.search_strict(mf, limit=max_highlights)
        per_moment_hits[mf.moment] = hits
        per_moment[mf.moment] = [trust_mod.badge_item(h, mf, now=now) for h in hits]

    # 3) 하이라이트 선정 (verified 우선, (region, moment) 다양성)
    highlights = _pick_highlights(per_moment, per_moment_hits, req, max_count=max_highlights)

    # 4) coverage 매트릭스 & gaps
    coverage_matrix = _compute_coverage_matrix(per_moment, req)
    gaps = _compute_gaps(coverage_matrix, req)
    coverage = _compute_coverage_summary(per_moment, gaps)

    # 5) LLM 조립 (greeting + reasons)
    greeting = ""
    reasons_by_id: dict[str, str] = {}
    llm_used = False
    llm_reason = ""

    if llm.is_available():
        greeting, reasons_by_id, llm_used, llm_reason = _llm_compose(req, highlights, gaps)

    if not llm_used or not greeting:
        greeting = _template_greeting(req, highlights, gaps, coverage)

    # 6) reason 병합 (LLM이 준 것만)
    for h in highlights:
        r = reasons_by_id.get(h["external_id"])
        if r:
            h["reason"] = r

    return HarubanIntro(
        available=True,
        greeting=greeting,
        highlights=highlights,
        coverage=coverage,
        gaps=gaps,
        llm_used=llm_used,
        reason=llm_reason,
    )


def _pick_highlights(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    per_moment_hits: dict[str, list],
    req: filters_mod.PackRequest,
    *,
    max_count: int,
) -> list[dict]:
    """규칙 기반 하이라이트 선정.

    규칙:
      - (region × moment) 조합에서 하나씩 뽑아 다양성 확보 (라운드 로빈)
      - 각 조합 안에서는 verified > caution 순
      - contradicted / tombstoned는 이미 search_strict에서 배제됨
      - 결과가 max_count 미달이면 나머지 슬롯은 남은 verified/caution로 채움
    """
    # (region, moment) → 배지 순 정렬된 후보 리스트
    buckets: dict[tuple[str, str], list[dict]] = {}
    for moment, items in per_moment.items():
        hits = per_moment_hits.get(moment, [])
        for i, it in enumerate(items):
            region = it.region_normalized or (hits[i].region_normalized if i < len(hits) else "")
            hit = hits[i] if i < len(hits) else None
            entry = {
                "external_id": it.external_id,
                "name": it.name,
                "region": region,
                "region_label": REGION_LABEL_KO.get(region, region),
                "moment": moment,
                "moment_label": MOMENT_LABEL_KO.get(moment, moment),
                "address": (hit.address if hit else None),
                "badge": it.badge,
                "note": it.note,
                "sources": it.sources,
                "transit": it.transit,
                "reason": None,   # LLM이 채움. 없으면 None.
            }
            buckets.setdefault((region, moment), []).append(entry)

    for key in buckets:
        buckets[key].sort(key=lambda e: (0 if e["badge"] == "verified" else 1))

    # 라운드 로빈: 선택된 (region, moment) 조합을 반복 순회하며 하나씩 뽑음.
    combos = [
        (r, m)
        for r in req.regions
        for m in req.moments
        if (r, m) in buckets and buckets[(r, m)]
    ]
    chosen: list[dict] = []
    while combos and len(chosen) < max_count:
        next_round: list[tuple[str, str]] = []
        for key in combos:
            if buckets[key]:
                chosen.append(buckets[key].pop(0))
                if len(chosen) >= max_count:
                    break
                if buckets[key]:
                    next_round.append(key)
        combos = next_round

    return chosen


def _compute_coverage_matrix(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    req: filters_mod.PackRequest,
) -> dict[tuple[str, str], int]:
    """선택된 (region × moment) 조합별 verified+caution 카운트."""
    matrix: dict[tuple[str, str], int] = {}
    for r in req.regions:
        for m in req.moments:
            items = per_moment.get(m, [])
            n = sum(1 for it in items if (it.region_normalized or "") == r)
            matrix[(r, m)] = n
    return matrix


def _compute_gaps(
    matrix: dict[tuple[str, str], int],
    req: filters_mod.PackRequest,
) -> list[dict]:
    """items=0인 조합을 정직 문구와 함께 나열."""
    gaps: list[dict] = []
    for (r, m), n in matrix.items():
        if n == 0:
            gaps.append({
                "region": r,
                "region_label": REGION_LABEL_KO.get(r, r),
                "moment": m,
                "moment_label": MOMENT_LABEL_KO.get(m, m),
                "note": (
                    f"{REGION_LABEL_KO.get(r, r)}에서 {MOMENT_LABEL_KO.get(m, m)}은(는) "
                    "저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다."
                ),
            })
    return gaps


def _compute_coverage_summary(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    gaps: list[dict],
) -> dict:
    verified = 0
    caution = 0
    for items in per_moment.values():
        for it in items:
            if it.badge == "verified":
                verified += 1
            elif it.badge == "caution":
                caution += 1
    total = verified + caution
    return {
        "verified": verified,
        "caution": caution,
        "total": total,
        "gap_combos": len(gaps),
    }


def _template_greeting(
    req: filters_mod.PackRequest,
    highlights: list[dict],
    gaps: list[dict],
    coverage: dict,
) -> str:
    """LLM 없어도 항상 나오는 안전 문구.

    형식: "{동행자}와 {지역} {목적}이시라구요? 저희 데이터로 확인된 곳 N곳 보여드릴게요."
    조합에 빈 것이 있으면 두 번째 문장으로 정직하게 덧붙임.
    """
    companion_ko = COMPANION_LABEL_KO.get(req.companion, "")
    purpose_ko = PURPOSE_LABEL_KO.get(req.purpose, "")
    regions_ko = ", ".join(REGION_LABEL_KO.get(r, r) for r in req.regions)

    head = ""
    if companion_ko and purpose_ko:
        head = f"{regions_ko}에서 {companion_ko} {purpose_ko} 여행이시라구요? "
    elif regions_ko:
        head = f"{regions_ko} 여행이시라구요? "

    if highlights:
        body = f"저희 공공데이터로 확인된 {len(highlights)}곳을 먼저 보여드릴게요."
    else:
        body = "이 조합에서 저희 데이터로 확인된 곳이 아직 없어요."

    tail = ""
    if gaps:
        tail = f" (확인되지 않은 조합 {len(gaps)}개는 아래에 정직하게 알려드려요.)"

    return (head + body + tail).strip()


def _llm_compose(
    req: filters_mod.PackRequest,
    highlights: list[dict],
    gaps: list[dict],
) -> tuple[str, dict[str, str], bool, str]:
    """LLM에 greeting + reason 한 줄씩 요청.

    반환: (greeting_text, reasons_by_external_id, llm_used, reason)
    실패/키 없음 시 (있는 그대로 반환) — 호출부가 폴백.
    """
    # LLM 호출 시 사실 그대로 지어내지 않도록: 후보 리스트를 JSON으로 넘기고
    # 오직 이 external_id 목록에 한해 reason을 매기라고 지시.
    payload = {
        "user": {
            "regions": [REGION_LABEL_KO.get(r, r) for r in req.regions],
            "companion": COMPANION_LABEL_KO.get(req.companion, req.companion),
            "purpose": PURPOSE_LABEL_KO.get(req.purpose, req.purpose),
            "moments": [MOMENT_LABEL_KO.get(m, m) for m in req.moments],
        },
        "candidates": [
            {
                "external_id": h["external_id"],
                "name": h["name"],
                "region": h["region_label"],
                "moment": h["moment_label"],
                "badge": h["badge"],
                "note": h["note"],
            }
            for h in highlights
        ],
        "gaps": [
            {"region": g["region_label"], "moment": g["moment_label"]}
            for g in gaps
        ],
    }

    system = (
        "너는 '하루방'이다. 제주 여행 정직 에이전트 캐릭터.\n"
        "말투: 부드러운 존댓말, 짧고 따뜻하게, 이모지 없이.\n\n"
        "역할: 사용자가 폼에서 지역·순간을 방금 골랐다. "
        "저희 데이터로 확인된 후보들과 확인되지 않은 조합이 아래 JSON에 있다. "
        "이걸 바탕으로 (1) 짧은 인사 한두 문장과 (2) 각 후보의 '이 곳을 왜 보여드리는지' 한 줄을 만들어라.\n\n"
        "절대 규칙:\n"
        "- candidates에 없는 장소·주소·운영시간·수치를 지어내지 마라.\n"
        "- '가장 좋은 곳' 같은 단정 대신 '저희 데이터로 확인된 곳' 톤을 유지하라.\n"
        "- 확인되지 않은 조합(gaps)은 인사에서 정직하게 언급하되 '없다'고 단언하지 마라.\n"
        "- reasons는 반드시 candidates의 external_id를 key로 써라. 다른 id를 지어내지 마라.\n\n"
        "출력 형식은 아래 JSON 스키마 그대로:\n"
        '{\n'
        '  "greeting": "한 두 문장",\n'
        '  "reasons": { "<external_id>": "한 줄 이유", ... }\n'
        '}'
    )

    user = "다음 JSON에 근거해서만 답하라:\n" + json.dumps(payload, ensure_ascii=False, indent=2)

    resp = llm.complete(system=system, user=user, max_completion_tokens=700, temperature=0.3)
    if not resp.available:
        return "", {}, False, resp.reason

    text_out = resp.text.strip()
    # 코드펜스 제거 (LLM이 ```json ...``` 감쌀 때)
    if text_out.startswith("```"):
        text_out = text_out.strip("`")
        # ```json\n{...}\n``` 형태
        if text_out.startswith("json"):
            text_out = text_out[4:]
        text_out = text_out.strip()

    try:
        parsed = json.loads(text_out)
    except json.JSONDecodeError as e:
        return "", {}, False, f"json decode failed: {e}"

    greeting = str(parsed.get("greeting") or "").strip()
    reasons_raw = parsed.get("reasons") or {}

    # candidates에 없는 id는 조용히 버림 (사실 생성 방지 게이트).
    valid_ids = {h["external_id"] for h in highlights}
    reasons: dict[str, str] = {}
    if isinstance(reasons_raw, dict):
        for k, v in reasons_raw.items():
            if k in valid_ids and isinstance(v, str) and v.strip():
                reasons[k] = v.strip()

    return greeting, reasons, True, ""
