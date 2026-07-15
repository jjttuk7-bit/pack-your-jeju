from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def _auth(monkeypatch, role="user"):
    monkeypatch.setattr("apps.api.auth._decode_signature", lambda token, config: {"sub": "00000000-0000-0000-0000-000000000001", "aud": "authenticated", "exp": 9999999999, "app_metadata": {"role": role}})
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/jwks")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    return {"Authorization": "Bearer test"}


def test_moderation_queue_requires_operator(monkeypatch):
    response = client.get("/admin/moderation-cases", headers=_auth(monkeypatch))
    assert response.status_code == 403


def test_moderation_queue_reports_db_unavailable(monkeypatch):
    from apps.api import db
    monkeypatch.setattr(db, "get_engine", lambda: (_ for _ in ()).throw(RuntimeError("db down")))
    response = client.get("/admin/moderation-cases", headers=_auth(monkeypatch, "operator"))
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "db_unavailable"
