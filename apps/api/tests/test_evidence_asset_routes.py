from fastapi.testclient import TestClient

from apps.api.main import app


client = TestClient(app)


def _auth(monkeypatch):
    monkeypatch.setattr(
        "apps.api.auth._decode_signature",
        lambda token, config: {"sub": "00000000-0000-0000-0000-000000000001", "aud": "authenticated", "exp": 9999999999},
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/jwks")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    return {"Authorization": "Bearer test"}


def test_upload_intent_requires_login():
    response = client.post("/feedback/f1/assets/upload-intent", json={"asset_type": "photo", "content_type": "image/jpeg", "size": 100, "exif_clean": True})
    assert response.status_code == 401


def test_receipt_upload_is_rejected_until_redaction_exists(monkeypatch):
    response = client.post(
        "/feedback/f1/assets/upload-intent",
        headers=_auth(monkeypatch),
        json={"asset_type": "receipt", "content_type": "image/jpeg", "size": 100, "exif_clean": True},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "receipt_redaction_unavailable"


def test_upload_intent_is_owner_scoped_and_does_not_expose_service_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_EVIDENCE_BUCKET", "travel-evidence")
    response = client.post(
        "/feedback/f1/assets/upload-intent",
        headers=_auth(monkeypatch),
        json={"asset_type": "photo", "content_type": "image/jpeg", "size": 100, "exif_clean": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["storage_path"].startswith("00000000-0000-0000-0000-000000000001/f1/")
    assert "service_role" not in str(body).lower()
    assert body["upload"]["method"] == "PUT"


def test_upload_intent_rejects_unclean_photo(monkeypatch):
    response = client.post(
        "/feedback/f1/assets/upload-intent",
        headers=_auth(monkeypatch),
        json={"asset_type": "photo", "content_type": "image/jpeg", "size": 100, "exif_clean": False},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "exif_not_removed"
