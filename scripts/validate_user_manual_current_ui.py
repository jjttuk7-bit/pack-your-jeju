from __future__ import annotations

import sys
from pathlib import Path

from pypdf import PdfReader
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs/제주를_담다_사용자_매뉴얼_v1.2.pdf"
ASSET_DIR = ROOT / "docs/manual_assets"
ASSETS = [
    "01_landing.png",
    "02_region_and_moment.png",
    "03_pack_overview.png",
    "04_more_candidates.png",
    "05_plan_map.png",
    "06_haruban_research.png",
]
URL = "https://pack-your-jeju.vercel.app/"
REQUIRED = [
    "USER GUIDE · v1.2",
    "2026-07-16",
    URL,
    "앱처럼 설치하기 (PWA)",
    "Android · Chrome",
    "iPhone · Safari",
    "PC · Chrome / Edge",
    "인터넷 연결",
    "순간별 후보",
    "장소 대표이미지",
    "지도 마커",
    "하루방 웹검색",
    "플랜에 담기",
]
FORBIDDEN = ["GitHub", "깃허브", "API 키", "관리자 주소"]


def main() -> int:
    missing_assets = [name for name in ASSETS if not (ASSET_DIR / name).exists()]
    assert not missing_assets, f"missing assets: {missing_assets}"
    for name in ASSETS:
        with Image.open(ASSET_DIR / name) as image:
            assert image.width >= 900 and image.height >= 500, f"asset too small: {name} {image.size}"

    assert PDF.exists(), f"PDF not found: {PDF}"
    reader = PdfReader(str(PDF))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    uris: list[str] = []
    for page in reader.pages:
        for annotation in page.get("/Annots", []):
            obj = annotation.get_object()
            action = obj.get("/A")
            if action and action.get("/URI"):
                uris.append(str(action.get("/URI")))

    assert len(reader.pages) == 12, f"expected 12 pages, got {len(reader.pages)}"
    missing = [item for item in REQUIRED if item not in text]
    forbidden = [item for item in FORBIDDEN if item in text]
    assert not missing, f"required phrases missing: {missing}"
    assert not forbidden, f"forbidden phrases present: {forbidden}"
    assert any(uri.rstrip("/") == URL.rstrip("/") for uri in uris), f"service URL link missing: {uris}"

    print(f"PDF={PDF}")
    print(f"pages={len(reader.pages)} required_missing=0 forbidden_found=0 uri_links={len(uris)} PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
