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
from contextlib import asynccontextmanager
from typing import Any

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import text

from apps.api import bootstrap, db
from apps.api.engine import agent as agent_mod
from apps.api.engine import assemble as assemble_mod
from apps.api.engine import augment as augment_mod
from apps.api.engine import filters as filters_mod
from apps.api.engine import haruban as haruban_mod
from apps.api.engine import packpdf as packpdf_mod
from apps.api.engine import trust as trust_mod
from apps.api.engine import verify as verify_mod
from apps.api.logging import log_pack, log_verify, measure_latency

_bootstrap_result: dict = {"applied": 0, "failed": 0, "errors": []}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Railway 신규 프로젝트에서 스키마 미적용으로 500 나는 사태 방지 (idempotent).
    global _bootstrap_result
    _bootstrap_result = bootstrap.apply_schema()
    yield


app = FastAPI(title="Pack Your Jeju API", lifespan=lifespan)

# CORS — 프론트(Vercel)에서 크로스오리진 호출 허용.
# CORS_ALLOW_ORIGINS 환경변수에 콤마 구분으로 세팅 (예: "https://pack-your-jeju.vercel.app,http://localhost:3000")
# 미설정 시 로컬 개발용 기본값만 허용.
_default_origins = (
    "http://localhost:3000,http://localhost:5173,"
    "http://127.0.0.1:3000,http://127.0.0.1:5173"
)
_origins = [o.strip() for o in os.environ.get("CORS_ALLOW_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",  # Vercel 미리보기 배포도 허용
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class PackBody(BaseModel):
    # 다중 지역 선택 지원. `region`(단일) 필드도 backward compat로 허용.
    # 최소 하나는 필요 (from_dict에서 정규화 후 검증).
    regions: list[str] | None = None
    region: str | None = None
    start_date: str
    days: int = Field(ge=1, le=14)
    companion: str
    purpose: str
    moments: list[str]
    # 사용자 자유 텍스트. 사실 검증에는 영향 없음(폼이 구조화 필터를 이미 제공).
    # assemble.py의 감성 문구 톤에만 반영 — 새 장소·수치·시간 생성 금지 원칙 유지.
    special_notes: str | None = Field(default=None, max_length=500)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "db": db.ping(),
        "bootstrap": {
            "applied": _bootstrap_result["applied"],
            "failed": _bootstrap_result["failed"],
        },
    }


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

        intro = assemble_mod.compose_intro(
            section_objs, req.companion, special_notes=body.special_notes,
        )
        itinerary = assemble_mod.dispatch_itinerary(
            section_objs, req.days, req.start_date,
            selected_regions=req.regions,
            selected_moments=req.moments,
        )

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
        "itinerary": itinerary,
        "packing_additions": [],
        "log_id": log_id,
    }


@app.post("/pack/pdf")
def pack_pdf(body: PackBody) -> Response:
    """폼 입력으로 팩을 다시 조립한 뒤 감성 톤 여행 저널 PDF를 반환.

    사실 조립 로직은 /pack과 동일하게 filters → judge_section → assemble를 그대로 재사용.
    LLM 문구 생성 여부와 무관하게 PDF 자체는 결정론적으로 만들어진다.

    응답: Content-Type application/pdf, filename은 지역·기간 기반으로 자동 조립.
    폰트 미탐지 (Windows/Linux 모두 없음) 시 503.
    """
    try:
        req = filters_mod.PackRequest.from_dict(body.model_dump())
        f = filters_mod.build_filters(req)
    except (ValidationError, ValueError, filters_mod.UnknownRegion,
            filters_mod.UnknownMoment, filters_mod.UnknownCompanion,
            filters_mod.UnknownPurpose) as e:
        raise HTTPException(status_code=400, detail={"error": type(e).__name__, "message": str(e)})

    section_objs: list[trust_mod.Section] = []
    sections: list[dict] = []
    for mf in f.per_moment:
        s = trust_mod.judge_section(mf)
        section_objs.append(s)
        sections.append(_serialize_section(s))

    intro = assemble_mod.compose_intro(
        section_objs, req.companion, special_notes=body.special_notes,
    )
    itinerary = assemble_mod.dispatch_itinerary(
        section_objs, req.days, req.start_date,
        selected_regions=req.regions,
        selected_moments=req.moments,
    )

    pack_dict = {
        "intro": {"text": intro.text, "llm_used": intro.llm_used},
        "sections": sections,
        "itinerary": itinerary,
    }

    try:
        pdf_bytes = packpdf_mod.build_pack_pdf(pack_dict, body.model_dump())
    except RuntimeError as e:
        # 한글 폰트를 어느 후보 경로에서도 못 찾은 경우 — 배포 환경 이슈로 503.
        raise HTTPException(status_code=503, detail={"error": "font_unavailable", "message": str(e)})

    # 파일명 조립 — regions와 start_date로 사용자에게 의미 있게.
    regions_slug = "-".join(sorted(req.regions))[:60] or "jeju"
    filename = f"pack-your-jeju_{regions_slug}_{req.start_date.isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


