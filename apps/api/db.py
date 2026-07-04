"""DB 유틸 — SQLAlchemy engine + .env 자동 로드.

.env 파일이 프로젝트 루트에 있으면 자동 로드한다.
CLAUDE.md 절대 규칙 6에 따라 DATABASE_URL 미설정도 즉시 크래시가 아니라
'미연결 상태'로 다루어 호출부가 폴백/스킵을 결정할 수 있게 한다.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_PATH = _PROJECT_ROOT / ".env"

log = logging.getLogger(__name__)


def load_env() -> None:
    """프로젝트 루트 .env 로드. 이미 설정된 os.environ 값은 덮어쓰지 않는다."""
    if _ENV_PATH.exists():
        load_dotenv(_ENV_PATH, override=False)


load_env()


def _normalize_url(url: str) -> str:
    # Railway/Heroku가 주는 postgres:// · postgresql:// 를 psycopg3 dialect로 강제.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def database_url() -> str | None:
    url = os.environ.get("DATABASE_URL", "").strip()
    return _normalize_url(url) if url else None


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    url = database_url()
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. .env에 DATABASE_URL을 설정하거나 환경변수로 넘겨주세요."
        )
    return create_engine(url, pool_pre_ping=True, future=True)


def ping() -> bool:
    """DB 접속 가능 여부. 데모/헬스체크용 — 실패 시 예외 없이 False."""
    try:
        with get_engine().connect() as c:
            c.execute(text("SELECT 1"))
        return True
    except Exception as e:
        # /health 응답이 원인을 못 담으므로 로그로 남긴다 (Railway logs에서 확인).
        log.warning("db.ping failed: %s: %s", type(e).__name__, e)
        return False
