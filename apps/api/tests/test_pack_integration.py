"""/pack end-to-end 통합 테스트 (Day2 종료 기준).

실제 DB(docker compose)의 4,422 place 데이터를 사용한다.
DB가 없으면 이 파일은 skip.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.api import db
from apps.api.main import app

pytestmark = pytest.mark.skipif(
    not db.ping(), reason="DB 미접속 — docker compose up -d db 필요"
)

client = TestClient(app)


def _base_request(**over):
    body = {
        "region": "aewol",
        "start_date": "2026-07-04",
        "days": 3,
        "companion": "solo",
        "purpose": "healing",
        "moments": ["oreum"],
    }
    body.update(over)
    return body


def test_pack_verified_scenario_returns_items_with_badges():
    # 애월 + 오름 → 4,422 데이터셋에 새별오름 등 존재. verified 나와야 함.
    resp = client.post("/pack", json=_base_request(moments=["oreum"]))
    assert resp.status_code == 200
    data = resp.json()
    assert "pack_id" in data
    assert data["log_id"]  # 로깅 성공
    assert len(data["sections"]) == 1
    section = data["sections"][0]
    assert section["moment"] == "oreum"
    assert section["fallback"] is None
    assert len(section["items"]) >= 1
    # 첫 아이템에 배지·freshness·transit·sources 모두 포함
    it = section["items"][0]
    assert it["badge"] in {"verified", "caution"}  # 실데이터 상태에 따라 다양
    assert "info_type" in it["freshness"]
    assert "valid_until" in it["freshness"]
    assert "parking" in it["transit"]
    assert isinstance(it["sources"], list)


def test_pack_coverage_gap_scenario_returns_fallback():
    # G05 (EVAL_GOLDENSET.md): 감귤 체험 × 7월 → 데이터셋에 experience 카테고리 0개.
    # coverage_gap이 나와야 하며, 문구는 "없다" 단언 금지 (TRUST_ENGINE §2).
    resp = client.post("/pack", json=_base_request(
        region="andeok",  # 서귀포권으로 완화해도 없어야 정상 coverage_gap
        moments=["citrus"],
    ))
    assert resp.status_code == 200
    section = resp.json()["sections"][0]
    assert section["moment"] == "citrus"
    assert section["items"] == []
    assert section["fallback"] is not None
    assert section["fallback"]["reason"] == "coverage_gap"
    msg = section["fallback"]["message"]
    # "없다" 단언 금지 — TRUST_ENGINE §2 인식론 규칙
    assert "없습니다" not in msg
    assert "확인되지 않습니다" in msg


def test_pack_relaxed_scenario_marks_note():
    # 우도(카페 26건) 정도로는 strict가 성공하므로,
    # relaxed 케이스는 데이터가 얇은 조합을 골라야 한다.
    # market × 우도: 우도엔 시장 0건일 가능성 → relaxed로 인근 지역 결과가 나올 것.
    resp = client.post("/pack", json=_base_request(region="udo", moments=["local_market"]))
    assert resp.status_code == 200
    section = resp.json()["sections"][0]
    if section["items"]:
        # 인근 지역 결과 표기 확인
        notes = [it.get("note") for it in section["items"]]
        assert any(n and "인근" in n for n in notes)


def test_pack_multi_moment_returns_all_sections():
    resp = client.post("/pack", json=_base_request(moments=["oreum", "quiet_cafe", "beach_walk"]))
    assert resp.status_code == 200
    sections = resp.json()["sections"]
    assert [s["moment"] for s in sections] == ["oreum", "quiet_cafe", "beach_walk"]


def test_pack_bad_region_returns_400():
    resp = client.post("/pack", json=_base_request(region="busan"))
    assert resp.status_code == 400


def test_pack_bad_moment_returns_400():
    resp = client.post("/pack", json=_base_request(moments=["ski"]))
    assert resp.status_code == 400
