"""assemble.py 템플릿 폴백 테스트.

LLM 실호출 없이 폴백 경로만 검증 (CLAUDE.md 절대 규칙 6).
"""
from __future__ import annotations

from apps.api.engine.assemble import _template_intro, compose_intro
from apps.api.engine.trust import Fallback, Section


def _sec(moment: str, *, items=None, fallback=None) -> Section:
    return Section(moment=moment, items=list(items or []), fallback=fallback, observed_reasons=[])


def test_template_intro_mentions_verified_moment():
    sections = [_sec("oreum", items=[object()])]
    text = _template_intro(sections, "family")
    assert "오름" in text
    assert "가족과" in text


def test_template_intro_covers_coverage_gap_without_denial():
    gap = Fallback(reason="coverage_gap", message="…", stats=None)
    sections = [_sec("citrus", fallback=gap)]
    text = _template_intro(sections, "solo")
    # "없다" 단언 금지 규칙
    assert "없다" not in text
    assert "확인되지 않" in text


def test_compose_intro_falls_back_when_no_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    sections = [_sec("oreum", items=[object()])]
    intro = compose_intro(sections, "family")
    assert intro.llm_used is False
    assert "OPENAI_API_KEY" in intro.reason
    assert "오름" in intro.text
