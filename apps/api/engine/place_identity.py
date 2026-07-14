from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher


@dataclass(frozen=True)
class PlaceCandidate:
    place_id: int
    name: str
    address: str | None
    lat: float | None
    lng: float | None
    external_id: str | None


@dataclass(frozen=True)
class PlaceResolution:
    status: str
    place_id: int | None
    reason: str


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    value = value.lower().replace("제주특별자치도", "제주")
    return re.sub(r"[^0-9a-z가-힣]", "", value)


def _similar(left: str, right: str) -> float:
    return SequenceMatcher(None, _normalize(left), _normalize(right)).ratio()


def resolve_user_place(
    name: str,
    address: str | None,
    lat: float | None,
    lng: float | None,
    candidates: list[PlaceCandidate],
    external_id: str | None = None,
) -> PlaceResolution:
    if external_id:
        exact = [candidate for candidate in candidates if candidate.external_id == external_id]
        if len(exact) == 1:
            return PlaceResolution("matched", exact[0].place_id, "external_id_match")

    name_norm = _normalize(name)
    address_norm = _normalize(address)
    same_name = [candidate for candidate in candidates if _normalize(candidate.name) == name_norm]
    if len(same_name) > 1 and not address_norm and lat is None and lng is None:
        return PlaceResolution("needs_review", None, "ambiguous_same_name")
    scored: list[tuple[float, PlaceCandidate]] = []
    for candidate in candidates:
        name_score = _similar(name_norm, candidate.name)
        address_score = 1.0 if address_norm and address_norm == _normalize(candidate.address) else 0.0
        distance_score = 0.0
        if lat is not None and lng is not None and candidate.lat is not None and candidate.lng is not None:
            distance_score = 1.0 if abs(lat - candidate.lat) < 0.01 and abs(lng - candidate.lng) < 0.01 else 0.0
        score = name_score * 0.6 + address_score * 0.3 + distance_score * 0.1
        if name_score >= 0.92 and (address_score or distance_score or len(candidates) == 1):
            scored.append((score, candidate))

    scored.sort(key=lambda row: row[0], reverse=True)
    if len(scored) == 1 or (scored and scored[0][0] - scored[1][0] >= 0.15):
        return PlaceResolution("matched", scored[0][1].place_id, "normalized_identity_match")
    if len(scored) > 1:
        return PlaceResolution("needs_review", None, "ambiguous_candidates")
    return PlaceResolution("new_candidate", None, "no_confident_match")
