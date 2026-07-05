"""정직 에이전트 — 자연어 상담 레이어 (Phase A).

역할:
  - LLM은 사용자 자연어 발화를 PackRequest 필드로 파싱한다.
  - LLM은 사실(장소·시간·조건)을 지어내지 않는다. 지어냈다면 폼 fallback으로 회귀.
  - 파싱은 function calling으로 강제 구조화 (JSON 답변보다 안정).

CLAUDE.md 절대 규칙:
  - 1 (환각 금지): 파싱된 필드 값은 정형 enum만 허용. 자유텍스트는 special_notes로만.
  - 5 (모델 고정): llm.py의 gpt-5.3-mini 고정 유지.
  - 6 (LLM 없이도 동작): 키 없거나 실패 시 예외 없이 signal 반환 → 폼 fallback.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from apps.api.engine import filters as filters_mod
from apps.api.engine import llm


# ─── PackRequest 필드 값 도메인 (agent.py에서 LLM에 유효값을 강하게 제약) ───

REGIONS_ENUM: list[str] = list(filters_mod.REGIONS)
COMPANIONS_ENUM: list[str] = list(filters_mod.COMPANION_REQUIRED_AMENITIES.keys())
PURPOSES_ENUM: list[str] = list(filters_mod.PURPOSE_TO_CATEGORIES.keys())
MOMENTS_ENUM: list[str] = list(filters_mod.MOMENT_TO_CATEGORY.keys())


PARSE_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "propose_pack_request",
        "description": (
            "사용자 자연어 발화에서 파싱된 여행 조건을 저희 시스템 스키마로 제안한다. "
            "규정된 enum 값만 사용하라. 자유텍스트로 이해된 배려사항은 special_notes에만 담아라. "
            "발화에 명시되지 않은 필드는 넣지 마라 (지어내지 마라)."
        ),
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "regions": {
                    "type": "array",
                    "items": {"type": "string", "enum": REGIONS_ENUM},
                    "minItems": 0,
                    "description": "제주 12지역 중 언급된 것. 명시 없으면 빈 배열.",
                },
                "start_date": {
                    "type": "string",
                    "description": "YYYY-MM-DD. 사용자가 '다음 주'처럼 상대적 표현을 쓰면 today_iso 파라미터를 기준으로 계산. 명시 없으면 빈 문자열.",
                },
                "days": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 14,
                    "description": "여행 일수. '2박3일'은 3, '당일'은 1. 명시 없으면 0(모름) 반환.",
                },
                "companion": {
                    "type": "string",
                    "enum": COMPANIONS_ENUM + [""],
                    "description": "동행자. 명시 없으면 빈 문자열.",
                },
                "purpose": {
                    "type": "string",
                    "enum": PURPOSES_ENUM + [""],
                    "description": "여행 목적. 명시 없으면 빈 문자열.",
                },
                "moments": {
                    "type": "array",
                    "items": {"type": "string", "enum": MOMENTS_ENUM},
                    "description": "사용자가 원하는 순간 카드들. 명시 없으면 빈 배열.",
                },
                "special_notes": {
                    "type": "string",
                    "description": (
                        "구조화되지 않은 배려사항 (예: '부모님 무릎이 편찮으셔서 계단 적은 곳'). "
                        "여기 있는 내용은 사실 검증엔 영향 없고, 감성 문구 톤에만 반영된다. 없으면 빈 문자열."
                    ),
                },
                "reasoning": {
                    "type": "string",
                    "description": "왜 이렇게 파싱했는지 짧은 한국어 요약 (사용자에게 노출됨).",
                },
            },
            "required": ["reasoning"],
        },
    },
}


_SYSTEM_PROMPT = (
    "너는 제주 여행 준비 서비스의 자연어 상담 파서다. "
    "사용자 발화를 저희 시스템 스키마(regions/start_date/days/companion/purpose/moments/special_notes)로 파싱한다. "
    "규칙:\n"
    "1) enum 값 밖의 값은 절대 만들지 마라. 발화가 애매하면 그 필드는 비워라.\n"
    "2) 발화가 지역·순간을 여러 개 언급하면 모두 배열에 담아라.\n"
    "3) 사용자의 배려사항·톤은 special_notes에 자연어 그대로 담아라.\n"
    "4) 파싱 후 짧은 한국어 reasoning으로 사용자에게 왜 이렇게 이해했는지 설명하라.\n"
    "5) propose_pack_request 도구를 반드시 한 번 호출하라. 도구 밖 다른 방식으로 답하지 마라."
)


@dataclass(frozen=True)
class ParsedRequest:
    """자연어 파싱 결과. 사용자 확인 후 실제 /pack에 넘길 값."""
    regions: list[str]
    start_date: str
    days: int
    companion: str
    purpose: str
    moments: list[str]
    special_notes: str
    reasoning: str

    def to_dict(self) -> dict:
        return {
            "regions": list(self.regions),
            "start_date": self.start_date,
            "days": self.days,
            "companion": self.companion,
            "purpose": self.purpose,
            "moments": list(self.moments),
            "special_notes": self.special_notes,
            "reasoning": self.reasoning,
        }


@dataclass(frozen=True)
class ParseResult:
    """파싱 시도 결과. available=False면 프론트가 폼 fallback으로 안내한다."""
    available: bool
    parsed: ParsedRequest | None = None
    reason: str = ""  # unavailable/실패 사유
    raw_tool_arguments: str = ""  # 디버깅용 원본 arguments 문자열


def _validate_and_normalize(args: dict) -> ParsedRequest:
    """LLM이 돌려준 arguments 딕셔너리를 검증. 잘못된 enum은 조용히 제거하고
    파싱된 필드만 유지 (환각 방지)."""
    regions_raw = args.get("regions") or []
    regions = [r for r in regions_raw if isinstance(r, str) and r in REGIONS_ENUM]

    moments_raw = args.get("moments") or []
    moments = [m for m in moments_raw if isinstance(m, str) and m in MOMENTS_ENUM]

    companion = args.get("companion") or ""
    if companion and companion not in COMPANIONS_ENUM:
        companion = ""

    purpose = args.get("purpose") or ""
    if purpose and purpose not in PURPOSES_ENUM:
        purpose = ""

    days_raw = args.get("days") or 0
    try:
        days = int(days_raw)
    except (TypeError, ValueError):
        days = 0
    if days < 0 or days > 14:
        days = 0

    start_date = str(args.get("start_date") or "").strip()
    if start_date:
        # YYYY-MM-DD 형식만 인정. 잘못되면 비움.
        try:
            date.fromisoformat(start_date)
        except ValueError:
            start_date = ""

    special_notes = str(args.get("special_notes") or "").strip()
    reasoning = str(args.get("reasoning") or "").strip()

    return ParsedRequest(
        regions=regions,
        start_date=start_date,
        days=days,
        companion=companion,
        purpose=purpose,
        moments=moments,
        special_notes=special_notes,
        reasoning=reasoning,
    )


def parse_pack_request(text: str, *, today: date | None = None) -> ParseResult:
    """자연어 → PackRequest 필드 파싱.

    today: '다음 주 화요일' 같은 상대적 표현 계산 기준. 기본 오늘.
    """
    today = today or date.today()
    user_prompt = (
        f"today_iso: {today.isoformat()}\n"
        f"사용자 발화: {text.strip()}\n"
        "propose_pack_request 도구를 호출해 파싱 결과를 돌려줘라."
    )

    resp = llm.complete_with_tools(
        system=_SYSTEM_PROMPT,
        user=user_prompt,
        tools=[PARSE_TOOL],
        max_completion_tokens=500,
        temperature=0.2,
    )
    if not resp.available:
        return ParseResult(available=False, reason=resp.reason or "LLM unavailable")

    if not resp.tool_calls:
        return ParseResult(
            available=False,
            reason="LLM did not call propose_pack_request tool",
        )

    tc = resp.tool_calls[0]
    if tc.name != "propose_pack_request":
        return ParseResult(
            available=False,
            reason=f"LLM called unexpected tool: {tc.name}",
            raw_tool_arguments=tc.arguments,
        )

    try:
        args = json.loads(tc.arguments)
    except json.JSONDecodeError as e:
        return ParseResult(
            available=False,
            reason=f"tool arguments not valid JSON: {e}",
            raw_tool_arguments=tc.arguments,
        )
    if not isinstance(args, dict):
        return ParseResult(
            available=False,
            reason="tool arguments not a JSON object",
            raw_tool_arguments=tc.arguments,
        )

    parsed = _validate_and_normalize(args)
    return ParseResult(available=True, parsed=parsed, raw_tool_arguments=tc.arguments)
