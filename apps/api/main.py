"""FastAPI entrypoint — /pack end-to-end (Day2 종료 기준).

파이프라인 (TRUST_ENGINE §1):
  요청 → filters → moment별 judge_section (search+trust) → 응답 조립 → query_log

Day2 스코프:
  - LLM 감성 문구는 Day3에서 붙임. 지금은 items + fallback만.
  - packing_additions는 Day3.
"""
from __future__ import annotations

import uuid
from collections import Counter
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import text

from apps.api import db
from apps.api.engine import assemble as assemble_mod
from apps.api.engine import filters as filters_mod
from apps.api.engine import trust as trust_mod
from apps.api.engine import verify as verify_mod
from apps.api.logging import log_pack, log_verify, measure_latency

app = FastAPI(title="Pack Your Jeju API")


class PackBody(BaseModel):
    region: str
    start_date: str
    days: int = Field(ge=1, le=14)
    companion: str
    purpose: str
    moments: list[str]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "db": db.ping()}


@app.get("/admin/metrics")
def admin_metrics(window_hours: int = Query(24, ge=1, le=720)) -> dict[str, Any]:
    """query_log 집계 — 킥4 라이브 대시보드 소스 (TRUST_ENGINE §7).

    - 최근 N시간 요청 수 / 엔드포인트별 분포
    - 배지 분포 (합산)
    - fallback_reason 분포
    - p50/p95 지연
    """
    try:
        engine = db.get_engine()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unavailable: {e}")

    with engine.connect() as conn:
        total = conn.execute(
            text(
                "SELECT endpoint, COUNT(*) AS n FROM query_log "
                "WHERE created_at > now() - make_interval(hours := :h) "
                "GROUP BY endpoint"
            ),
            {"h": window_hours},
        ).all()
        badges = conn.execute(
            text(
                "SELECT key, SUM((value)::int) AS n "
                "FROM query_log, jsonb_each_text(coalesce(badge_counts,'{}'::jsonb)) "
                "WHERE created_at > now() - make_interval(hours := :h) "
                "GROUP BY key ORDER BY n DESC"
            ),
            {"h": window_hours},
        ).all()
        reasons = conn.execute(
            text(
                "SELECT reason, COUNT(*) AS n FROM query_log, "
                "unnest(coalesce(fallback_reasons,'{}')) AS reason "
                "WHERE created_at > now() - make_interval(hours := :h) "
                "GROUP BY reason ORDER BY n DESC"
            ),
            {"h": window_hours},
        ).all()
        lat = conn.execute(
            text(
                "SELECT "
                "  percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50, "
                "  percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95, "
                "  AVG(latency_ms) AS avg "
                "FROM query_log "
                "WHERE created_at > now() - make_interval(hours := :h)"
            ),
            {"h": window_hours},
        ).first()

    return {
        "window_hours": window_hours,
        "requests_by_endpoint": [{"endpoint": r.endpoint, "n": r.n} for r in total],
        "badges": [{"badge": r.key, "n": int(r.n)} for r in badges],
        "fallback_reasons": [{"reason": r.reason, "n": r.n} for r in reasons],
        "latency_ms": {
            "p50": int(lat.p50 or 0), "p95": int(lat.p95 or 0),
            "avg": float(lat.avg or 0.0),
        },
    }


@app.post("/pack")
def pack(body: PackBody) -> dict[str, Any]:
    # 1) 필터 조립 (LLM 없음 — 절대 규칙 1)
    try:
        req = filters_mod.PackRequest.from_dict(body.model_dump())
        f = filters_mod.build_filters(req)
    except (ValidationError, ValueError, filters_mod.UnknownRegion,
            filters_mod.UnknownMoment, filters_mod.UnknownCompanion,
            filters_mod.UnknownPurpose) as e:
        raise HTTPException(status_code=400, detail={"error": type(e).__name__, "message": str(e)})

    # 2) moment별 판정 (지금은 순차 — 성능 이슈 나면 Day3에서 병렬화)
    sections: list[dict] = []
    all_reasons: list[str] = []
    badge_counter: Counter = Counter()

    section_objs: list[trust_mod.Section] = []
    with measure_latency() as lat:
        for mf in f.per_moment:
            section = trust_mod.judge_section(mf)
            section_objs.append(section)
            sections.append(_serialize_section(section))
            all_reasons.extend(section.observed_reasons)
            for it in section.items:
                badge_counter[it.badge] += 1
            if section.fallback:
                # 사용자 노출된 fallback도 badge_counter에 별도 키로 남긴다
                badge_counter[f"fallback:{section.fallback.reason}"] += 1

        intro = assemble_mod.compose_intro(section_objs, req.companion)

    # 3) 로그 적재 (실패해도 응답에 영향 없음)
    log_id = log_pack(
        request=body.model_dump(),
        badge_counts=dict(badge_counter),
        fallback_reasons=all_reasons,
        latency_ms=lat["ms"],
    )

    return {
        "pack_id": str(uuid.uuid4()),
        "intro": {"text": intro.text, "llm_used": intro.llm_used},
        "sections": sections,
        "packing_additions": [],
        "log_id": log_id,
    }


class VerifyBody(BaseModel):
    text: str


@app.post("/verify")
def verify(body: VerifyBody) -> dict[str, Any]:
    with measure_latency() as lat:
        results = verify_mod.verify_text(body.text)

    verdict_counts: Counter = Counter()
    reasons: list[str] = []
    for r in results:
        verdict_counts[r.verdict] += 1
        if r.verdict == "coverage_gap":
            reasons.append("coverage_gap")
        elif r.verdict == "contradicted":
            reasons.append("contradicted")

    log_id = log_verify(
        request=body.model_dump(),
        verdict_counts=dict(verdict_counts),
        fallback_reasons=reasons,
        latency_ms=lat["ms"],
    )
    return {
        "log_id": log_id,
        "claims": [
            {
                "text": r.text,
                "verdict": r.verdict,
                "matched_name": r.matched_name,
                "matched_external_id": r.matched_external_id,
                "reason": r.reason,
                "sources": r.sources,
            }
            for r in results
        ],
    }


def _serialize_section(section: trust_mod.Section) -> dict:
    return {
        "moment": section.moment,
        "items": [
            {
                "name": it.name,
                "badge": it.badge,
                "external_id": it.external_id,
                "sources": it.sources,
                "freshness": it.freshness,
                "transit": it.transit,
                "note": it.note,
            }
            for it in section.items
        ],
        "fallback": (
            {
                "reason": section.fallback.reason,
                "message": section.fallback.message,
                "stats": section.fallback.stats,
            }
            if section.fallback
            else None
        ),
    }
