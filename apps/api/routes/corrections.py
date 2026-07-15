from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from apps.api import db
from apps.api.auth import CurrentUser, require_admin, require_user

router = APIRouter(tags=["public-data-corrections"])


class CorrectionBody(BaseModel):
    claim_key: str = Field(min_length=1, max_length=100)
    corrected_value: dict[str, Any]
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class DecisionBody(BaseModel):
    rationale: str = Field(min_length=1, max_length=2000)


def _engine_or_503():
    try:
        return db.get_engine()
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "db_unavailable", "message": str(exc)}) from exc


@router.post("/places/{place_id}/corrections", status_code=201)
def propose_correction(place_id: int, body: CorrectionBody, user: CurrentUser = Depends(require_user)):
    engine = _engine_or_503()
    try:
        with engine.begin() as conn:
            case = conn.execute(text("""INSERT INTO moderation_case (place_id, case_type, claim_key, priority, priority_rank)
                                      VALUES (:place_id, 'info_mismatch', :claim_key, 'normal', 30)
                                      RETURNING id::text"""), {"place_id": place_id, "claim_key": body.claim_key}).scalar_one()
            conn.execute(text("""INSERT INTO evidence
                               (place_id, source_class, claim_type, claim_key, claim_value, support_status, payload)
                               VALUES (:place_id, 'user_feedback', 'fact', :claim_key,
                                       CAST(:claim_value AS jsonb), 'inferred',
                                       jsonb_build_object('author_id', :author))"""),
                         {"place_id": place_id, "claim_key": body.claim_key,
                          "claim_value": json.dumps(body.corrected_value), "author": user.profile_id})
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "correction_save_failed", "message": str(exc)}) from exc
    return {"moderation_case_id": case, "status": "pending_review"}


@router.post("/corrections/{case_id}/approve")
def approve_correction(case_id: str, body: DecisionBody, user: CurrentUser = Depends(require_admin)):
    engine = _engine_or_503()
    try:
        with engine.begin() as conn:
            row = conn.execute(text("SELECT place_id, claim_key FROM moderation_case WHERE id = CAST(:id AS uuid)"), {"id": case_id}).first()
            if row is None:
                raise HTTPException(status_code=404, detail={"error": "moderation_case_not_found"})
            decision_id = conn.execute(text("""INSERT INTO moderation_decision (case_id, reviewer_id, decision, rationale)
                                             VALUES (CAST(:case_id AS uuid), CAST(:reviewer AS uuid), 'approve', :rationale)
                                             RETURNING id::text"""), {"case_id": case_id, "reviewer": user.profile_id, "rationale": body.rationale}).scalar_one()
            claim = conn.execute(text("""SELECT claim_value FROM evidence
                                       WHERE place_id = :place_id AND claim_key = :claim_key
                                       ORDER BY created_at DESC LIMIT 1"""),
                                 {"place_id": row[0], "claim_key": row[1]}).scalar_one()
            conn.execute(text("""INSERT INTO public_data_correction
                               (place_id, claim_key, corrected_value, decision_id, approved_by)
                               VALUES (:place_id, :claim_key, CAST(:value AS jsonb), CAST(:decision AS uuid), CAST(:reviewer AS uuid))"""),
                         {"place_id": row[0], "claim_key": row[1], "value": claim,
                          "decision": decision_id, "reviewer": user.profile_id})
            conn.execute(text("UPDATE moderation_case SET status = 'resolved', research_status = 'sufficient', updated_at = now() WHERE id = CAST(:id AS uuid)"), {"id": case_id})
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "correction_approve_failed", "message": str(exc)}) from exc
    return {"case_id": case_id, "decision_id": decision_id, "status": "approved"}
