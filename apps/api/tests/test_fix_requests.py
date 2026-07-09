from __future__ import annotations

from apps.api.engine.fix_requests import (
    classify_change_text,
    normalize_fix_request_row,
    summarize_change_text,
)


def test_normalize_fix_request_row_extracts_operating_hour_detail():
    row = {
        "요청아이디": "986",
        "콘텐츠아이디": "CONT_000000000500707",
        "제목": "마라도 자연생태관",
        "주소": "제주특별자치도 서귀포시",
        "도로명주소": "",
        "소개": "자연생태관",
        "변경사항": (
            "이용시간을 '매일 : 09:00 ~ 18:00' 로 표기해 주시고,"
            "이용시간 -> 관람시간으로 변경 부탁드립니다."
            "관람시간 : 09:00 ~ 17:30 (4~10월), 09:00~16:30(11~3월)"
        ),
    }

    detail = normalize_fix_request_row(row)

    assert detail is not None
    assert detail["request_id"] == "986"
    assert detail["external_id"] == "CONT_000000000500707"
    assert detail["change_type"] == "operating_hours"
    assert detail["before_text"] == "매일 : 09:00 ~ 18:00"
    assert "09:00 ~ 17:30" in detail["after_text"]
    assert "11~3월" in detail["after_text"]


def test_summarize_change_text_does_not_claim_before_after_when_unclear():
    text = "소개 문구와 이용안내 문장을 더 자세하게 수정 요청합니다."

    assert classify_change_text(text) == "description"
    summary = summarize_change_text(text)

    assert summary["before_text"] is None
    assert summary["after_text"] is None
    assert summary["display_text"] == text
