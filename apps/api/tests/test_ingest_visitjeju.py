"""ingest_visitjeju.py 골격 테스트 — 방어적 필드 탐색 로직만.

실제 API 호출은 하지 않는다.
"""
from __future__ import annotations

from apps.pipelines import ingest_visitjeju as ing


def test_find_items_top_level():
    items, path = ing.find_items({"items": [{"a": 1}, {"b": 2}]})
    assert path == ("items",)
    assert len(items) == 2


def test_find_items_nested_result():
    items, path = ing.find_items({"result": {"items": [{"a": 1}]}})
    assert path == ("result", "items")
    assert len(items) == 1


def test_find_items_returns_none_when_unknown_shape():
    items, path = ing.find_items({"data": {"contents": [{"a": 1}]}})
    assert items is None
    assert path is None


def test_probe_field_names_unions_keys():
    fields = ing.probe_field_names([
        {"contentsid": "x", "title": "A"},
        {"contentsid": "y", "latitude": 33.5},
    ])
    assert fields == ["contentsid", "latitude", "title"]


def test_main_requires_probe_flag(monkeypatch):
    monkeypatch.setenv("VISITJEJU_API_KEY", "dummy")
    rc = ing.main([])
    assert rc == 64  # EX_USAGE — Day1엔 --probe 외 모드 없음


def test_main_without_api_key_errors(monkeypatch):
    monkeypatch.delenv("VISITJEJU_API_KEY", raising=False)
    rc = ing.main(["--probe"])
    assert rc == 2
