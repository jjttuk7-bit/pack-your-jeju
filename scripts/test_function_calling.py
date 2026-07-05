"""OpenRouter를 통한 function calling 지원 여부 임시 테스트.

목적:
  - CLAUDE.md 절대 규칙 5가 지정한 gpt-5.3-mini의 function calling 실제 지원 여부 확인.
  - 미지원 시 대안 모델 후보 파악 (백업 결정에 사용).

원칙:
  - **임시 테스트 스크립트**. 프로덕션 코드에는 gateway 추상화 없음 (CLAUDE.md 절대 규칙 5).
  - .env의 OPENROUTER_API_KEY 사용. 채팅 로그에 키 노출 방지.

실행:
  python scripts/test_function_calling.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 자동 추가 (어느 CWD에서 실행되든 apps.* 임포트 가능)
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import httpx  # noqa: E402

from apps.api.db import load_env  # noqa: E402

load_env()

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
if not OPENROUTER_KEY:
    print("환경변수 OPENROUTER_API_KEY 가 필요합니다 (.env 또는 환경변수).", file=sys.stderr)
    raise SystemExit(2)

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

# 테스트 후보 모델. OpenRouter 슬러그 형식.
MODELS = [
    "openai/gpt-5.3-mini",       # CLAUDE.md 절대 규칙 5 원 지정
    "openai/gpt-4o-mini",        # OpenAI function calling 표준
    "anthropic/claude-haiku-4-5",# Anthropic tool_use 표준
]

# 테스트용 도구 정의 — 실제 pack-your-jeju 도구 축소판
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_places",
            "description": "제주 지역·카테고리로 검증된 장소를 검색한다. 반환 결과 밖의 장소를 지어내지 말 것.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "제주 12지역 중 하나 이상 (jeju_city, aewol, seongsan, ...)"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["oreum", "beach", "cafe", "food", "market", "forest", "experience", "viewpoint"]
                    }
                },
                "required": ["regions", "category"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "build_itinerary",
            "description": "검증된 장소 목록을 여행 일수로 조립한다. 사실 지어냄 없음.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regions": {"type": "array", "items": {"type": "string"}},
                    "days": {"type": "integer", "minimum": 1, "maximum": 14},
                    "moments": {"type": "array", "items": {"type": "string"}},
                    "companion": {"type": "string"},
                },
                "required": ["regions", "days", "moments", "companion"]
            }
        }
    }
]

SYSTEM_PROMPT = (
    "너는 제주 여행 상담사다. 사용자 발화에서 필요한 정보를 파악해 "
    "제공된 도구(search_places, build_itinerary)를 호출하라. "
    "도구 결과 밖의 장소·시간·조건은 지어내지 말라."
)

USER_MESSAGE = "부모님이랑 3일 힐링 여행 가려고. 애월 · 성산 · 서귀포 위주로. 오름이랑 조용한 카페 좋아하셔."


def test_model(model: str) -> dict:
    """단일 모델에 tool_calls 요청을 보내 결과 요약."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_MESSAGE},
        ],
        "tools": TOOLS,
        "tool_choice": "auto",
        "max_tokens": 500,
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pack-your-jeju.vercel.app",
        "X-Title": "Pack Your Jeju - function calling test",
    }
    try:
        r = httpx.post(ENDPOINT, json=payload, headers=headers, timeout=60.0)
    except Exception as e:
        return {"model": model, "status": "http_error", "detail": f"{type(e).__name__}: {e}"}

    if r.status_code != 200:
        return {"model": model, "status": f"HTTP {r.status_code}", "detail": r.text[:600]}

    data = r.json()
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    tool_calls = message.get("tool_calls") or []
    text_content = message.get("content")

    if tool_calls:
        # 어떤 도구를 어떤 인자로 호출했는지 요약
        summary = []
        for tc in tool_calls:
            fn = tc.get("function") or {}
            summary.append({
                "name": fn.get("name"),
                "args": _try_parse_json(fn.get("arguments")),
            })
        return {
            "model": model,
            "status": "tool_calls_supported",
            "tool_calls": summary,
            "text_alongside": text_content,
        }
    return {
        "model": model,
        "status": "no_tool_calls",
        "text_only": (text_content or "")[:400],
    }


def _try_parse_json(s):
    if not isinstance(s, str):
        return s
    try:
        return json.loads(s)
    except Exception:
        return s[:200]


def main() -> int:
    print(f"\n[system]  {SYSTEM_PROMPT}")
    print(f"[user]    {USER_MESSAGE}\n")

    results = []
    for model in MODELS:
        print(f"--- {model} ---")
        result = test_model(model)
        results.append(result)
        status = result["status"]
        print(f"  status: {status}")
        if status == "tool_calls_supported":
            for tc in result["tool_calls"]:
                print(f"  tool_call: {tc['name']}  args={json.dumps(tc['args'], ensure_ascii=False)[:200]}")
            if result.get("text_alongside"):
                print(f"  text: {result['text_alongside'][:200]}")
        elif status == "no_tool_calls":
            print(f"  text: {result['text_only']}")
        else:
            print(f"  detail: {result.get('detail','')[:400]}")
        print()

    # 판정 요약
    print("=" * 60)
    print("판정")
    print("=" * 60)
    for r in results:
        mark = "OK " if r["status"] == "tool_calls_supported" else "X  "
        print(f"  {mark} {r['model']}  ({r['status']})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
