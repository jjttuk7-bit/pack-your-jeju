from __future__ import annotations

from apps.api.engine.weather_report import (
    aggregate_dayparts,
    build_weather_proposals,
    evaluate_itinerary_impact,
)


def test_aggregate_dayparts_uses_worst_probability_and_wind():
    rows = [
        {
            "date": "2026-07-20",
            "time": "08:00",
            "sky": "흐림",
            "precipitation_type": "비",
            "precipitation_probability": 60,
            "temperature": 23.0,
            "wind_speed": 3.0,
            "humidity": 80,
        },
        {
            "date": "2026-07-20",
            "time": "10:00",
            "sky": "흐림",
            "precipitation_type": "비",
            "precipitation_probability": 80,
            "temperature": 25.0,
            "wind_speed": 7.0,
            "humidity": 84,
        },
    ]

    periods = aggregate_dayparts("seongsan", rows)

    morning = periods[0]
    assert morning["daypart"] == "morning"
    assert morning["available"] is True
    assert morning["precipitation_probability_max"] == 80
    assert morning["precipitation_type"] == "비"
    assert morning["temperature_min"] == 23.0
    assert morning["temperature_max"] == 25.0
    assert morning["wind_speed_average"] == 5.0
    assert morning["wind_speed_max"] == 7.0
    assert morning["humidity_average"] == 82


def test_aggregate_dayparts_exposes_missing_periods_without_guessing():
    rows = [
        {
            "date": "2026-07-20",
            "time": "13:00",
            "sky": "맑음",
            "precipitation_type": "강수 없음",
            "precipitation_probability": 10,
            "temperature": 28.0,
            "wind_speed": 2.0,
            "humidity": 62,
        }
    ]

    periods = aggregate_dayparts("jeju_city", rows)

    morning = next(period for period in periods if period["daypart"] == "morning")
    afternoon = next(period for period in periods if period["daypart"] == "afternoon")
    assert morning == {
        "region": "jeju_city",
        "date": "2026-07-20",
        "daypart": "morning",
        "available": False,
    }
    assert afternoon["available"] is True


def test_oreum_rain_and_wind_recommends_adjustment():
    impact = evaluate_itinerary_impact(
        item={
            "id": "p1",
            "moment": "oreum",
            "region": "seongsan",
            "date": "2026-07-20",
            "daypart": "morning",
            "fixed": False,
        },
        period={
            "available": True,
            "precipitation_probability_max": 80,
            "wind_speed_max": 8.0,
            "precipitation_type": "비",
        },
    )

    assert impact["status"] == "adjust"
    assert impact["signals"] == ["rain", "wind"]
    assert impact["policy_version"] == "weather-travel-v1"
    assert "기상청 예보" in impact["source_label"]


def test_indoor_place_remains_suitable_in_rain():
    impact = evaluate_itinerary_impact(
        item={
            "id": "p2",
            "moment": "culture_stop",
            "region": "seongsan",
            "date": "2026-07-20",
            "daypart": "morning",
            "fixed": False,
        },
        period={
            "available": True,
            "precipitation_probability_max": 80,
            "wind_speed_max": 8.0,
            "precipitation_type": "비",
        },
    )

    assert impact["status"] == "suitable"
    assert impact["signals"] == []


def test_missing_forecast_returns_unknown_without_inventing_risk():
    impact = evaluate_itinerary_impact(
        item={"id": "p3", "moment": "oreum", "region": "aewol"},
        period={"available": False},
    )

    assert impact["status"] == "unknown"
    assert impact["signals"] == []


def test_udo_strong_wind_requires_official_transport_check():
    impact = evaluate_itinerary_impact(
        item={"id": "p4", "moment": "beach_walk", "region": "udo"},
        period={
            "available": True,
            "precipitation_probability_max": 10,
            "wind_speed_max": 10.0,
            "precipitation_type": "강수 없음",
        },
    )

    assert impact["status"] == "official_check"
    assert impact["signals"] == ["wind"]


def test_mild_outdoor_rain_only_recommends_preparation():
    impact = evaluate_itinerary_impact(
        item={"id": "p5", "moment": "local_market", "region": "jeju_city"},
        period={
            "available": True,
            "precipitation_probability_max": 45,
            "wind_speed_max": 2.0,
            "precipitation_type": "강수 없음",
        },
    )

    assert impact["status"] == "prepare"
    assert impact["signals"] == ["rain"]


def _proposal_items() -> list[dict]:
    return [
        {
            "id": "outdoor",
            "name": "성산 오름",
            "day": 1,
            "date": "2026-07-20",
            "daypart": "morning",
            "moment": "oreum",
            "region": "seongsan",
            "fixed": False,
        },
        {
            "id": "indoor",
            "name": "제주 전시",
            "day": 1,
            "date": "2026-07-20",
            "daypart": "afternoon",
            "moment": "culture_stop",
            "region": "seongsan",
            "fixed": False,
        },
    ]


def _adjust_impact() -> dict:
    return {
        "item_id": "outdoor",
        "status": "adjust",
        "signals": ["rain"],
        "reason": "오전 비 예보로 시간 조정을 권합니다.",
        "forecast_issued_at": "2026-07-19T05:00:00+09:00",
    }


def test_proposal_swaps_risky_outdoor_with_existing_indoor_item():
    proposals = build_weather_proposals(
        _proposal_items(),
        [_adjust_impact()],
        dismissed=set(),
    )

    assert len(proposals) == 1
    assert proposals[0]["operations"] == [
        {"type": "swap_daypart", "item_ids": ["outdoor", "indoor"]}
    ]
    assert proposals[0]["affected_item_ids"] == ["outdoor", "indoor"]
    assert proposals[0]["fingerprint"]


def test_fixed_item_is_never_moved_by_weather_proposal():
    items = _proposal_items()
    items[0]["fixed"] = True

    proposals = build_weather_proposals(items, [_adjust_impact()], dismissed=set())

    assert proposals == []


def test_dismissed_proposal_fingerprint_is_not_returned():
    first = build_weather_proposals(
        _proposal_items(),
        [_adjust_impact()],
        dismissed=set(),
    )

    second = build_weather_proposals(
        _proposal_items(),
        [_adjust_impact()],
        dismissed={first[0]["fingerprint"]},
    )

    assert second == []


def test_weather_proposal_fingerprint_is_deterministic():
    first = build_weather_proposals(_proposal_items(), [_adjust_impact()], dismissed=set())
    second = build_weather_proposals(_proposal_items(), [_adjust_impact()], dismissed=set())

    assert first[0]["fingerprint"] == second[0]["fingerprint"]
    assert first[0]["proposal_id"] == second[0]["proposal_id"]


def test_weather_proposal_does_not_move_into_occupied_fixed_slot():
    items = _proposal_items()
    items[1]["fixed"] = True

    proposals = build_weather_proposals(items, [_adjust_impact()], dismissed=set())

    assert proposals == []
