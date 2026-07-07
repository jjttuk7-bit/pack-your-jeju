from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def test_visit_signal_endpoint_validates_status():
    resp = client.post(
        "/visit-signals",
        json={
            "external_id": "p1",
            "place_name": "테스트오름",
            "status": "maybe",
        },
    )

    assert resp.status_code == 422


def test_visit_signal_endpoint_survives_unavailable_db(monkeypatch):
    from apps.api import db

    def unavailable():
        raise RuntimeError("DATABASE_URL not set")

    monkeypatch.setattr(db, "get_engine", unavailable)

    resp = client.post(
        "/visit-signals",
        json={
            "external_id": "p1",
            "place_name": "테스트오름",
            "status": "info_mismatch",
            "mismatch_reason": "hours_wrong",
            "memo": "운영시간이 달랐음",
            "previous_trust_score": 82,
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["db_available"] is False
    assert data["previous_trust_score"] == 82
    assert data["updated_trust_score"] < 82
    assert data["trust_delta"] < 0
