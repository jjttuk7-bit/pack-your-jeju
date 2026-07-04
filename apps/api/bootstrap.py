"""DB 부트스트랩 — startup 시 packages/schema/init.sql 을 idempotent 실행.

CLAUDE.md 절대 규칙 6: DB 미연결/실패는 앱 크래시로 확장하지 않는다.
init.sql은 모두 IF NOT EXISTS로 작성돼 있어 반복 실행이 안전하다.

문장 단위로 개별 트랜잭션 실행 → EXTENSION 하나가 실패해도 나머지 테이블은 뜬다.
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text

from apps.api import db

log = logging.getLogger(__name__)

_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "packages" / "schema" / "init.sql"


def _split_statements(sql: str) -> list[str]:
    # init.sql은 함수/DO 블록·$$..$$ 를 쓰지 않으므로 단순 ';' 분리로 충분.
    stmts: list[str] = []
    for chunk in sql.split(";"):
        s = "\n".join(
            line for line in chunk.splitlines() if not line.strip().startswith("--")
        ).strip()
        if s:
            stmts.append(s)
    return stmts


def apply_schema() -> dict:
    """/health 이후 startup에서 호출. 상세 결과를 dict로 돌려 로깅·헬스체크 참고용."""
    result: dict = {"applied": 0, "failed": 0, "errors": []}
    if not _SCHEMA_PATH.exists():
        log.warning("bootstrap: schema file missing at %s", _SCHEMA_PATH)
        result["errors"].append(f"schema file missing: {_SCHEMA_PATH}")
        return result
    try:
        engine = db.get_engine()
    except Exception as e:
        log.warning("bootstrap: db unavailable — skip (%s: %s)", type(e).__name__, e)
        result["errors"].append(f"{type(e).__name__}: {e}")
        return result

    stmts = _split_statements(_SCHEMA_PATH.read_text(encoding="utf-8"))
    for stmt in stmts:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
            result["applied"] += 1
        except Exception as e:
            result["failed"] += 1
            head = stmt.splitlines()[0][:80]
            msg = f"{type(e).__name__}: {e}"
            result["errors"].append(f"[{head}] {msg}")
            log.warning("bootstrap: statement failed — %s :: %s", head, msg)
    log.info("bootstrap: applied=%d failed=%d", result["applied"], result["failed"])
    return result
