from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api import main
from apps.api.routes import weather_report as weather_report_route


client = TestClient(main.app)


def _body(*, fixed: bool = False) -> dict:
    return {
        "start_date": "2026-07-20",
        "days": 1,
        "regions": ["seongsan", "udo", "aewol"],
        "items": [
            {
                "id": "outdoor",
                "name": "성산 오름",
                "day": 1,
                "date": "2026-07-20",
                "daypart": "morning",
                "region": "seongsan",
                "moment": "oreum",
                "fixed": fixed,
            },
            {
                "id": "indoor",
                "name": "제주 전시",
                "day": 1,
                "date": "2026-07-20",
                "daypart": "afternoon",
                "region": "seongsan",
                "moment": "culture_stop",
                "fixed": False,
            },
            {
                "id": "udo-stop",
                "name": "우도 산책",
                "day": 1,
                "date": "2026-07-20",
                "daypart": "evening",
                "region": "udo",
                "moment": "beach_walk",
                "fixed": False,
            },
        ],
        "dismissed_proposal_fingerprints": [],
    }


def _seongsan_snapshot() -> dict:
    return {
        "available": True,
        "provider": "kma_vilage_fcst",
        "source_issued_at": "2026-07-19T05:00:00+09:00",
        "source_issued_at_label": "2026년 7월 19일 05시 발표",
        "hourly_forecasts": [
            {
                "date": "2026-07-20",
                "time": "09:00",
                "sky": "흐림",
                "precipitation_type": "비",
                "precipitation_probability": 80,
                "temperature": 24,
                "wind_speed": 6,
                "humidity": 82,
            },
            {
                "date": "2026-07-20",
                "time": "14:00",
                "sky": "맑음",
                "precipitation_type": "강수 없음",
                "precipitation_probability": 10,
                "temperature": 27,
                "wind_speed": 2,
                "humidity": 65,
            },
        ],
    }


def _fake_weather(region: str, **_kwargs) -> dict:
    if region == "seongsan":
        return _seongsan_snapshot()
    return {
        "available": False,
        "provider": "kma_vilage_fcst",
        "reason": "upstream timeout",
    }


def test_report_keeps_available_region_when_another_region_fails(monkeypatch):
    monkeypatch.setattr(weather_report_route.weather_mod, "smoke_kma_nowcast", _fake_weather)

    response = client.post("/weather/report", json=_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "adjust"
    assert payload["forecast_meta"]["partial"] is True
    assert payload["forecast_meta"]["requested_regions"] == ["seongsan", "udo"]
    assert payload["forecast_meta"]["available_regions"] == ["seongsan"]
    assert payload["forecast_meta"]["unavailable_regions"] == ["udo"]
    assert {impact["status"] for impact in payload["impacts"]} == {
        "adjust",
        "suitable",
        "unknown",
    }
    assert payload["proposals"][0]["operations"] == [
        {"type": "swap_daypart", "item_ids": ["outdoor", "indoor"]}
    ]


def test_report_rejects_empty_itinerary():
    body = _body()
    body["items"] = []

    response = client.post("/weather/report", json=body)

    assert response.status_code == 400


def test_report_returns_unknown_when_every_region_fails(monkeypatch):
    monkeypatch.setattr(
        weather_report_route.weather_mod,
        "smoke_kma_nowcast",
        lambda *_args, **_kwargs: {"available": False, "reason": "timeout"},
    )

    response = client.post("/weather/report", json=_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unknown"
    assert payload["proposals"] == []
    assert payload["forecast_meta"]["available_regions"] == []
    assert payload["forecast_meta"]["unavailable_regions"] == ["seongsan", "udo"]


def test_report_never_proposes_moving_a_fixed_item(monkeypatch):
    monkeypatch.setattr(weather_report_route.weather_mod, "smoke_kma_nowcast", _fake_weather)

    response = client.post("/weather/report", json=_body(fixed=True))

    assert response.status_code == 200
    assert response.json()["proposals"] == []
