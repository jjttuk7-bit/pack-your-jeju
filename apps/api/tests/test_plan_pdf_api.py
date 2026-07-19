from __future__ import annotations

import io

from fastapi.testclient import TestClient
from pypdf import PdfReader

from apps.api.main import app
from apps.api.routes.plan_pdf import PlanPdfItemInput


client = TestClient(app)


def _valid_request(**overrides):
    body = {
        "title": "혼자 떠나는 제주시 힐링 여행",
        "travel": {
            "regions": ["jeju_city"],
            "start_date": "2026-07-16",
            "days": 2,
            "companion": "solo",
            "purpose": "healing",
            "moments": ["local_food", "quiet_cafe"],
        },
        "items": [
            {
                "id": "public-1",
                "name": "용두암",
                "day": 1,
                "order": 1,
                "source": "public_data",
                "address": "제주특별자치도 제주시 용두암길 15",
                "memo": "공항 도착 후 바다 산책",
                "badge": "verified",
                "source_title": "비짓제주 관광정보",
                "source_url": "https://www.visitjeju.net/example-yongduam",
                "checked_at": "2026-07-16T09:00:00+09:00",
                "check_required": ["weather", "movement"],
            },
            {
                "id": "web-1",
                "name": "우진해장국",
                "day": 1,
                "order": 2,
                "source": "web_search",
                "address": "제주특별자치도 제주시 서사로 11",
                "memo": "아침 식사 후보",
                "badge": "reference",
                "source_title": "Visit Jeju",
                "source_url": "https://www.visitjeju.net/example-woojin",
                "checked_at": "2026-07-16T10:00:00+09:00",
                "check_required": ["operating", "parking"],
            },
            {
                "id": "web-2",
                "name": "고요한 제주 카페",
                "day": 2,
                "order": 1,
                "source": "web_search",
                "address": "제주시 테스트로 22",
                "memo": "오후에 글쓰기",
                "source_title": "공식 인스타그램",
                "source_url": "https://example.com/cafe",
                "checked_at": "2026-07-16T11:00:00+09:00",
                "check_required": ["operating"],
            },
            {
                "id": "user-1",
                "name": "친구가 알려준 돌담길",
                "day": 2,
                "order": 2,
                "source": "user_added",
                "start_time": "18:30",
                "fixed": True,
                "memo": "숙소 근처인지 확인",
                "check_required": [],
            },
        ],
        "packing_items": ["보조배터리", "얇은 바람막이", "편한 운동화"],
    }
    body.update(overrides)
    return body


def test_plan_pdf_rejects_empty_items():
    response = client.post("/plan/pdf", json=_valid_request(items=[]))
    assert response.status_code == 422


def test_plan_pdf_rejects_invalid_title_source_and_day():
    title_response = client.post("/plan/pdf", json=_valid_request(title="제" * 81))
    assert title_response.status_code == 422

    invalid_source = _valid_request()
    invalid_source["items"][0]["source"] = "unknown"
    source_response = client.post("/plan/pdf", json=invalid_source)
    assert source_response.status_code == 422

    invalid_day = _valid_request()
    invalid_day["items"][0]["day"] = 3
    day_response = client.post("/plan/pdf", json=invalid_day)
    assert day_response.status_code == 422


def test_plan_pdf_rejects_invalid_start_time():
    invalid_time = _valid_request()
    invalid_time["items"][0]["start_time"] = "25:00"

    response = client.post("/plan/pdf", json=invalid_time)

    assert response.status_code == 422


def test_plan_pdf_rejects_start_time_with_unicode_digit():
    invalid_time = _valid_request()
    invalid_time["items"][0]["start_time"] = "18:3٣"

    response = client.post("/plan/pdf", json=invalid_time)

    assert response.status_code == 422


def test_plan_pdf_accepts_legacy_item_and_uses_schedule_defaults():
    legacy_request = _valid_request()
    legacy_item = legacy_request["items"][-1]
    legacy_item.pop("start_time")
    legacy_item.pop("fixed")

    response = client.post("/plan/pdf", json=legacy_request)
    parsed_item = PlanPdfItemInput.model_validate(legacy_item)

    assert response.status_code == 200
    assert parsed_item.start_time is None
    assert parsed_item.fixed is False


def test_plan_pdf_returns_passport_pdf_with_selected_places_and_evidence():
    response = client.post("/plan/pdf", json=_valid_request())

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "2026-07-16" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 10_000

    reader = PdfReader(io.BytesIO(response.content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    assert len(reader.pages) >= 5
    assert "혼자 떠나는 제주시 힐링 여행" in text
    assert "Day 1" in text
    assert "Day 2" in text
    assert "용두암" in text
    assert "우진해장국" in text
    assert "고요한 제주 카페" in text
    assert "친구가 알려준 돌담길" in text
    assert "보조배터리" in text
    assert "근거 확인" in text
    assert "공공데이터" in text
    assert "하루방 웹검색" in text
    assert "직접 추가·미검증" in text
    assert "18:30" in text
    assert "고정 일정" in text
    assert "사용자가 직접 입력한 일정입니다." in text
