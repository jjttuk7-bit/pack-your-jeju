"""query_log 적재 (TRUST_ENGINE.md §7).

/admin/metrics는 이 테이블 집계만으로 구현되므로,
fallback_reasons에는 사용자 노출된 사유 + 관측된 retrieval_miss까지 포함한다 (Q2 결정).
"""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import text

from apps.api import db

event_log = logging.getLogger("pack_your_jeju.events")
_SENSITIVE_KEYS = {"authorization", "service_role_key", "access_token", "refresh_token"}


def log_contribution_event(event: str, *, actor_id: str | None = None, **fields: object) -> dict[str, object]:
    """기여·검토 이벤트를 비밀값 없이 구조화해 Railway 로그로 남긴다."""
    safe = {key: value for key, value in fields.items() if key.lower() not in _SENSITIVE_KEYS}
    payload: dict[str, object] = {"event": event, "actor_id": actor_id, **safe}
    event_log.info(json.dumps(payload, ensure_ascii=False, default=str, sort_keys=True))
    return payload


@dataclass
class QueryLogEntry:
    endpoint: str                          # pack | verify
    request: dict
    badge_counts: dict[str, int]
    fallback_reasons: list[str]
    latency_ms: int


def _insert(entry: QueryLogEntry) -> str | None:
    """INSERT into query_log. DB 미연결이면 조용히 None (데모 안전판)."""
    try:
        engine = db.get_engine()
    except Exception:
        return None
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO query_log
                        (endpoint, request, badge_counts, fallback_reasons, latency_ms)
                    VALUES
                        (:endpoint, CAST(:request AS jsonb),
                         CAST(:badge_counts AS jsonb),
                         :fallback_reasons, :latency_ms)
                    RETURNING id
                    """
                ),
                {
                    "endpoint": entry.endpoint,
                    "request": json.dumps(entry.request, ensure_ascii=False, default=str),
                    "badge_counts": json.dumps(entry.badge_counts, ensure_ascii=False),
                    "fallback_reasons": entry.fallback_reasons,
                    "latency_ms": entry.latency_ms,
                },
            ).first()
            return str(row.id) if row else None
    except Exception:
        return None


def log_pack(
    *,
    request: dict,
    badge_counts: dict[str, int],
    fallback_reasons: Iterable[str],
    latency_ms: int,
) -> str | None:
    return _insert(QueryLogEntry(
        endpoint="pack",
        request=request,
        badge_counts=badge_counts,
        fallback_reasons=list(fallback_reasons),
        latency_ms=latency_ms,
    ))


def log_verify(
    *,
    request: dict,
    verdict_counts: dict[str, int],
    fallback_reasons: Iterable[str],
    latency_ms: int,
) -> str | None:
    return _insert(QueryLogEntry(
        endpoint="verify",
        request=request,
        badge_counts=verdict_counts,  # verify에선 판정 counts로 재사용
        fallback_reasons=list(fallback_reasons),
        latency_ms=latency_ms,
    ))


@contextmanager
def measure_latency():
    t0 = time.perf_counter()
    holder = {"ms": 0}
    try:
        yield holder
    finally:
        holder["ms"] = int((time.perf_counter() - t0) * 1000)
