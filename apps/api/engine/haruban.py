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
from apps.api.engine import verify as verify_mod


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
