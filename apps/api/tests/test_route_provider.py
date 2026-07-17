from __future__ import annotations

import httpx
import pytest

from apps.api.engine.route_provider import RouteProvider


def _start() -> dict[str, float]:
    return {"lat": 33.5, "lng": 126.5}


def _goal() -> dict[str, float]:
    return {"lat": 33.45, "lng": 126.57}


def _naver_route_fixture() -> dict[str, object]:
    return {
        "code": 0,
        "route": {
            "traoptimal": [
                {
                    "summary": {"distance": 12_340, "duration": 1_560_000},
                    "path": [[126.5, 33.5], [126.53, 33.48], [126.57, 33.45]],
                }
            ]
        },
    }


def test_driving_provider_normalizes_verified_route(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_ID", "client-id")
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_SECRET", "client-secret")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-ncp-apigw-api-key-id"] == "client-id"
        assert request.headers["x-ncp-apigw-api-key"] == "client-secret"
        return httpx.Response(200, json=_naver_route_fixture())

    segment = RouteProvider(transport=httpx.MockTransport(handler)).segment(
        _start(),
        _goal(),
        mode="driving",
    )

    assert segment["status"] == "verified_route"
    assert segment["provider"] == "naver_directions"
    assert segment["distance_m"] == 12_340
    assert segment["duration_s"] == 1_560
    assert segment["geometry"][0] == {"lng": 126.5, "lat": 33.5}


def test_missing_key_uses_estimate_without_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NAVER_DIRECTIONS_CLIENT_ID", raising=False)
    monkeypatch.delenv("NAVER_DIRECTIONS_CLIENT_SECRET", raising=False)

    def fail_if_called(_: httpx.Request) -> httpx.Response:
        raise AssertionError("network must not be called without credentials")

    segment = RouteProvider(transport=httpx.MockTransport(fail_if_called)).segment(
        _start(),
        _goal(),
        mode="driving",
    )

    assert segment["status"] == "estimated_route"
    assert segment["fallback_reason"] == "directions_credentials_missing"


@pytest.mark.parametrize("mode", ["transit", "walking"])
def test_unsupported_mode_is_an_honest_estimate(mode: str) -> None:
    segment = RouteProvider().segment(_start(), _goal(), mode=mode)

    assert segment["status"] == "estimated_route"
    assert segment["fallback_reason"] == f"{mode}_provider_unavailable"


def test_provider_timeout_falls_back_to_estimate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_ID", "client-id")
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_SECRET", "client-secret")

    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("upstream timeout", request=request)

    segment = RouteProvider(transport=httpx.MockTransport(timeout)).segment(
        _start(),
        _goal(),
        mode="driving",
    )

    assert segment["status"] == "estimated_route"
    assert segment["fallback_reason"] == "directions_timeout"
