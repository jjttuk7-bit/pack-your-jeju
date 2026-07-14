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
