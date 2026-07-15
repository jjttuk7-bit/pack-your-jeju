from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from pypdf import PdfReader


DOCX = Path(
    "docs/competition/2026-jeju-public-data-ai/"
    "04_제주를담다_공공데이터_라이프사이클_사업계획서.docx"
)
PDF = Path(
    "docs/competition/2026-jeju-public-data-ai/"
    "04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf"
)
SERVICE_URL = "https://pack-your-jeju.vercel.app"

REQUIRED = [
    "공공데이터 라이프사이클",
    "공공데이터 후보",
    "하루방 웹검색",
    "사용자 직접입력",
    "실제 여행",
    "근거 원장",
    "운영자 검토",
    "버전형 보정",
    "현재 MVP",
    "고도화 계획",
    "개인 1인 창업자",
    SERVICE_URL,
]

FORBIDDEN = [
    "팀원",
    "자동으로 공공데이터를 수정",
    "기관 협력 확정",
    "매출 확정",
]


def extract_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        required_parts = {
            "[Content_Types].xml",
            "word/document.xml",
            "word/_rels/document.xml.rels",
        }
        missing = sorted(required_parts - names)
        if missing:
            raise AssertionError(f"DOCX package parts missing: {missing}")
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return "".join(node.text or "" for node in root.findall(".//w:t", namespace))


def extract_pdf(reader: PdfReader) -> tuple[str, list[str]]:
    body = "\n".join(page.extract_text() or "" for page in reader.pages)
    uris: list[str] = []
    for page in reader.pages:
        for annotation in page.get("/Annots", []):
            obj = annotation.get_object()
            action = obj.get("/A")
            if action and action.get("/URI"):
                uris.append(str(action.get("/URI")))
    return body, uris


def main() -> int:
    assert DOCX.exists(), f"DOCX not found: {DOCX}"
    assert PDF.exists(), f"PDF not found: {PDF}"

    docx_text = extract_docx_text(DOCX)
    reader = PdfReader(str(PDF))
    pdf_text, uris = extract_pdf(reader)
    combined = docx_text + "\n" + pdf_text

    assert len(reader.pages) == 10, f"expected 10 pages, got {len(reader.pages)}"
    missing_required = [item for item in REQUIRED if item not in combined]
    present_forbidden = [item for item in FORBIDDEN if item in combined]
    assert not missing_required, f"required phrases missing: {missing_required}"
    assert not present_forbidden, f"forbidden overclaims present: {present_forbidden}"
    assert any(uri.rstrip("/") == SERVICE_URL for uri in uris), f"service URL annotation missing: {uris}"

    print(f"DOCX={DOCX.resolve()}")
    print(f"PDF={PDF.resolve()}")
    print(
        f"pages={len(reader.pages)} required={len(REQUIRED)} "
        f"forbidden=0 uri_links={len(uris)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
