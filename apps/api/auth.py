"""Supabase JWT authentication boundary for authenticated contribution APIs."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

Role = Literal["user", "operator", "admin"]
bearer_scheme = HTTPBearer(auto_error=False)


class AuthConfigurationError(RuntimeError):
    pass


class AuthTokenError(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class AuthConfig:
    url: str
    jwks_url: str
    audience: str
    issuer: str


@dataclass(frozen=True)
class CurrentUser:
    subject: str
    profile_id: str
    role: Role


def auth_config() -> AuthConfig:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    jwks_url = os.environ.get("SUPABASE_JWKS_URL", "").strip()
    audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "").strip()
    if not url or not jwks_url or not audience:
        raise AuthConfigurationError("Supabase JWT configuration is incomplete")
    return AuthConfig(url=url, jwks_url=jwks_url, audience=audience, issuer=f"{url}/auth/v1")


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)


def _decode_signature(token: str, config: AuthConfig) -> dict[str, Any]:
    try:
        signing_key = _jwks_client(config.jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=config.audience,
            issuer=config.issuer,
            options={"require": ["sub", "aud", "exp", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthTokenError("expired_token") from exc
    except jwt.InvalidAudienceError as exc:
        raise AuthTokenError("invalid_audience") from exc
    except jwt.InvalidIssuerError as exc:
        raise AuthTokenError("invalid_issuer") from exc
    except jwt.PyJWTError as exc:
        raise AuthTokenError("invalid_token") from exc


def validate_claims(claims: dict[str, Any]) -> dict[str, Any]:
    config = auth_config()
    if claims.get("aud") != config.audience:
        raise AuthTokenError("invalid_audience")
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or exp <= time.time():
        raise AuthTokenError("expired_token")
    if claims.get("iss") not in (None, config.issuer):
        raise AuthTokenError("invalid_issuer")
    if not claims.get("sub"):
        raise AuthTokenError("invalid_subject")
    return claims


def user_from_claims(claims: dict[str, Any]) -> CurrentUser:
    validate_claims(claims)
    app_metadata = claims.get("app_metadata") or {}
    role_value = app_metadata.get("role") or claims.get("role")
    role: Role = role_value if role_value in {"operator", "admin"} else "user"
    profile_id = str(app_metadata.get("profile_id") or claims["sub"])
    return CurrentUser(subject=str(claims["sub"]), profile_id=profile_id, role=role)


def _auth_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": code, "message": message})


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _auth_error(401, "missing_bearer", "Bearer token is required")
    try:
        config = auth_config()
        claims = _decode_signature(credentials.credentials, config)
        return user_from_claims(claims)
    except AuthConfigurationError as exc:
        raise _auth_error(503, "auth_not_configured", str(exc)) from exc
    except AuthTokenError as exc:
        raise _auth_error(401, exc.code, "Token validation failed") from exc


def require_admin(user: CurrentUser = Depends(require_user)) -> CurrentUser:
    if user.role not in {"operator", "admin"}:
        raise _auth_error(403, "admin_required", "Operator or admin role is required")
    return user
