from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Mapping, cast

import httpx

from apps.api.engine.route_planner import RouteMode, estimated_segment


logger = logging.getLogger(__name__)

NAVER_DIRECTIONS_URL = "https://maps.apigw.ntruss.com/map-direction/v1/driving"


class RouteProvider:
    def __init__(
        self,
        *,
        transport: httpx.BaseTransport | None = None,
        timeout_seconds: float = 4.0,
    ) -> None:
        self._transport = transport
        self._timeout_seconds = timeout_seconds

    def segment(
        self,
        start: Mapping[str, float],
        goal: Mapping[str, float],
        *,
        mode: str,
    ) -> dict[str, Any]:
        normalized_mode = _route_mode(mode)
        if normalized_mode != "driving":
            return _fallback(
                start,
                goal,
                mode=normalized_mode,
                reason=f"{normalized_mode}_provider_unavailable",
            )

        client_id = os.getenv("NAVER_DIRECTIONS_CLIENT_ID", "").strip()
        client_secret = os.getenv("NAVER_DIRECTIONS_CLIENT_SECRET", "").strip()
        if not client_id or not client_secret:
            return _fallback(
                start,
                goal,
                mode=normalized_mode,
                reason="directions_credentials_missing",
            )

        headers = {
            "x-ncp-apigw-api-key-id": client_id,
            "x-ncp-apigw-api-key": client_secret,
        }
        params = {
            "start": f'{float(start["lng"]):.7f},{float(start["lat"]):.7f}',
            "goal": f'{float(goal["lng"]):.7f},{float(goal["lat"]):.7f}',
            "option": "traoptimal",
        }
        try:
            payload = self._request(headers=headers, params=params)
            route = payload["route"]["traoptimal"][0]
            summary = route["summary"]
            path = route["path"]
            if not isinstance(path, list) or len(path) < 2:
                raise ValueError("route path is missing")
            geometry = [
                {"lng": float(point[0]), "lat": float(point[1])}
                for point in path
                if isinstance(point, list) and len(point) >= 2
            ]
            if len(geometry) < 2:
                raise ValueError("route geometry is invalid")
            return {
                "distance_m": int(summary["distance"]),
                "duration_s": int(round(float(summary["duration"]) / 1_000)),
                "status": "verified_route",
                "provider": "naver_directions",
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "geometry": geometry,
            }
        except httpx.TimeoutException as exc:
            logger.warning("directions timeout error=%s", type(exc).__name__)
            return _fallback(
                start,
                goal,
                mode=normalized_mode,
                reason="directions_timeout",
            )
        except httpx.HTTPError as exc:
            logger.warning("directions http failure error=%s", type(exc).__name__)
            return _fallback(
                start,
                goal,
                mode=normalized_mode,
                reason="directions_http_failure",
            )
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            logger.warning("directions payload invalid error=%s", type(exc).__name__)
            return _fallback(
                start,
                goal,
                mode=normalized_mode,
                reason="directions_invalid_response",
            )

    def _request(
        self,
        *,
        headers: Mapping[str, str],
        params: Mapping[str, str],
    ) -> dict[str, Any]:
        last_timeout: httpx.TimeoutException | None = None
        for _ in range(2):
            try:
                with httpx.Client(
                    transport=self._transport,
                    timeout=self._timeout_seconds,
                ) as client:
                    response = client.get(
                        NAVER_DIRECTIONS_URL,
                        headers=dict(headers),
                        params=dict(params),
                    )
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict):
                        raise ValueError("directions response is not an object")
                    return payload
            except httpx.TimeoutException as exc:
                last_timeout = exc
        assert last_timeout is not None
        raise last_timeout


def _fallback(
    start: Mapping[str, float],
    goal: Mapping[str, float],
    *,
    mode: RouteMode,
    reason: str,
) -> dict[str, Any]:
    segment = estimated_segment(start, goal, mode=mode)
    segment["fallback_reason"] = reason
    return segment


def _route_mode(mode: str) -> RouteMode:
    if mode not in {"driving", "transit", "walking"}:
        raise ValueError(f"unsupported route mode: {mode}")
    return cast(RouteMode, mode)
