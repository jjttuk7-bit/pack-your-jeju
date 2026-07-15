from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from apps.api import db
from apps.api.auth import CurrentUser, require_admin

router = APIRouter(prefix="/admin", tags=["moderation"])


@router.get("/moderation-cases")
def list_moderation_cases(limit: int = Query(default=50, ge=1, le=200), user: CurrentUser = Depends(require_admin)):
    try:
        engine = db.get_engine()
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"error": "db_unavailable", "message": str(exc)}) from exc
    with engine.connect() as conn:
        rows = conn.execute(text("""SELECT id::text, place_id, case_type, claim_key, status, priority,
                                          priority_rank, research_status, opened_at, updated_at
                                     FROM moderation_case
                                    WHERE status IN ('open', 'researching', 'review_pending')
                                    ORDER BY priority_rank DESC, opened_at ASC
                                    LIMIT :limit"""), {"limit": limit}).mappings().all()
    return {"cases": [dict(row) for row in rows], "count": len(rows)}
