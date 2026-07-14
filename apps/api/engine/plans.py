from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from apps.api.auth import CurrentUser


def persist_plan(conn, user: CurrentUser, body: dict[str, Any]) -> str:
    """Persist one plan and its items; caller owns the transaction."""
    conn.execute(
        text(
            """INSERT INTO user_profile (id, auth_subject, role)
               VALUES (CAST(:id AS uuid), :subject, :role)
               ON CONFLICT (id) DO UPDATE SET auth_subject = EXCLUDED.auth_subject,
                 role = EXCLUDED.role, status = 'active'"""
        ),
        {"id": user.profile_id, "subject": user.subject, "role": user.role},
    )
    plan_id = conn.execute(
        text(
            """INSERT INTO travel_plan
              (owner_id, owner_scope_id, client_plan_id, title, start_date, days,
               regions, companion, purpose, visibility)
              VALUES (CAST(:owner_id AS uuid), CAST(:scope_id AS uuid), :client_id,
                      :title, CAST(:start_date AS date), :days, :regions, :companion,
                      :purpose, :visibility)
              ON CONFLICT (owner_scope_id, client_plan_id)
              DO UPDATE SET updated_at = now()
              RETURNING id::text"""
        ),
        {
            "owner_id": user.profile_id,
            "scope_id": user.profile_id,
            "client_id": body["client_plan_id"],
            "title": body.get("title"),
            "start_date": body.get("start_date"),
            "days": body.get("days"),
            "regions": body.get("regions") or [],
            "companion": body.get("companion"),
            "purpose": body.get("purpose"),
            "visibility": body.get("visibility", "private"),
        },
    ).scalar_one()
    for item in body.get("items") or []:
        conn.execute(
            text(
                """INSERT INTO plan_item
                  (plan_id, place_id, client_item_id, source_type, source_snapshot,
                   day, visit_date, note)
                  VALUES (CAST(:plan_id AS uuid), :place_id, :client_item_id, :source_type,
                          CAST(:snapshot AS jsonb), :day, CAST(:visit_date AS date), :note)
                  ON CONFLICT (plan_id, client_item_id)
                  DO UPDATE SET day = EXCLUDED.day, visit_date = EXCLUDED.visit_date,
                    note = EXCLUDED.note"""
            ),
            {
                "plan_id": plan_id,
                "place_id": item.get("place_id"),
                "client_item_id": item["client_item_id"],
                "source_type": item["source_type"],
                "snapshot": json.dumps(item.get("source_snapshot") or {}, ensure_ascii=False),
                "day": item.get("day"),
                "visit_date": item.get("visit_date"),
                "note": item.get("note"),
            },
        )
    return plan_id
