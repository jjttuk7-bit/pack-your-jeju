from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import text

from apps.api import db
from apps.api.auth import CurrentUser, require_user
from apps.api.engine.plans import persist_plan

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanItemInput(BaseModel):
    client_item_id: str = Field(min_length=1, max_length=200)
    source_type: str = Field(pattern="^(public_data|web_search|user_input|community_verified)$")
    name: str = Field(min_length=1, max_length=200)
    source_snapshot: dict[str, Any] = Field(default_factory=dict)
    place_id: int | None = None
    day: int | None = Field(default=None, ge=1)
    visit_date: str | None = None
    note: str | None = Field(default=None, max_length=1000)


class PlanCreateBody(BaseModel):
    client_plan_id: str = Field(min_length=1, max_length=200)
    title: str | None = Field(default=None, max_length=200)
    start_date: str | None = None
    days: int | None = Field(default=None, ge=1, le=365)
    regions: list[str] = Field(default_factory=list, max_length=20)
    companion: str | None = None
    purpose: str | None = None
    visibility: str = Field(default="private", pattern="^(private|unlisted|public)$")
    items: list[PlanItemInput] = Field(default_factory=list, max_length=100)


def _engine_or_503():
    try:
        return db.get_engine()
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "db_unavailable", "message": str(exc)}) from exc


@router.post("")
def create_plan(body: PlanCreateBody, user: CurrentUser = Depends(require_user)):
    engine = _engine_or_503()
    try:
        with engine.begin() as conn:
            plan_id = persist_plan(conn, user, body.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "plan_save_failed", "message": str(exc)}) from exc
    return {"id": plan_id, "client_plan_id": body.client_plan_id, "saved": True}


@router.get("")
def list_plans(user: CurrentUser = Depends(require_user)):
    engine = _engine_or_503()
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id::text, client_plan_id, title, start_date, days, regions, visibility, updated_at "
                 "FROM travel_plan WHERE owner_scope_id = CAST(:scope_id AS uuid) ORDER BY updated_at DESC"),
            {"scope_id": user.profile_id},
        ).mappings().all()
    return {"plans": [dict(row) for row in rows]}


@router.get("/{plan_id}")
def get_plan(plan_id: str = Path(min_length=1), user: CurrentUser = Depends(require_user)):
    engine = _engine_or_503()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id::text, client_plan_id, title, start_date, days, regions, visibility "
                 "FROM travel_plan WHERE id = CAST(:id AS uuid) AND owner_scope_id = CAST(:scope_id AS uuid)"),
            {"id": plan_id, "scope_id": user.profile_id},
        ).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail={"error": "plan_not_found"})
        items = conn.execute(
            text("SELECT id::text, client_item_id, source_type, source_snapshot, day, visit_date, note "
                 "FROM plan_item WHERE plan_id = CAST(:id AS uuid) ORDER BY day NULLS LAST, created_at"),
            {"id": plan_id},
        ).mappings().all()
    return {"plan": dict(row), "items": [dict(item) for item in items]}


@router.delete("/{plan_id}/items/{client_item_id}")
def delete_plan_item(plan_id: str, client_item_id: str, user: CurrentUser = Depends(require_user)):
    engine = _engine_or_503()
    with engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM plan_item WHERE plan_id = CAST(:plan_id AS uuid) "
                 "AND client_item_id = :client_item_id "
                 "AND EXISTS (SELECT 1 FROM travel_plan WHERE id = plan_item.plan_id "
                 "AND owner_scope_id = CAST(:scope_id AS uuid))"),
            {"plan_id": plan_id, "client_item_id": client_item_id, "scope_id": user.profile_id},
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail={"error": "plan_item_not_found"})
    return {"deleted": True, "client_item_id": client_item_id}
