from __future__ import annotations

from apps.api.engine.weather import parse_kma_api_hub_forecast


def test_parse_kma_api_hub_forecast_extracts_weather_signals():
    raw = """
    #START7777
    발표시각 2026년 7월 7일 17시
    제주도는 내일 새벽부터 비가 오겠고, 산지와 해안에는 바람이 강하게 불겠습니다.
    예상 강수량은 5~20mm입니다. 해상에는 풍랑에 유의하기 바랍니다.
    #7777END
    """

    parsed = parse_kma_api_hub_forecast(raw)

    assert parsed["available"] is True
    assert parsed["provider"] == "kma_api_hub"
    assert "rain" in parsed["signals"]
    assert "wind" in parsed["signals"]
    assert "wave" in parsed["signals"]
    assert parsed["risk_level"] == "caution"
    assert parsed["labels"] == ["비 예보", "강풍 주의", "풍랑 주의"]
    assert "비가 오겠고" in parsed["summary"]


def test_parse_kma_api_hub_forecast_marks_clear_text_as_normal():
    raw = "제주도는 대체로 맑겠고 바다의 물결은 낮게 일겠습니다."

    parsed = parse_kma_api_hub_forecast(raw)

    assert parsed["available"] is True
    assert parsed["signals"] == []
    assert parsed["risk_level"] == "normal"
    assert parsed["labels"] == ["날씨 특이 신호 없음"]


def test_parse_kma_api_hub_forecast_hides_machine_code_rows():
    raw = """
    11000000 199001010000 210012310000 A 울산 11A00000 201501221100 210012310000 A 서해5도
    210012310000 B 서해5도 11A00101 201610131800 210012310000 C 백령도
    """

    parsed = parse_kma_api_hub_forecast(raw)

    assert parsed["available"] is False
    assert parsed["labels"] == ["날씨 판단 보류"]
    assert "11000000" not in parsed["summary"]
    assert "210012310000" not in parsed["summary"]
    assert "비·바람·풍랑 같은 여행 판단 문장" in parsed["summary"]


def test_parse_kma_api_hub_forecast_exposes_issued_at_label():
    raw = """
    발표시각 2026년 7월 8일 05시
    제주도는 오늘 오후 비가 오겠습니다.
    """

    parsed = parse_kma_api_hub_forecast(raw)

    assert parsed["issued_at_label"] == "2026년 7월 8일 05시 발표"
