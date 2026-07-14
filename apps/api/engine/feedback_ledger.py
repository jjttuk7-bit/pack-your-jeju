from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from apps.api.auth import CurrentUser
from apps.api.engine.moderation import ModerationSignal, evaluate_signals


def _claim_from_payload(payload: dict[str, Any]) -> str:
    mismatch_types = payload.get("mismatch_types") or []
    if mismatch_types:
        return str(mismatch_types[0])
    operation = payload.get("operation_status")
    if operation in {"closed", "closure_suspected"}:
        return "폐업 의심"
    if operation in {"moved_suspected"}:
        return "이전 의심"
    return "현장 정보"


def record_moderation_signal(conn, *, place_id: Any, author_id: str, payload: dict[str, Any]) -> None:
    """피드백 저장 직후 누적 신호와 검토 큐를 같은 트랜잭션에서 갱신한다."""
    if place_id is None:
        return
    claim = _claim_from_payload(payload)
    rows = conn.execute(
        text("""SELECT author_id::text, submission_weight
                FROM visit_feedback
               WHERE place_id = :place_id
                 AND created_at >= now() - interval '30 days'"""),
        {"place_id": place_id},
    ).fetchall()
    signals = [ModerationSignal(claim, float(weight or 1.0)) for _, weight in rows]
    decision = evaluate_signals(signals)
    confidence = min(1.0, sum(signal.weight for signal in signals) / 3.0)
    conn.execute(
        text("""INSERT INTO place_trust_profile (place_id, operation_confidence, freshness_status, reasons)
               VALUES (:place_id, :confidence, 'fresh', CAST(:reasons AS jsonb))
               ON CONFLICT (place_id) DO UPDATE SET operation_confidence = EXCLUDED.operation_confidence,
                 freshness_status = EXCLUDED.freshness_status, reasons = EXCLUDED.reasons,
                 calculated_at = now()"""),
        {"place_id": place_id, "confidence": confidence,
         "reasons": json.dumps(["feedback_signal", f"reports:{len(signals)}"])},
    )
    if not decision.open_case:
        return
    existing = conn.execute(
        text("""SELECT id FROM moderation_case
               WHERE place_id = :place_id AND claim_key = :claim_key
                 AND status IN ('open', 'researching', 'review_pending')
               LIMIT 1"""),
        {"place_id": place_id, "claim_key": claim},
    ).first()
    if existing:
        conn.execute(text("UPDATE moderation_case SET priority = :priority, priority_rank = :rank, updated_at = now() WHERE id = :id"),
                     {"priority": decision.priority, "rank": decision.priority_rank, "id": existing[0]})
        return
    conn.execute(
        text("""INSERT INTO moderation_case
              (place_id, case_type, claim_key, priority, priority_rank, research_status)
              VALUES (:place_id, :case_type, :claim_key, :priority, :rank, 'pending')"""),
        {"place_id": place_id, "case_type": decision.case_type, "claim_key": claim,
         "priority": decision.priority, "rank": decision.priority_rank},
    )


def save_feedback(conn, user: CurrentUser, plan_id: str, item_id: str, payload: dict[str, Any], key: str) -> str:
    row = conn.execute(
        text("""SELECT pi.id::text, pi.place_id FROM plan_item pi JOIN travel_plan tp ON tp.id = pi.plan_id
                 WHERE tp.id = CAST(:plan_id AS uuid) AND pi.id = CAST(:item_id AS uuid)
                   AND tp.owner_scope_id = CAST(:scope_id AS uuid)"""),
        {"plan_id": plan_id, "item_id": item_id, "scope_id": user.profile_id},
    ).first()
    if row is None:
        raise LookupError("plan_item_not_found")
    existing = conn.execute(
        text("SELECT id::text FROM visit_feedback WHERE plan_item_id = CAST(:item_id AS uuid) "
             "AND author_id = CAST(:author_id AS uuid) AND idempotency_key = :key LIMIT 1"),
        {"item_id": item_id, "author_id": user.profile_id, "key": key},
    ).first()
    if existing:
        return existing[0]
    result = conn.execute(
        text("""INSERT INTO visit_feedback
          (plan_item_id, place_id, author_id, idempotency_key, visit_status, operation_status,
           mismatch_types, experience_tags, memo, submission_weight, moderation_status)
          VALUES (CAST(:item_id AS uuid), :place_id, CAST(:author_id AS uuid), :idempotency_key, :visit_status,
                  :operation_status, :mismatch_types, :experience_tags, :memo, 1.000,
                  'collecting_signals') RETURNING id::text"""),
        {"item_id": item_id, "place_id": row[1], "author_id": user.profile_id,
         "idempotency_key": key, "visit_status": payload["visit_status"], "operation_status": payload.get("operation_status"),
         "mismatch_types": payload.get("mismatch_types") or [], "experience_tags": payload.get("experience_tags") or [],
         "memo": payload.get("memo")},
    )
    feedback_id = result.scalar_one()
    record_moderation_signal(conn, place_id=row[1], author_id=user.profile_id, payload=payload)
    return feedback_id
