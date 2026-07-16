from __future__ import annotations

from datetime import date

from apps.api.engine.weather import parse_kma_api_hub_forecast, parse_vilage_fcst_payload


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


def test_parse_vilage_fcst_payload_builds_travel_weather_summary():
    payload = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "SKY", "fcstValue": "4"},
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "PTY", "fcstValue": "1"},
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "POP", "fcstValue": "70"},
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "TMP", "fcstValue": "25"},
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "WSD", "fcstValue": "4.3"},
                        {"fcstDate": "20990708", "fcstTime": "1000", "category": "REH", "fcstValue": "82"},
                    ]
                }
            },
        }
    }

    parsed = parse_vilage_fcst_payload(payload, region="udo")

    assert parsed["available"] is True
    assert parsed["provider"] == "kma_vilage_fcst"
    assert parsed["risk_level"] == "caution"
    assert parsed["labels"] == ["흐림", "비 예보", "강수확률 높음", "바람 확인"]
    assert "강수확률 70%" in parsed["summary"]
    assert "기온 25도" in parsed["summary"]
    assert "풍속 4.3m/s" in parsed["summary"]


def test_parse_vilage_fcst_payload_prefers_trip_dates_over_current_day():
    payload = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"fcstDate": "20990708", "fcstTime": "1500", "category": "SKY", "fcstValue": "1"},
                        {"fcstDate": "20990708", "fcstTime": "1500", "category": "POP", "fcstValue": "0"},
                        {"fcstDate": "20990708", "fcstTime": "1500", "category": "TMP", "fcstValue": "28"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "SKY", "fcstValue": "4"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "PTY", "fcstValue": "1"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "POP", "fcstValue": "70"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "TMP", "fcstValue": "24"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "WSD", "fcstValue": "4.3"},
                    ]
                }
            },
        }
    }

    parsed = parse_vilage_fcst_payload(
        payload,
        region="udo",
        target_start=date(2099, 7, 9),
        target_days=3,
    )

    assert parsed["available"] is True
    assert "7월 9일 12시 예보" in parsed["summary"]
    assert "강수확률 70%" in parsed["summary"]
    assert parsed["forecast"]["fcst_date"] == "20990709"


def test_parse_vilage_fcst_payload_returns_daily_trip_forecasts():
    payload = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "SKY", "fcstValue": "4"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "POP", "fcstValue": "30"},
                        {"fcstDate": "20990709", "fcstTime": "1200", "category": "TMP", "fcstValue": "28"},
                        {"fcstDate": "20990710", "fcstTime": "1200", "category": "SKY", "fcstValue": "3"},
                        {"fcstDate": "20990710", "fcstTime": "1200", "category": "PTY", "fcstValue": "1"},
                        {"fcstDate": "20990710", "fcstTime": "1200", "category": "POP", "fcstValue": "70"},
                        {"fcstDate": "20990710", "fcstTime": "1200", "category": "TMP", "fcstValue": "25"},
                        {"fcstDate": "20990711", "fcstTime": "1200", "category": "SKY", "fcstValue": "1"},
                        {"fcstDate": "20990711", "fcstTime": "1200", "category": "POP", "fcstValue": "10"},
                        {"fcstDate": "20990711", "fcstTime": "1200", "category": "TMP", "fcstValue": "27"},
                    ]
                }
            },
        }
    }

    parsed = parse_vilage_fcst_payload(
        payload,
        region="udo",
        target_start=date(2099, 7, 9),
        target_days=3,
    )

    assert parsed["available"] is True
    assert [day["date"] for day in parsed["daily_forecasts"]] == [
        "2099-07-09",
        "2099-07-10",
        "2099-07-11",
    ]
    assert "7월 10일" in parsed["summary"]
    assert "비 예보" in parsed["labels"]


def test_parse_vilage_forecast_preserves_hourly_values():
    payload = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"fcstDate": "20990720", "fcstTime": "0900", "category": "SKY", "fcstValue": "3"},
                        {"fcstDate": "20990720", "fcstTime": "0900", "category": "PTY", "fcstValue": "1"},
                        {"fcstDate": "20990720", "fcstTime": "0900", "category": "POP", "fcstValue": "70"},
                        {"fcstDate": "20990720", "fcstTime": "0900", "category": "TMP", "fcstValue": "24"},
                        {"fcstDate": "20990720", "fcstTime": "0900", "category": "WSD", "fcstValue": "5.2"},
                        {"fcstDate": "20990720", "fcstTime": "1500", "category": "SKY", "fcstValue": "1"},
                        {"fcstDate": "20990720", "fcstTime": "1500", "category": "PTY", "fcstValue": "0"},
                        {"fcstDate": "20990720", "fcstTime": "1500", "category": "POP", "fcstValue": "20"},
                        {"fcstDate": "20990720", "fcstTime": "1500", "category": "TMP", "fcstValue": "28"},
                        {"fcstDate": "20990720", "fcstTime": "1500", "category": "WSD", "fcstValue": "2.1"},
                    ]
                }
            },
        }
    }

    parsed = parse_vilage_fcst_payload(
        payload,
        region="seongsan",
        target_start=date(2099, 7, 20),
        target_days=1,
    )

    assert [row["time"] for row in parsed["hourly_forecasts"]] == ["09:00", "15:00"]
    assert parsed["hourly_forecasts"][0]["precipitation_probability"] == 70
    assert parsed["hourly_forecasts"][0]["precipitation_type"] == "비"
    assert parsed["hourly_forecasts"][1]["wind_speed"] == 2.1
