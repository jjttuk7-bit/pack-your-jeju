"""VisitJeju 콘텐츠 수정요청 상세 근거.

수정요청은 "틀림" 단정이 아니라 "방문 전 확인 필요" 신호다.
가능하면 변경 전/후를 구조화하고, 불명확하면 원문 근거만 보존한다.
"""
from __future__ import annotations

import re
from typing import Any, Mapping

from sqlalchemy import text

from apps.api import db


REQUEST_ID_KEYS = ("요청아이디", "request_id", "REQUEST_ID", "id")
CONTENT_ID_KEYS = (
    "콘텐츠아이디",
    "contentsid",
    "CONTENTS_ID",
    "contents_id",
    "CONTENTSID",
    "contentsId",
)
TITLE_KEYS = ("제목", "title", "TITLE")
ADDRESS_KEYS = ("주소", "address", "ADDRESS")
ROAD_ADDRESS_KEYS = ("도로명주소", "road_address", "ROAD_ADDRESS")
INTRO_KEYS = ("소개", "intro", "INTRO")
CHANGE_TEXT_KEYS = ("변경사항", "change_text", "CHANGE_TEXT", "내용")

CHANGE_TYPE_LABELS = {
    "operating_hours": "운영시간 변경 요청",
    "address_location": "주소/위치 수정 요청",
    "fee": "요금 정보 수정 요청",
    "contact": "연락처 수정 요청",
    "closure_status": "운영 상태 확인 요청",
    "description": "상세정보 수정 요청",
    "general": "수정요청",
}


def pick_first(row: Mapping[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def classify_change_text(text_value: str | None) -> str:
    text_value = (text_value or "").strip()
    if not text_value:
        return "general"
    if any(k in text_value for k in ("이용시간", "운영시간", "관람시간", "영업시간", "입장시간")):
        return "operating_hours"
    if any(k in text_value for k in ("주소", "도로명", "위치", "지도", "좌표")):
        return "address_location"
    if any(k in text_value for k in ("요금", "가격", "입장료", "이용료")):
        return "fee"
    if any(k in text_value for k in ("전화", "연락처", "문의")):
        return "contact"
    if any(k in text_value for k in ("폐업", "휴업", "운영종료", "영업종료")):
        return "closure_status"
    if any(k in text_value for k in ("소개", "상세", "내용", "문구", "설명", "이용안내")):
        return "description"
    return "general"


def summarize_change_text(text_value: str | None) -> dict[str, str | None]:
    raw = " ".join((text_value or "").split())
    if not raw:
        return {"before_text": None, "after_text": None, "display_text": None}

    before_text = _extract_before_text(raw)
    after_text = _extract_after_text(raw)
    return {
        "before_text": before_text,
        "after_text": after_text,
        "display_text": raw[:360],
    }


def normalize_fix_request_row(row: Mapping[str, Any]) -> dict[str, Any] | None:
    external_id = pick_first(row, CONTENT_ID_KEYS)
    change_text = pick_first(row, CHANGE_TEXT_KEYS)
    if not external_id or not change_text:
        return None

    request_id = pick_first(row, REQUEST_ID_KEYS) or external_id
    summary = summarize_change_text(change_text)
    return {
        "request_id": request_id,
        "external_id": external_id,
        "title": pick_first(row, TITLE_KEYS),
        "address": pick_first(row, ADDRESS_KEYS),
        "road_address": pick_first(row, ROAD_ADDRESS_KEYS),
        "intro": pick_first(row, INTRO_KEYS),
        "change_text": change_text.strip(),
        "change_type": classify_change_text(change_text),
        "before_text": summary["before_text"],
        "after_text": summary["after_text"],
        "display_text": summary["display_text"],
    }


def fetch_fix_request_summary(external_id: str, *, limit: int = 3) -> dict[str, Any] | None:
    """장소별 수정요청 상세를 조회한다.

    배포 직후 스키마가 아직 반영되지 않은 경우에도 서비스가 죽지 않도록
    실패 시 None을 반환한다.
    """
    if not external_id:
        return None

    try:
        engine = db.get_engine()
        with engine.connect() as conn:
            count = conn.execute(
                text("SELECT COUNT(*) FROM fix_request_detail WHERE external_id = :external_id"),
                {"external_id": external_id},
            ).scalar_one()
            rows = conn.execute(
                text(
                    "SELECT request_id, title, address, road_address, intro, change_text, "
                    "       change_type, before_text, after_text, display_text, created_at "
                    "FROM fix_request_detail "
                    "WHERE external_id = :external_id "
                    "ORDER BY id DESC "
                    "LIMIT :limit"
                ),
                {"external_id": external_id, "limit": limit},
            ).mappings().all()
    except Exception:
        return None

    requests = [_row_to_payload(row) for row in rows]
    if not count and not requests:
        return None
    return {"count": int(count or 0), "requests": requests}


def _row_to_payload(row: Mapping[str, Any]) -> dict[str, Any]:
    change_type = str(row.get("change_type") or "general")
    return {
        "request_id": row.get("request_id"),
        "title": row.get("title"),
        "address": row.get("address"),
        "road_address": row.get("road_address"),
        "intro": row.get("intro"),
        "change_type": change_type,
        "change_type_label": CHANGE_TYPE_LABELS.get(change_type, CHANGE_TYPE_LABELS["general"]),
        "change_text": row.get("change_text"),
        "before_text": row.get("before_text"),
        "after_text": row.get("after_text"),
        "display_text": row.get("display_text") or row.get("change_text"),
    }


def _extract_before_text(raw: str) -> str | None:
    quoted = re.search(r"(?:이용시간|운영시간|관람시간|영업시간)[^'\"]*['\"]([^'\"]{4,80})['\"]", raw)
    if quoted:
        return quoted.group(1).strip()

    arrow = re.search(r"(.{0,80}?\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}).{0,20}?(?:->|→|에서)", raw)
    if arrow:
        return _clean_fragment(arrow.group(1))
    return None


def _extract_after_text(raw: str) -> str | None:
    labeled = re.search(
        r"(?:관람시간|운영시간|이용시간|영업시간)\s*[:：]\s*(.{0,180})",
        raw,
    )
    if labeled:
        return _clean_fragment(labeled.group(1))

    arrow = re.search(r"(?:->|→)\s*(.{0,180})", raw)
    if arrow:
        return _clean_fragment(arrow.group(1))
    return None


def _clean_fragment(value: str) -> str:
    return value.strip(" .,-/|")
