from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from apps.api import db
from apps.api.auth import CurrentUser, require_user
from apps.api.engine.feedback_ledger import save_feedback

router = APIRouter(prefix="/plans", tags=["feedback"])


class FeedbackBody(BaseModel):
    visit_status: Literal["visited", "not_visited", "could_not_find"]
    operation_status: Literal["open", "closed", "temporarily_closed", "closure_suspected", "moved_suspected", "unknown"] | None = None
    mismatch_types: list[str] = Field(default_factory=list, max_length=10)
    experience_tags: list[str] = Field(default_factory=list, max_length=20)
    memo: str | None = Field(default=None, max_length=2000)


@router.post("/{plan_id}/items/{item_id}/feedback", status_code=201)
def submit_feedback(
    plan_id: str,
    item_id: str,
    body: FeedbackBody,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: CurrentUser = Depends(require_user),
):
    if not idempotency_key:
        raise HTTPException(status_code=400, detail={"error": "idempotency_key_required"})
    try:
        engine = db.get_engine()
        with engine.begin() as conn:
            feedback_id = save_feedback(conn, user, plan_id, item_id, body.model_dump(), idempotency_key)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "feedback_save_failed", "message": str(exc)}) from exc
    return {"id": feedback_id, "moderation_status": "collecting_signals", "public_data_changed": False}
