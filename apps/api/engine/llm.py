"""LLM 호출 유틸.

원칙 (CLAUDE.md 절대 규칙 5·6, DECISIONS D-12):
  - 원래는 gpt-5.3-mini 고정이나, 아이펠톤 게이트웨이 키가 아직 확보되지 않아
    발표 데모 안전판으로 gpt-4o-mini 임시 사용. 발표 후 gpt-5.3-mini로 복원.
  - Gateway/스왑 로직은 만들지 않는다. MODEL 상수 한 줄만 바뀜.
  - OPENAI_API_KEY 미설정 시: LLMUnavailable 예외 없이 UNAVAILABLE 신호 반환.
    호출부(assemble/verify)는 이 신호를 보고 템플릿/규칙 폴백으로 진행한다.
    (데모 안전판 — CLAUDE.md 절대 규칙 6)

프롬프트 공통 규칙 (TRUST_ENGINE §5):
  "제공된 데이터에 없는 장소명·수치·시간을 만들지 마라. JSON 외 출력 금지."

파라미터 노트:
  - gpt-4o 계열은 max_tokens · GPT-5 계열은 max_completion_tokens.
  - openai>=1.40 SDK는 gpt-4o에서도 max_completion_tokens 허용 (호환 유지).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

# CLAUDE.md 절대 규칙 5 임시 예외: 아이펠톤 gpt-5.3-mini 게이트웨이 키가 아직 없어
# 발표 데모용으로 gpt-4o-mini 임시 사용. 발표 후 "gpt-5.3-mini"로 되돌린다.
MODEL = "gpt-4o-mini"

NO_HALLUCINATION_CLAUSE = (
    "제공된 데이터에 없는 장소명·수치·시간을 만들지 마라. "
    "요청한 JSON 외에는 어떤 텍스트도 출력하지 마라."
)


@dataclass(frozen=True)
class LLMResponse:
    """LLM 호출 결과. available=False면 호출부가 폴백 경로로 진행한다."""
    available: bool
    text: str = ""
    reason: str = ""  # unavailable 사유 (없음/타임아웃/에러 등)


def _api_key() -> str | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return key or None


def is_available() -> bool:
    """API 키가 있어 LLM 경로를 시도할 수 있는가."""
    return _api_key() is not None


def complete(
    *,
    system: str,
    user: str,
    max_completion_tokens: int = 400,
    temperature: float = 0.4,
) -> LLMResponse:
    """gpt-5.3-mini 단일 호출.

    실패 신호는 예외가 아니라 available=False로 돌려준다.
    호출부가 이 신호를 무시하고 진행하지 못하도록 반드시 available를 확인해야 한다.
    """
    key = _api_key()
    if key is None:
        return LLMResponse(available=False, reason="OPENAI_API_KEY not set")

    # openai SDK는 지연 임포트 — 키가 없을 때 서버가 뜨는 것을 막지 않기 위함.
    try:
        from openai import OpenAI
    except Exception as e:  # pragma: no cover - import failure는 진짜 예외
        return LLMResponse(available=False, reason=f"openai import failed: {e}")

    client = OpenAI(api_key=key)
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system + "\n\n" + NO_HALLUCINATION_CLAUSE},
                {"role": "user", "content": user},
            ],
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
        )
    except Exception as e:
        return LLMResponse(available=False, reason=f"openai call failed: {e}")

    choice: Any = resp.choices[0] if resp.choices else None
    text = (choice.message.content if choice and choice.message else "") or ""
    return LLMResponse(available=True, text=text.strip())


@dataclass(frozen=True)
class ToolCall:
    """function calling 응답 하나. name + arguments(JSON string 원본)."""
    name: str
    arguments: str


@dataclass(frozen=True)
class ToolCallResponse:
    """function calling 호출 결과. available=False면 호출부가 폴백 경로로 진행한다."""
    available: bool
    tool_calls: tuple[ToolCall, ...] = ()
    text: str = ""                  # tool_calls와 병존 가능한 자연어 문구
    reason: str = ""


def complete_with_tools(
    *,
    system: str,
    user: str,
    tools: list[dict],
    max_completion_tokens: int = 500,
    temperature: float = 0.2,
) -> ToolCallResponse:
    """gpt-5.3-mini function calling 호출.

    tools는 OpenAI 표준 형식: [{"type": "function", "function": {"name","description","parameters"}}]
    호출부가 tool_calls를 확인 후 실제 도구를 실행하고 결과를 다시 넘겨받는 흐름은
    호출부(예: agent.py) 책임 (여러 턴 필요 시 turn 관리).
    """
    key = _api_key()
    if key is None:
        return ToolCallResponse(available=False, reason="OPENAI_API_KEY not set")

    try:
        from openai import OpenAI
    except Exception as e:  # pragma: no cover
        return ToolCallResponse(available=False, reason=f"openai import failed: {e}")

    client = OpenAI(api_key=key)
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system + "\n\n" + NO_HALLUCINATION_CLAUSE},
                {"role": "user", "content": user},
            ],
            tools=tools,
            tool_choice="auto",
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
        )
    except Exception as e:
        return ToolCallResponse(available=False, reason=f"openai call failed: {e}")

    choice: Any = resp.choices[0] if resp.choices else None
    msg = choice.message if choice else None
    text = (msg.content if msg else "") or ""
    tool_calls_raw = getattr(msg, "tool_calls", None) or []
    tool_calls = tuple(
        ToolCall(
            name=getattr(tc.function, "name", "") if hasattr(tc, "function") else "",
            arguments=getattr(tc.function, "arguments", "") if hasattr(tc, "function") else "",
        )
        for tc in tool_calls_raw
    )
    return ToolCallResponse(available=True, tool_calls=tool_calls, text=text.strip())
