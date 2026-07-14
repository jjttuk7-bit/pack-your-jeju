from fastapi.testclient import TestClient

from apps.api.main import app


client = TestClient(app)


def test_feedback_requires_login():
    response = client.post("/plans/p1/items/i1/feedback", json={"visit_status": "visited"})
    assert response.status_code == 401


def test_feedback_rejects_unknown_visit_status_after_auth(monkeypatch):
    monkeypatch.setattr(
        "apps.api.auth._decode_signature",
        lambda token, config: {"sub": "00000000-0000-0000-0000-000000000001", "aud": "authenticated", "exp": 9999999999},
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/jwks")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    response = client.post(
        "/plans/p1/items/i1/feedback",
        headers={"Authorization": "Bearer test", "Idempotency-Key": "f1"},
        json={"visit_status": "maybe"},
    )
    assert response.status_code == 422
