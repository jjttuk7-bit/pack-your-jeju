"""llm.py 폴백 동작 테스트 — CLAUDE.md 절대 규칙 6.

이 파일은 실제 OpenAI 호출을 하지 않는다. 키가 있어도 호출 없이 신호만 검증.
"""
from __future__ import annotations

import apps.api.engine.llm as llm


def test_model_is_pinned_to_gpt_5_mini():
    assert llm.MODEL == "gpt-5-mini"


def test_is_available_false_when_key_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert llm.is_available() is False


def test_is_available_false_when_key_blank(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "   ")
    assert llm.is_available() is False


def test_is_available_true_when_key_set(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-dummy")
    assert llm.is_available() is True


def test_complete_returns_unavailable_signal_without_key(monkeypatch):
    # 키가 없을 때 예외 없이 available=False로 폴백 신호를 돌려준다.
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    resp = llm.complete(system="s", user="u")
    assert resp.available is False
    assert resp.text == ""
    assert "OPENAI_API_KEY" in resp.reason


def test_no_hallucination_clause_mentions_no_fabrication():
    # 프롬프트 공통 규칙 — TRUST_ENGINE §5
    assert "만들지" in llm.NO_HALLUCINATION_CLAUSE
