"""OpenRouter에 등록된 gpt-5 계열 모델 리스트업 (아이펠톤 규칙 gpt-5.3 확인용)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

import httpx  # noqa: E402
from apps.api.db import load_env  # noqa: E402

load_env()
key = os.environ.get("OPENROUTER_API_KEY", "").strip()
if not key:
    print("OPENROUTER_API_KEY missing", file=sys.stderr)
    raise SystemExit(2)

r = httpx.get(
    "https://openrouter.ai/api/v1/models",
    headers={"Authorization": f"Bearer {key}"},
    timeout=30,
)
data = r.json()
models = data.get("data", [])
print(f"total OpenRouter models: {len(models)}")

# gpt-5 계열 필터
targets = [m for m in models if "gpt-5" in m["id"].lower() or "gpt5" in m["id"].lower()]
print(f"\ngpt-5 계열: {len(targets)}개")
for m in sorted(targets, key=lambda x: x["id"]):
    pricing = m.get("pricing", {})
    in_p = pricing.get("prompt", "?")
    out_p = pricing.get("completion", "?")
    print(f"  {m['id']:40s}  in=${in_p}  out=${out_p}")

# openai/ prefix 붙은 모든 모델도 요약
openai_all = sorted(m["id"] for m in models if m["id"].startswith("openai/"))
print(f"\nopenai/* 전체: {len(openai_all)}개")
for mid in openai_all:
    print(f"  {mid}")
