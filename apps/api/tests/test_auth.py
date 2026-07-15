import time

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from apps.api import auth


def _test_app() -> FastAPI:
    app = FastAPI()

    @app.get("/protected")
    def protected(user=Depends(auth.require_user)):
        return {"subject": user.subject, "role": user.role}

    return app


def test_missing_bearer_returns_401(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    response = TestClient(_test_app()).get("/protected")
    assert response.status_code == 401
    assert response.json()["detail"]["error"] == "missing_bearer"


@pytest.mark.parametrize(
    ("claims", "expected"),
    [
        ({"sub": "u1", "aud": "wrong", "exp": time.time() + 60}, "invalid_audience"),
        ({"sub": "u1", "aud": "authenticated", "exp": time.time() - 1}, "expired_token"),
        ({"sub": "u1", "aud": "authenticated", "exp": time.time() + 60, "iss": "https://other"}, "invalid_issuer"),
    ],
)
def test_claim_validation_rejects_expired_or_wrong_audience(monkeypatch, claims, expected):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    with pytest.raises(auth.AuthTokenError) as exc:
        auth.validate_claims(claims)
    assert exc.value.code == expected


def test_verified_claims_create_normal_user(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    user = auth.user_from_claims(
        {"sub": "u1", "aud": "authenticated", "exp": time.time() + 60, "iss": "https://example.supabase.co/auth/v1", "app_metadata": {}}
    )
    assert user.subject == "u1"
    assert user.profile_id == "u1"
    assert user.role == "user"


def test_admin_claims_create_admin_user(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    user = auth.user_from_claims(
        {
            "sub": "u1",
            "aud": "authenticated",
            "exp": time.time() + 60,
            "app_metadata": {"role": "admin", "profile_id": "p1"},
        }
    )
    assert user.profile_id == "p1"
    assert user.role == "admin"


def test_normal_user_is_forbidden_from_admin_dependency(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(
        auth,
        "_decode_signature",
        lambda token, config: {"sub": "u1", "aud": "authenticated", "exp": time.time() + 60},
    )
    app = FastAPI()

    @app.get("/admin")
    def admin_only(user=Depends(auth.require_admin)):
        return {"role": user.role}

    response = TestClient(app).get("/admin", headers={"Authorization": "Bearer test"})
    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "admin_required"


def test_admin_user_passes_admin_dependency(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(
        auth,
        "_decode_signature",
        lambda token, config: {
            "sub": "u1",
            "aud": "authenticated",
            "exp": time.time() + 60,
            "app_metadata": {"role": "admin"},
        },
    )
    app = FastAPI()

    @app.get("/admin")
    def admin_only(user=Depends(auth.require_admin)):
        return {"role": user.role}

    response = TestClient(app).get("/admin", headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    assert response.json() == {"role": "admin"}


def test_missing_auth_configuration_returns_503(monkeypatch):
    for key in ("SUPABASE_URL", "SUPABASE_JWKS_URL", "SUPABASE_JWT_AUDIENCE"):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(auth.AuthConfigurationError):
        auth.auth_config()
