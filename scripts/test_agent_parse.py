"""agent.parse_pack_request 로직을 OpenRouter+gpt-4o-mini로 검증 (임시).

프로덕션 llm.py는 gpt-5.3-mini 고정 (CLAUDE.md 절대 규칙 5) — 내일 아이펠톤 키 발급 시 활성.
지금은 같은 프롬프트/tools를 OpenRouter 경유 gpt-4o-mini로 통과시켜 파싱 로직·검증 로직만 확인.

실행:
  python scripts/test_agent_parse.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

import httpx  # noqa: E402
from apps.api.db import load_env  # noqa: E402
from apps.api.engine import agent as agent_mod  # noqa: E402

load_env()
KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
if not KEY:
    print("OPENROUTER_API_KEY missing", file=sys.stderr)
    raise SystemExit(2)

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-4o-mini"  # 임시 개발 검증용

SCENARIOS = [
    "부모님이랑 3일 힐링 여행 가려고. 애월 · 성산 · 서귀포 위주로. 오름이랑 조용한 카페 좋아하셔.",
    "다음 주 화요일부터 2박 3일 우도 다녀올 건데 혼자 힐링. 곶자왈이랑 노을 명소 좋아함.",
    "내일부터 4일간 아이랑 갈 건데 감귤 체험이랑 바다 산책 넣어줘. 지역은 서귀포하고 남원.",
    "제주 여행 뭐 볼만해?",  # 정보 부족 케이스 — enum 비어야 정상
]


def call_openrouter(text: str) -> dict:
    """agent.py와 동일한 프롬프트/tools를 OpenRouter 경유로."""
    today = date.today()
    user_prompt = (
        f"today_iso: {today.isoformat()}\n"
        f"사용자 발화: {text.strip()}\n"
        "propose_pack_request 도구를 호출해 파싱 결과를 돌려줘라."
    )
    headers = {
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pack-your-jeju.vercel.app",
        "X-Title": "Pack Your Jeju - agent parse test",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": agent_mod._SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "tools": [agent_mod.PARSE_TOOL],
        "tool_choice": "auto",
        "max_tokens": 500,
        "temperature": 0.2,
    }
    r = httpx.post(ENDPOINT, json=payload, headers=headers, timeout=60.0)
    r.raise_for_status()
    return r.json()


def main() -> int:
    for i, text in enumerate(SCENARIOS, 1):
        print(f"\n=== 시나리오 {i} ===")
        print(f"입력: {text}")
        try:
            data = call_openrouter(text)
        except Exception as e:
            print(f"  err: {type(e).__name__}: {e}")
            continue

        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            print(f"  ✗ tool_calls 없음. text: {(msg.get('content') or '')[:200]}")
            continue

        tc = tool_calls[0]
        fn = tc.get("function") or {}
        name = fn.get("name")
        raw = fn.get("arguments") or "{}"
        print(f"  tool: {name}")
        try:
            args = json.loads(raw)
        except json.JSONDecodeError:
            print(f"  ✗ JSON 파싱 실패: {raw[:200]}")
            continue

        parsed = agent_mod._validate_and_normalize(args)
        print(f"  regions:      {parsed.regions}")
        print(f"  start_date:   {parsed.start_date}")
        print(f"  days:         {parsed.days}")
        print(f"  companion:    {parsed.companion}")
        print(f"  purpose:      {parsed.purpose}")
        print(f"  moments:      {parsed.moments}")
        if parsed.special_notes:
            print(f"  notes:        {parsed.special_notes}")
        if parsed.reasoning:
            print(f"  reasoning:    {parsed.reasoning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
