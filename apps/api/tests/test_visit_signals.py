from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.engine.visit_signals import build_public_data_feedback_payload
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
            "feedback_text": "오후 5시에 갔는데 이미 닫혀 있었습니다.",
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
    assert data["public_data_report"]["queued"] is False
    assert data["public_data_report"]["delivery_status"] == "local_only"


def test_build_public_data_feedback_payload_keeps_user_feedback_separate():
    payload = build_public_data_feedback_payload(
        {
            "external_id": "p1",
            "place_name": "테스트오름",
            "status": "info_mismatch",
            "mismatch_reason": "hours_wrong",
            "feedback_text": "운영시간이 달랐습니다.",
        },
        previous=82,
        updated=68,
    )

    assert payload["target_source"] == "public_data_correction_queue"
    assert payload["external_id"] == "p1"
    assert payload["place_name"] == "테스트오름"
    assert payload["feedback_text"] == "운영시간이 달랐습니다."
    assert payload["status"] == "info_mismatch"
    assert payload["mismatch_reason"] == "hours_wrong"
    assert payload["trust_score_before"] == 82
    assert payload["trust_score_after"] == 68
