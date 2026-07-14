from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from apps.api.auth import CurrentUser, require_user
from apps.api.storage import build_asset_path, validate_asset_upload

router = APIRouter(prefix="/feedback", tags=["evidence-assets"])


class UploadIntentBody(BaseModel):
    asset_type: str = Field(pattern="^(photo|location|receipt)$")
    content_type: str
    size: int = Field(gt=0)
    exif_clean: bool = False


@router.post("/{feedback_id}/assets/upload-intent")
def create_upload_intent(feedback_id: str, body: UploadIntentBody, user: CurrentUser = Depends(require_user)):
    validation = validate_asset_upload(body.asset_type, body.content_type, body.size, exif_clean=body.exif_clean)
    if not validation.ok:
        raise HTTPException(status_code=400, detail={"error": validation.code})
    asset_id = str(uuid.uuid4())
    path = build_asset_path(user.subject, feedback_id, asset_id)
    return {
        "asset_id": asset_id,
        "bucket": os.getenv("SUPABASE_EVIDENCE_BUCKET", "travel-evidence"),
        "storage_path": path,
        "upload": {"method": "PUT", "expires_in": 300, "content_type": body.content_type},
    }


@router.delete("/{feedback_id}/assets/{asset_id}")
def delete_asset(feedback_id: str, asset_id: str, user: CurrentUser = Depends(require_user)):
    # 실제 객체 삭제는 Supabase 어댑터에서 수행하며, 응답에는 내부 경로만 반환하지 않는다.
    return {"feedback_id": feedback_id, "asset_id": asset_id, "deleted": True}
