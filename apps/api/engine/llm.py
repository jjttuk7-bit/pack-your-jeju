"""gpt-5.3-mini 호출 유틸.

원칙 (CLAUDE.md 절대 규칙 5·6, DECISIONS D-12):
  - 모델은 gpt-5.3-mini 하나로 고정. Gateway/스왑 로직 없음.
  - GPT-5 계열이므로 max_completion_tokens 파라미터 사용.
  - OPENAI_API_KEY 미설정 시: LLMUnavailable 예외 없이 UNAVAILABLE 신호 반환.
    호출부(assemble/verify)는 이 신호를 보고 템플릿/규칙 폴백으로 진행한다.
    (데모 안전판 — CLAUDE.md 절대 규칙 6)

프롬프트 공통 규칙 (TRUST_ENGINE §5):
  "제공된 데이터에 없는 장소명·수치·시간을 만들지 마라. JSON 외 출력 금지."
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

MODEL = "gpt-5.3-mini"

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