class HarubangMessage(BaseModel):
    role: str
    content: str = ""
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class HarubangChatBody(BaseModel):
    messages: list[HarubangMessage] = Field(min_length=1, max_length=30)
    form_state: dict = Field(default_factory=dict)


@app.post("/agent/chat")
def agent_chat(body: HarubangChatBody) -> dict[str, Any]:
    """하루방 대화 한 턴. LLM function calling으로 도구 호출까지 자동 실행.

    LLM 미가용 시 available=False → 프론트가 안내.
    """
    messages_in = [m.model_dump(exclude_none=True) for m in body.messages]
    turn = haruban_mod.chat_turn(messages_in, body.form_state)
    return {
        "available": turn.available,
        "reply_text": turn.reply_text,
        "form_suggestion": turn.form_suggestion,
        "tool_trace": turn.tool_trace,
        "reason": turn.reason,
    }


class HarubangIntroBody(BaseModel):
    form_state: dict = Field(default_factory=dict)


@app.post("/agent/intro")
def agent_intro(body: HarubangIntroBody) -> dict[str, Any]:
    """폼에서 지역+순간 임계 도달 시 하루방이 스스로 인사하는 라이트 경로.

    사실은 결정론적 DB 조회로 확정하고, LLM은 greeting + 각 하이라이트 reason 한 줄만.
    LLM 미가용 시 템플릿 greeting + reason 생략 (배지·주소는 정상 노출).
    """
    intro = haruban_mod.build_intro(body.form_state)
    return {
        "available": intro.available,
        "greeting": intro.greeting,
        "highlights": intro.highlights,
        "coverage": intro.coverage,
        "gaps": intro.gaps,
        "llm_used": intro.llm_used,
        "reason": intro.reason,
    }


class HarubangAugmentBody(BaseModel):
    form_state: dict = Field(default_factory=dict)


@app.post("/agent/augment")
def agent_augment(body: HarubangAugmentBody) -> dict[str, Any]:
    """Phase E — 폼 필드 증강 제안.

    폼 값 변경 시 프론트가 debounce 후 호출. 필드별 add/tune 제안 목록.
    카운트는 결정적 SQL, 이유 문구는 LLM이 다듬음 (없으면 템플릿 그대로).
    """
    result = augment_mod.build_augment(body.form_state)
    return {
        "available": result.available,
        "suggestions": [
            {
                "field": s.field,
                "kind": s.kind,
                "values": s.values,
                "labels": s.labels,
                "reason": s.reason,
                "counts": s.counts,
            }
            for s in result.suggestions
        ],
        "llm_used": result.llm_used,
        "reason": result.reason,
    }


class AgentParseBody(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@app.post("/agent/parse")
def agent_parse(body: AgentParseBody) -> dict[str, Any]:
    """자연어 → PackRequest 필드 파싱. 사용자 확인 후 실제 /pack 호출로 이어짐.

    LLM 미가용 시 available=False로 응답 → 프론트는 폼 fallback으로 안내.
    """
    result = agent_mod.parse_pack_request(body.text)
    if not result.available or result.parsed is None:
        return {
            "available": False,
            "reason": result.reason,
            "parsed": None,
        }
    return {
        "available": True,
        "reason": "",
        "parsed": result.parsed.to_dict(),
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
                # 상세 확장 UI용 (근거 있는 값만; 결측은 그대로 전달해 프론트가 '미확인' 표기)
                "address": it.address,
                "category": it.category,
                "amenities": it.amenities,
                "hygiene_grade": it.hygiene_grade,
                "region": it.region_normalized,
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
