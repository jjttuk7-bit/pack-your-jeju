from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def _auth(monkeypatch, role="user"):
    monkeypatch.setattr(
        "apps.api.auth._decode_signature",
        lambda token, config: {"sub": "00000000-0000-0000-0000-000000000001", "aud": "authenticated", "exp": 9999999999, "app_metadata": {"role": role}},
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/jwks")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    return {"Authorization": "Bearer test"}


def test_correction_requires_login():
    response = client.post("/places/42/corrections", json={"claim_key": "operation_status", "corrected_value": {"status": "closed"}})
    assert response.status_code == 401


def test_correction_requires_operator_for_approval(monkeypatch):
    response = client.post("/corrections/c1/approve", headers=_auth(monkeypatch), json={"rationale": "확인"})
    assert response.status_code == 403


def test_correction_payload_rejects_empty_claim(monkeypatch):
    response = client.post("/places/42/corrections", headers=_auth(monkeypatch), json={"claim_key": "", "corrected_value": {}})
    assert response.status_code == 422
