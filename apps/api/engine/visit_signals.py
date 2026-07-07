"""방문 기록 신호 저장 및 신뢰도 업데이트 시뮬레이션.

원칙:
  - 방문 신호는 추천 사실을 만들지 않는다.
  - 이미 조회된 장소의 신뢰 점수 중 "visit_signal" 축에만 반영한다.
  - DB가 없으면 저장 실패를 명시하되 데모 흐름은 깨지지 않는다.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text

from apps.api import db

VALID_VISIT_STATUSES = {
    "visited",
    "not_visited",
    "changed",
    "info_mismatch",
    "satisfied",
    "unsatisfied",
}

STATUS_DELTAS: dict[str, int] = {
    "visited": 4,
    "not_visited": -2,
    "changed": -12,
    "info_mismatch": -14,
    "satisfied": 8,
    "unsatisfied": -9,
}


@dataclass(frozen=True)
class VisitSignalSaveResult:
    saved: bool
    db_available: bool
    signal_id: str | None
    previous_trust_score: int
    updated_trust_score: int
    trust_delta: int
    public_data_report: dict[str, Any]
    message: str


def clamp_score(value: int) -> int:
    return max(0, min(100, value))


def simulate_trust_update(previous_score: int | None, status: str) -> tuple[int, int, int]:
    previous = clamp_score(previous_score if previous_score is not None else 70)
    delta = STATUS_DELTAS.get(status, 0)
    updated = clamp_score(previous + delta)
    return previous, updated, updated - previous


def build_public_data_feedback_payload(
    payload: dict[str, Any],
    *,
    previous: int,
    updated: int,
) -> dict[str, Any]:
    return {
        "target_source": "public_data_correction_queue",
        "external_id": payload["external_id"],
        "place_name": payload.get("place_name"),
        "status": payload["status"],
        "mismatch_reason": payload.get("mismatch_reason"),
        "feedback_text": (payload.get("feedback_text") or payload.get("memo") or "").strip(),
        "trust_score_before": previous,
        "trust_score_after": updated,
    }


def save_visit_signal(payload: dict[str, Any]) -> VisitSignalSaveResult:
    previous, updated, delta = simulate_trust_update(
        payload.get("previous_trust_score"),
        str(payload["status"]),
    )
    try:
        engine = db.get_engine()
    except Exception as e:
        report_payload = build_public_data_feedback_payload(payload, previous=previous, updated=updated)
        return VisitSignalSaveResult(
            saved=False,
            db_available=False,
            signal_id=None,
            previous_trust_score=previous,
            updated_trust_score=updated,
            trust_delta=delta,
            public_data_report={
                "queued": False,
                "delivery_status": "local_only",
                "payload": report_payload,
            },
            message=f"db unavailable: {type(e).__name__}",
        )

    stmt = text(
        """
        INSERT INTO visit_signal (
          external_id, place_name, status, mismatch_reason, memo,
          previous_trust_score, updated_trust_score, score_breakdown
        )
        VALUES (
          :external_id, :place_name, :status, :mismatch_reason, :memo,
          :previous_trust_score, :updated_trust_score, CAST(:score_breakdown AS jsonb)
        )
        RETURNING id::text
        """
    )
    try:
        with engine.begin() as conn:
            signal_id = conn.execute(
                stmt,
                {
                    "external_id": payload["external_id"],
                    "place_name": payload.get("place_name"),
                    "status": payload["status"],
                    "mismatch_reason": payload.get("mismatch_reason"),
                    "memo": payload.get("memo"),
                    "previous_trust_score": previous,
                    "updated_trust_score": updated,
                    "score_breakdown": json.dumps(payload.get("score_breakdown") or {}),
                },
            ).scalar_one()
            report = _enqueue_public_data_feedback(
                conn,
                signal_id=signal_id,
                payload=payload,
                previous=previous,
                updated=updated,
            )
    except Exception as e:
        report_payload = build_public_data_feedback_payload(payload, previous=previous, updated=updated)
        return VisitSignalSaveResult(
            saved=False,
            db_available=True,
            signal_id=None,
            previous_trust_score=previous,
            updated_trust_score=updated,
            trust_delta=delta,
            public_data_report={
                "queued": False,
                "delivery_status": "save_failed",
                "payload": report_payload,
            },
            message=f"save failed: {type(e).__name__}",
        )

    return VisitSignalSaveResult(
        saved=True,
        db_available=True,
        signal_id=signal_id,
        previous_trust_score=previous,
        updated_trust_score=updated,
        trust_delta=delta,
        public_data_report=report,
        message="visit signal saved",
    )


def _enqueue_public_data_feedback(
    conn,
    *,
    signal_id: str,
    payload: dict[str, Any],
    previous: int,
    updated: int,
) -> dict[str, Any]:
    report_payload = build_public_data_feedback_payload(payload, previous=previous, updated=updated)
    feedback_text = report_payload["feedback_text"]
    if not feedback_text:
        return {
            "queued": False,
            "delivery_status": "no_feedback_text",
            "payload": report_payload,
        }
    report_id = conn.execute(
        text(
            """
            INSERT INTO public_data_feedback_queue (
              visit_signal_id, external_id, place_name, status, mismatch_reason,
              feedback_text, target_source, delivery_status, payload
            )
            VALUES (
              CAST(:visit_signal_id AS uuid), :external_id, :place_name, :status, :mismatch_reason,
              :feedback_text, :target_source, 'queued', CAST(:payload AS jsonb)
            )
            RETURNING id::text
            """
        ),
        {
            "visit_signal_id": signal_id,
            "external_id": report_payload["external_id"],
            "place_name": report_payload["place_name"],
            "status": report_payload["status"],
            "mismatch_reason": report_payload["mismatch_reason"],
            "feedback_text": feedback_text,
            "target_source": report_payload["target_source"],
            "payload": json.dumps(report_payload, ensure_ascii=False),
        },
    ).scalar_one()
    return {
        "queued": True,
        "delivery_status": "queued",
        "report_id": report_id,
        "payload": report_payload,
    }


def latest_visit_signal(external_id: str) -> dict[str, Any] | None:
    try:
        engine = db.get_engine()
    except Exception:
        return None
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT status, mismatch_reason, updated_trust_score, created_at
                      FROM visit_signal
                     WHERE external_id = :external_id
                     ORDER BY created_at DESC
                     LIMIT 1
                    """
                ),
                {"external_id": external_id},
            ).first()
    except Exception:
        return None
    if not row:
        return None
    return {
        "status": row.status,
        "mismatch_reason": row.mismatch_reason,
        "updated_trust_score": row.updated_trust_score,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
