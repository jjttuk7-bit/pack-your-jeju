from types import SimpleNamespace

from fastapi.testclient import TestClient

from apps.api import main
from apps.api.engine import search, trust


client = TestClient(main.app)


def _body(**overrides):
    body = {
        "regions": ["aewol"],
        "start_date": "2026-07-13",
        "days": 2,
        "companion": "solo",
        "purpose": "healing",
        "moments": ["oreum"],
        "moment": "oreum",
    }
    body.update(overrides)
    return body


def _badged_item(name: str, external_id: str, note: str | None = None) -> trust.BadgedItem:
    return trust.BadgedItem(
        name=name,
        badge="verified",
        external_id=external_id,
        sources=[],
        freshness={},
        transit={},
        note=note,
    )


def test_section_serialization_includes_optional_page_metadata():
    section = trust.Section(
        moment="oreum",
        items=[_badged_item("첫 후보", "p-1")],
        fallback=None,
        observed_reasons=[],
        total_count=12,
        next_cursor="opaque-next",
    )

    payload = main._serialize_section(section)

    assert payload["total_count"] == 12
    assert payload["shown_count"] == 1
    assert payload["has_more"] is True
    assert payload["next_cursor"] == "opaque-next"


def test_candidate_page_endpoint_returns_next_items(monkeypatch):
    hits = [
        SimpleNamespace(external_id="p-6", region_normalized="aewol"),
        SimpleNamespace(external_id="p-7", region_normalized="hallim"),
    ]
    page = search.CandidatePage(
        items=hits,
        total_count=12,
        has_more=True,
        next_cursor="next-page",
    )
    monkeypatch.setattr(
        main,
        "search_mod",
        SimpleNamespace(search_candidate_page=lambda *_args, **_kwargs: page),
        raising=False,
    )
    monkeypatch.setattr(
        main.trust_mod,
        "badge_item",
        lambda hit, _mf, **kwargs: _badged_item(
            hit.external_id,
            hit.external_id,
            note=kwargs.get("note"),
        ),
    )

    response = client.post("/pack/candidates", json=_body(cursor="first-page"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["moment"] == "oreum"
    assert [item["external_id"] for item in payload["items"]] == ["p-6", "p-7"]
    assert payload["total_count"] == 12
    assert payload["has_more"] is True
    assert payload["next_cursor"] == "next-page"
    assert payload["items"][1]["note"] == "인근 지역 결과"


def test_candidate_page_endpoint_rejects_invalid_cursor():
    response = client.post(
        "/pack/candidates",
        json=_body(cursor="not-a-valid-cursor"),
    )

    assert response.status_code == 400
    assert "cursor" in response.json()["detail"]["message"]


def test_candidate_page_endpoint_rejects_non_utf8_cursor():
    response = client.post(
        "/pack/candidates",
        json=_body(cursor="_w"),
    )

    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "InvalidCursor"
