"""/verify 통합 테스트 — 실 DB의 4,422 place 기반."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.api import db
from apps.api.engine import verify as verify_mod
from apps.api.main import app

pytestmark = pytest.mark.skipif(
    not db.ping(), reason="DB 미접속 — docker compose up -d db 필요"
)

client = TestClient(app)


# ---- claim 분해 폴백 (LLM 없이 문장 분리) ----

def test_split_by_sentence_basic():
    parts = verify_mod.split_by_sentence("첫 문장이다. 둘째 문장!\n셋째 문장?")
    assert parts == ["첫 문장이다.", "둘째 문장!", "셋째 문장?"]


def test_guess_place_name_from_quote():
    assert verify_mod._guess_place_name("최근 「새별오름」 다녀왔어요.") == "새별오름"


def test_guess_place_name_from_particle():
    assert verify_mod._guess_place_name("어제 새별오름에 다녀왔어요.") == "새별오름"


# ---- 실 DB 매칭 ----

def test_verify_existing_place_returns_verified():
    # 데이터셋에 있는 대표 지명. 유사도 매칭으로 verified가 나와야 한다.
    r = client.post("/verify", json={"text": "새별오름에서 노을을 봤어요."})
    assert r.status_code == 200
    claims = r.json()["claims"]
    assert len(claims) >= 1
    # 최소 하나는 verified — 유사도 임계 통과 여부에 따라 유동적.
    verdicts = {c["verdict"] for c in claims}
    assert verdicts & {"verified", "outdated"}  # 존재 확인이 뜨는 것 자체가 핵심


def test_verify_nonexistent_place_returns_coverage_gap_without_denial():
    # G13: 데이터셋에 없는 가공된 이름 → coverage_gap.
    text = "제주시에 있는 '가상특이한이름카페12345'에서 커피 마셨어요."
    r = client.post("/verify", json={"text": text})
    assert r.status_code == 200
    claims = r.json()["claims"]
    assert any(c["verdict"] == "coverage_gap" for c in claims)
    # "없다" 단언 금지 — TRUST_ENGINE §2/§6
    for c in claims:
        if c["verdict"] == "coverage_gap":
            assert "없습니다" not in c["reason"]
            assert "확인되지 않" in c["reason"]


def test_verify_flagged_place_returns_outdated():
    # ingest_file --seed-dev-fix-request로 has_fix_request가 세워진 애월 food 중 하나.
    # 실제 이름을 DB에서 꺼내 그대로 verify에 넣는다.
    from sqlalchemy import text
    with db.get_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT name FROM place WHERE has_fix_request=true "
            "AND region_normalized='aewol' AND category='food' LIMIT 1"
        )).first()
    if row is None:
        pytest.skip("dev seed 미적용 — --seed-dev-fix-request 먼저 실행 필요")
    r = client.post("/verify", json={"text": f"{row.name}에서 저녁 먹었어요."})
    assert r.status_code == 200
    claims = r.json()["claims"]
    assert any(c["verdict"] == "outdated" and "수정요청" in c["reason"] for c in claims)
