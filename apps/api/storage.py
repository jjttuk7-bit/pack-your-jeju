from __future__ import annotations

from dataclasses import dataclass

ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_ASSET_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class AssetValidation:
    ok: bool
    code: str


def validate_asset_upload(asset_type: str, content_type: str, size: int, *, exif_clean: bool) -> AssetValidation:
    if size <= 0 or size > MAX_ASSET_BYTES:
        return AssetValidation(False, "invalid_size")
    if asset_type == "receipt":
        return AssetValidation(False, "receipt_redaction_unavailable")
    if asset_type == "photo" and content_type in ALLOWED_PHOTO_TYPES and exif_clean:
        return AssetValidation(True, "ok")
    if asset_type == "photo" and not exif_clean:
        return AssetValidation(False, "exif_not_removed")
    if asset_type == "location" and content_type == "application/json":
        return AssetValidation(True, "ok")
    return AssetValidation(False, "unsupported_asset")


def build_asset_path(owner_id: str, feedback_id: str, asset_id: str) -> str:
    return f"{owner_id}/{feedback_id}/{asset_id}"
