from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api import main
from apps.api.routes import route_plan as route_plan_route


client = TestClient(main.app)


def _body() -> dict:
    return {
        "mode": "driving",
        "origin": {"label": "숙소", "lat": 33.50, "lng": 126.00},
        "destination": {"label": "숙소", "lat": 33.50, "lng": 126.00},
        "items": [
            {
                "id": "far",
                "label": "먼 오름",
                "lat": 33.40,
                "lng": 126.80,
                "day": 1,
                "daypart": "morning",
                "fixed": False,
            },
            {
                "id": "near",
                "label": "가까운 시장",
                "lat": 33.48,
                "lng": 126.10,
                "day": 1,
                "daypart": "afternoon",
                "fixed": False,
            },
            {
                "id": "middle",
                "label": "중간 카페",
                "lat": 33.46,
                "lng": 126.20,
                "day": 1,
                "daypart": "evening",
                "fixed": False,
            },
        ],
        "dismissed_proposal_fingerprints": [],
    }


class FakeProvider:
    def segment(self, start: dict, goal: dict, *, mode: str) -> dict:
        distance_m = int(abs(float(start["lng"]) - float(goal["lng"])) * 100_000)
        return {
            "distance_m": distance_m,
            "duration_s": max(60, distance_m // 4),
            "status": "verified_route",
            "provider": "fixture",
            "geometry": [
                {"lat": start["lat"], "lng": start["lng"]},
                {"lat": goal["lat"], "lng": goal["lng"]},
            ],
        }


class PartialFailProvider(FakeProvider):
    def segment(self, start: dict, goal: dict, *, mode: str) -> dict:
        if float(start["lng"]) == 126.80 and float(goal["lng"]) == 126.10:
            raise TimeoutError("fixture timeout")
        return super().segment(start, goal, mode=mode)


def test_route_plan_returns_current_and_recommended_days(monkeypatch) -> None:
    monkeypatch.setattr(route_plan_route, "RouteProvider", FakeProvider)

    response = client.post("/route/plan", json=_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "verified_route"
    assert payload["days"][0]["current"]["total_duration_s"] > 0
    assert payload["days"][0]["recommended_item_ids"] == ["near", "middle", "far"]
    assert payload["proposal"]["operations"][0]["type"] == "reorder_day_items"


def test_route_plan_falls_back_per_segment_when_provider_raises(monkeypatch) -> None:
    monkeypatch.setattr(route_plan_route, "RouteProvider", PartialFailProvider)

    response = client.post("/route/plan", json=_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["partial"] is True
    assert payload["provider_meta"]["estimated_segments"] >= 1
    assert payload["provider_meta"]["failures"][0]["reason"].startswith("TimeoutError")


def test_route_plan_rejects_invalid_coordinates() -> None:
    body = _body()
    body["items"][0]["lat"] = 91

    response = client.post("/route/plan", json=body)

    assert response.status_code == 422
