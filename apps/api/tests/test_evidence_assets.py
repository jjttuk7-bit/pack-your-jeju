import pytest

from apps.api.storage import build_asset_path, validate_asset_upload


def test_photo_upload_requires_exif_clean_marker():
    assert validate_asset_upload("photo", "image/jpeg", 1024, exif_clean=False).code == "exif_not_removed"
    assert validate_asset_upload("photo", "image/jpeg", 1024, exif_clean=True).ok


def test_receipt_upload_is_disabled_until_redaction_exists():
    result = validate_asset_upload("receipt", "application/pdf", 1024, exif_clean=True)
    assert result.code == "receipt_redaction_unavailable"


def test_asset_path_is_owner_scoped():
    assert build_asset_path("u1", "f1", "a1") == "u1/f1/a1"


@pytest.mark.parametrize("size", [0, 11 * 1024 * 1024])
def test_asset_size_is_rejected(size):
    assert validate_asset_upload("photo", "image/jpeg", size, exif_clean=True).code == "invalid_size"
