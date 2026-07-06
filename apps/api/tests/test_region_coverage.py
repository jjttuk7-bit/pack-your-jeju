from __future__ import annotations

from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.engine.region_coverage import build_preview_from_counts

client = TestClient(app)


def test_build_preview_from_counts_marks_weak_moments_without_denial():
    preview = build_preview_from_counts(
        region="gujwa",
        counts={
            "beach_walk": {"verified": 3, "caution": 1},
            "quiet_cafe": {"verified": 2, "caution": 0},
            "sunset": {"verified": 0, "caution": 0},
        },
    )

    assert preview["region"] == "gujwa"
    assert preview["region_label"] == "구좌"
    assert preview["total_places"] == 6
    assert preview["recommended_moments"] == ["beach_walk", "quiet_cafe"]
    assert "sunset" in preview["weak_moments"]
    assert "확인되지 않습니다" in preview["briefing"]
    assert "없습니다" not in preview["briefing"]
    assert "구좌는" in preview["briefing"]

    sunset = next(m for m in preview["moments"] if m["moment"] == "sunset")
    assert sunset["coverage_gap"] is True


def test_build_preview_from_counts_rejects_unknown_region():
    try:
        build_preview_from_counts(region="busan", counts={})
    except ValueError as e:
        assert "UnknownRegion" in str(e)
    else:
        raise AssertionError("unknown region should raise")


def test_region_coverage_endpoint_returns_preview(monkeypatch):
    def fake_preview(region: str) -> dict:
        assert region == "gujwa"
        return build_preview_from_counts(
            region=region,
            counts={"quiet_cafe": {"verified": 2, "caution": 1}},
        )

    from apps.api.engine import region_coverage

    monkeypatch.setattr(region_coverage, "build_region_preview", fake_preview)
    resp = client.get("/region/coverage-preview?region=gujwa")

    assert resp.status_code == 200
    data = resp.json()
    assert data["region"] == "gujwa"
    assert data["region_label"] == "구좌"
    assert data["moments"]


def test_region_coverage_endpoint_rejects_bad_region():
    resp = client.get("/region/coverage-preview?region=busan")

    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "ValueError"
