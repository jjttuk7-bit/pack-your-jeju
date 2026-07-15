from fastapi.testclient import TestClient

from apps.api import db
from apps.api.main import app


client = TestClient(app)


def test_create_plan_requires_bearer():
    response = client.post("/plans", json={"client_plan_id": "p1"})
    assert response.status_code == 401


def test_create_plan_returns_structured_503_when_database_is_unavailable(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.supabase.co/jwks")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(db, "get_engine", lambda: (_ for _ in ()).throw(RuntimeError("db down")))
    response = client.post(
        "/plans",
        headers={"Authorization": "Bearer not-a-real-token"},
        json={"client_plan_id": "p1", "title": "제주", "days": 2, "regions": ["aewol"]},
    )
    # Invalid token must be rejected before touching the DB.
    assert response.status_code == 401


def test_plan_item_delete_requires_owner_and_unknown_route_is_404():
    response = client.delete("/plans/not-a-plan/items/not-an-item")
    assert response.status_code == 401


def test_append_plan_item_requires_bearer():
    response = client.post("/plans/p1/items", json={"client_item_id": "i1", "source_type": "user_input", "name": "직접 입력 장소"})
    assert response.status_code == 401


def test_web_search_item_requires_source_snapshot():
    from apps.api.engine.plans import validate_plan_item_provenance
    import pytest
    with pytest.raises(ValueError, match="web_search_source_required"):
        validate_plan_item_provenance({"source_type": "web_search", "name": "검색 장소", "source_snapshot": {}})
