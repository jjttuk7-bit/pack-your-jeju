from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from apps.api.auth import CurrentUser


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
    return result.scalar_one()
