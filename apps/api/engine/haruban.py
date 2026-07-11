"""하루방 에이전트 — 대화형 + 도구 사용 + 폼 컨텍스트 인지.

역할:
  사용자가 폼을 채우는 과정에서 궁금한 것을 물으면 하루방이 답한다.
  하루방은 사용자의 현재 폼 상태를 알고 있고, 필요할 때 도구(place 조회 등)를 호출한다.
  사실은 지어내지 않는다 — DB/도구 결과 밖의 장소·시간·조건 언급 금지.

원칙 (CLAUDE.md):
  - 절대 규칙 1: 사실 생성 금지. 도구 결과만 근거.
  - 절대 규칙 5: llm.py의 gpt-5.3-mini 고정 유지.
  - 절대 규칙 6: LLM 없어도 서버 안 죽음 (available=False signal).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import text

from apps.api import db
from apps.api.engine import assemble as assemble_mod
from apps.api.engine import fix_requests
from apps.api.engine import filters as filters_mod
from apps.api.engine import llm
from apps.api.engine import region_coverage as region_coverage_mod
from apps.api.engine import search as search_mod
from apps.api.engine import trust as trust_mod
from apps.api.engine import verify as verify_mod
from apps.api.engine import weather as weather_mod


# ─── 한글 라벨 (하이라이트 문구 조립용) ───

REGION_LABEL_KO: dict[str, str] = {
    "jeju_city": "제주시",
    "seogwipo":  "서귀포",
    "aewol":     "애월",
    "hallim":    "한림",
    "seongsan":  "성산",
    "jocheon":   "조천",
    "gujwa":     "구좌",
    "andeok":    "안덕",
    "daejeong":  "대정",
    "pyoseon":   "표선",
    "namwon":    "남원",
    "udo":       "우도",
}

COMPANION_LABEL_KO: dict[str, str] = {
    "solo":    "혼자",
    "couple":  "연인과",
    "friend":  "친구와",
    "family":  "가족과",
    "kids":    "아이와",
    "parents": "부모님과",
}

MOMENT_LABEL_KO: dict[str, str] = {
    "oreum":        "오름 산책",
    "beach_walk":   "바다 산책",
    "sunset":       "노을 감상",
    "local_market": "로컬 시장",
    "local_food":   "현지 맛집",
    "quiet_cafe":   "조용한 카페",
    "gotjawal":     "곶자왈 숲길",
    "citrus":       "감귤 체험",
    "stay":          "숙소까지 같이 보기",
    "festival_event": "축제·행사 맞춰가기",
    "souvenir_shopping": "특산물·기념품 쇼핑",
    "culture_stop":  "전시·문화 공간",
}

PURPOSE_LABEL_KO: dict[str, str] = {
    "healing":     "힐링",
    "sightseeing": "관광",
    "food":        "먹부림",
    "activity":    "액티비티",
    "hocance":     "호캉스",
}

CATEGORY_LABEL_KO: dict[str, str] = {
    "oreum": "오름 산책",
    "beach": "바다 산책",
    "cafe": "조용한 카페",
    "food": "현지 맛집",
    "market": "로컬 시장",
    "forest": "곶자왈 숲길",
    "experience": "체험관광",
    "viewpoint": "전망·노을",
    "culture": "문화시설·전시",
    "festival": "축제·행사",
    "shopping": "쇼핑",
    "accommodation": "숙박시설",
    "other": "기타 관광정보",
}

# augment.py reuses the Korean labels above, so import it after labels exist.
from apps.api.engine import augment as augment_mod


# ─── 하루방 도구 정의 ───

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "web_search_jeju",
            "description": (
                "제주 여행의 최신·외부 웹 정보를 sources와 함께 검색한다. "
                "사용자가 요즘/최신/운영시간/축제/행사/웹검색/가볼만한 곳처럼 내부 공공데이터만으로 답하기 넓거나 "
                "최신성이 필요한 질문을 하면 호출한다. 반환 sources 밖의 사실은 지어내지 마라."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {
                        "type": "string",
                        "minLength": 2,
                        "maxLength": 200,
                        "description": "웹에서 확인할 제주 여행 질문.",
                    },
                    "context": {
                        "type": "string",
                        "maxLength": 500,
                        "description": "사용자의 현재 여행 맥락. 예: 처음 제주, 가족 동행, 비 오는 날.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_places",
            "description": (
                "제주 지역·카테고리로 공공데이터 근거 검색을 수행해 검증된 장소 후보와 총 개수를 조회한다. "
                "사용자가 '추천해줘', '몇 개야', '총 개수', '어디가 있어'처럼 구체적인 장소·개수·후보를 물으면 먼저 호출한다. "
                "반환 결과 밖의 장소를 절대 지어내지 마라."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                    },
                    "category": {
                        "type": "string",
                        "enum": list(filters_mod.SEARCHABLE_CATEGORIES),
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 10},
                    "exclude_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "이미 사용자에게 보여줬거나 사용자가 제외해달라고 한 장소명.",
                    },
                    "offset": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 200,
                        "description": "같은 조건의 다음 후보를 볼 때 건너뛸 개수.",
                    },
                    "intent": {
                        "type": "string",
                        "enum": ["list", "recommend", "count"],
                        "description": "목록 요청(list), 한 곳 추천(recommend), 개수 질문(count) 중 하나.",
                    },
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "사용자 선호 키워드. 예: 해산물, 조용한, 점심.",
                    },
                    "query": {
                        "type": "string",
                        "description": "장소명 일부나 사용자가 언급한 검색어.",
                    },
                },
                "required": ["regions", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_place_detail",
            "description": (
                "사용자가 특정 장소명을 언급하며 자세한 정보, 주소, 어떤 곳인지 묻는 경우 호출한다. "
                "이 도구 결과 밖의 메뉴·영업시간·평점은 지어내지 않는다."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "query": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 120,
                        "description": "사용자가 물어본 장소명 또는 장소명 일부.",
                    },
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                    },
                    "category": {
                        "type": "string",
                        "enum": list(set(filters_mod.MOMENT_TO_CATEGORY.values())),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verify_claim",
            "description": (
                "사용자가 어디서 봤다는 정보(리뷰·블로그)를 저희 공공데이터로 팩트체크. "
                "verified/outdated/contradicted/coverage_gap 판정."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "text": {"type": "string", "minLength": 2, "maxLength": 800},
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_form_update",
            "description": (
                "사용자 폼에 반영할 것을 제안한다. 사용자가 승인해야 반영된다. "
                "빈 값은 넣지 마라 (지어내지 마라)."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                    },
                    "companion": {
                        "type": "string",
                        "enum": list(filters_mod.COMPANION_REQUIRED_AMENITIES.keys()),
                    },
                    "purpose": {
                        "type": "string",
                        "enum": list(filters_mod.PURPOSE_TO_CATEGORIES.keys()),
                    },
                    "moments": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": list(filters_mod.MOMENT_TO_CATEGORY.keys()),
                        },
                    },
                    "days": {"type": "integer", "minimum": 1, "maximum": 14},
                    "start_date": {"type": "string"},
                    "reason": {
                        "type": "string",
                        "description": "이 제안을 왜 하는지 짧은 한국어 설명 (사용자에게 노출).",
                    },
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "build_pack",
            "description": (
                "현재 폼 상태를 바탕으로 여행팩을 조립한다. "
                "섹션별 후보, fallback, 날씨, 일정 요약은 공공데이터와 도구 결과에 있는 사실만 반환한다. "
                "반환 결과 밖의 장소·주소·운영시간·수치를 절대 지어내지 마라."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "form_state": {
                        "type": "object",
                        "description": "현재 사용자가 선택한 제주 여행 폼 상태.",
                    },
                },
                "required": ["form_state"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verify_review",
            "description": (
                "사용자가 붙여넣은 리뷰·블로그·외부 주장을 공공데이터와 도구 결과 기준으로 검증한다. "
                "검증 결과 밖의 사실은 지어내지 말고, 확인되지 않으면 공공데이터 기준 한계를 밝혀라."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "text": {
                        "type": "string",
                        "minLength": 2,
                        "maxLength": 1500,
                        "description": "검증할 리뷰, 블로그 문장, 외부 주장 텍스트.",
                    },
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "preview_region_coverage",
            "description": (
                "선택한 제주 지역들의 순간 카드별 공공데이터 커버리지를 비교한다. "
                "강점과 빈틈은 도구 결과의 후보 수와 coverage 정보만 근거로 설명한다."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(filters_mod.REGIONS)},
                        "minItems": 1,
                    },
                },
                "required": ["regions"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_form_augment",
            "description": (
                "현재 폼 상태에서 더 좋은 지역·순간·조건 보강안을 제안한다. "
                "제안 이유와 카운트는 공공데이터와 도구 결과만 근거로 삼고, 실제 폼 변경은 사용자 승인 후 처리한다."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "form_state": {
                        "type": "object",
                        "description": "현재 사용자가 선택한 제주 여행 폼 상태.",
                    },
                },
                "required": ["form_state"],
            },
        },
    },
]


_SEAFOOD_KEYWORDS = (
    "해산물", "해물", "생선", "회", "횟집", "갈치", "고등어", "전복", "우럭",
    "fish", "seafood",
)


def _expanded_keywords(keywords: list[str]) -> list[str]:
    expanded: list[str] = []
    for keyword in keywords:
        k = str(keyword or "").strip()
        if not k:
            continue
        expanded.append(k)
        if _normalize_place_name(k) in {_normalize_place_name(x) for x in _SEAFOOD_KEYWORDS}:
            expanded.extend(_SEAFOOD_KEYWORDS)
    return _unique_preserve_order(expanded)


def _score_search_row(row: Any, *, query: str, keywords: list[str], intent: str, index: int) -> tuple[int, int]:
    haystack = " ".join(
        str(v or "") for v in (row.name, row.address, row.region_normalized)
    )
    norm_haystack = _normalize_place_name(haystack)
    score = 0
    q = _normalize_place_name(query)
    if q and q in norm_haystack:
        score += 100
    for keyword in _expanded_keywords(keywords):
        if _normalize_place_name(keyword) in norm_haystack:
            score += 35
    if intent == "recommend":
        score += 25 if not bool(row.has_fix_request) else -10
    return (-score, index)


def _run_search_places(args: dict) -> dict:
    """search_places 도구 실행. 검증된 place만 반환. 없으면 빈 리스트."""
    regions = args.get("regions") or []
    category = args.get("category") or ""
    limit = int(args.get("limit") or 5)
    offset = max(0, int(args.get("offset") or 0))
    exclude_names = args.get("exclude_names") or []
    intent = args.get("intent") or "list"
    keywords = [str(k) for k in (args.get("keywords") or []) if str(k).strip()]
    query = str(args.get("query") or "").strip()
    exclude_keys = {_normalize_place_name(name) for name in exclude_names if name}
    if not regions or not category:
        return {"items": [], "note": "regions와 category가 필요합니다"}

    fetch_limit = min(200, max(80, limit + offset + len(exclude_keys) + 20))
    engine = db.get_engine()
    with engine.connect() as conn:
        total = conn.execute(
            text(
                "SELECT COUNT(*) "
                "FROM place "
                "WHERE tombstoned=false "
                "  AND region_normalized = ANY(:regions) "
                "  AND category = :category"
            ),
            {"regions": list(regions), "category": category},
        ).scalar_one()
        rows = conn.execute(
            text(
                "SELECT external_id, name, category, region_normalized, address, "
                "       lat, lng, info_type, valid_until, has_fix_request, source_url "
                "FROM place "
                "WHERE tombstoned=false "
                "  AND region_normalized = ANY(:regions) "
                "  AND category = :category "
                "ORDER BY has_fix_request ASC, updated_at DESC "
                "LIMIT :limit OFFSET 0"
            ),
            {
                "regions": list(regions),
                "category": category,
                "limit": fetch_limit,
            },
        ).all()
    ranked_rows = [
        row for row in rows
        if _normalize_place_name(row.name) not in exclude_keys
    ]
    if query or keywords or intent == "recommend":
        ranked_rows = sorted(
            enumerate(ranked_rows),
            key=lambda pair: _score_search_row(
                pair[1],
                query=query,
                keywords=keywords,
                intent=intent,
                index=pair[0],
            ),
        )
        ranked_rows = [row for _, row in ranked_rows]
    filtered_rows = ranked_rows[offset:offset + limit]
    return {
        "intent": intent,
        "total_count": int(total or 0),
        "regions": list(regions),
        "category": category,
        "keywords": keywords,
        "query": query,
        "excluded_names": list(exclude_names),
        "note": (
            "total_count는 제주를 담다가 참조하는 공공데이터 기준의 후보 수입니다. "
            "items는 사용자에게 예시로 보여줄 수 있는 일부 후보입니다."
        ),
        "items": [
            {
                "external_id": r.external_id,
                "name": r.name,
                "region": r.region_normalized,
                "category": r.category,
                "address": r.address,
                "source": "비짓제주" if r.source_url else "공공데이터 근거",
                "info_type": r.info_type,
                "valid_until": r.valid_until.isoformat() if r.valid_until else None,
                "has_fix_request": bool(r.has_fix_request),
            }
            for r in filtered_rows
        ],
    }


def _run_get_place_detail(args: dict) -> dict:
    """장소명 상세 조회. 이름·주소·출처 등 DB에 있는 값만 반환한다."""
    query = str(args.get("query") or "").strip()
    if not query:
        return {"query": query, "items": [], "note": "query가 필요합니다"}
    regions = [str(r) for r in (args.get("regions") or []) if str(r).strip()]
    category = str(args.get("category") or "").strip()

    where = ["tombstoned=false"]
    params: dict[str, Any] = {
        "query": query,
        "like": f"%{query}%",
        "norm_query": _normalize_place_name(query),
        "norm_like": f"%{_normalize_place_name(query)}%",
    }
    if regions:
        where.append("region_normalized = ANY(:regions)")
        params["regions"] = regions
    if category:
        where.append("category = :category")
        params["category"] = category

    where.append(
        "("
        " name ILIKE :like "
        " OR replace(lower(name), ' ', '') LIKE :norm_like "
        " OR similarity(name, :query) > 0.18"
        ")"
    )

    with db.get_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT external_id, name, category, region_normalized, address, "
                "       lat, lng, info_type, valid_until, has_fix_request, source_url "
                "FROM place "
                f"WHERE {' AND '.join(where)} "
                "ORDER BY "
                "  CASE WHEN replace(lower(name), ' ', '') = :norm_query THEN 0 ELSE 1 END, "
                "  similarity(name, :query) DESC, "
                "  has_fix_request ASC, updated_at DESC "
                "LIMIT 3"
            ),
            params,
        ).all()

    return {
        "query": query,
        "regions": regions,
        "category": category,
        "items": [_detail_row_to_payload(row) for row in rows],
        "note": (
            "장소 상세는 DB에 저장된 이름·주소·출처·수정요청 신호만 반환합니다. "
            "영업시간·대표 메뉴가 없으면 확인 불가로 안내해야 합니다."
        ),
    }


def _fix_request_summary(has_fix_request: bool, external_id: str | None = None) -> dict[str, Any] | None:
    if not has_fix_request:
        return None
    detail = fix_requests.fetch_fix_request_summary(external_id or "") if external_id else None
    if detail and detail.get("requests"):
        requests = detail["requests"]
        labels = sorted({r.get("change_type_label") or "수정요청" for r in requests})
        return {
            "status": "확인 필요",
            "summary": f"콘텐츠 수정요청 {detail.get('count', len(requests))}건이 연결되어 있습니다.",
            "known_detail": " · ".join(labels),
            "check_items": _fix_request_check_items(requests),
            "requests": requests,
            "count": detail.get("count", len(requests)),
        }
    return {
        "status": "확인 필요",
        "summary": "이용자 정보 수정요청 이력이 있어 방문 전 재확인이 필요한 후보입니다.",
        "known_detail": (
            "현재 연결된 공공데이터에는 수정요청의 세부 사유가 별도 필드로 분리되어 있지 않습니다."
        ),
        "check_items": ["운영시간", "주소/위치", "휴무·폐업 여부", "이동·주차 가능 여부"],
    }


def _fix_request_check_items(requests: list[dict[str, Any]]) -> list[str]:
    labels: list[str] = []
    for request in requests:
        change_type = request.get("change_type")
        if change_type == "operating_hours":
            labels.append("운영시간")
        elif change_type == "address_location":
            labels.append("주소/위치")
        elif change_type == "fee":
            labels.append("요금")
        elif change_type == "contact":
            labels.append("연락처")
        elif change_type == "closure_status":
            labels.append("운영 상태")
        else:
            labels.append("상세정보")
    return list(dict.fromkeys(labels)) or ["공공데이터 상세정보"]


def _detail_row_to_payload(row: Any) -> dict[str, Any]:
    check_required: list[str] = ["operating", "public_data"]
    if bool(row.has_fix_request):
        check_required.insert(0, "feedback")
    transit = search_mod.transit_check(row.lat, row.lng)
    return {
        "external_id": row.external_id,
        "name": row.name,
        "region": row.region_normalized,
        "region_label": REGION_LABEL_KO.get(row.region_normalized, row.region_normalized),
        "category": row.category,
        "category_label": _category_label(row.category),
        "address": row.address,
        "source": "비짓제주" if row.source_url else "공공데이터 근거",
        "source_url": row.source_url,
        "info_type": row.info_type,
        "valid_until": row.valid_until.isoformat() if row.valid_until else None,
        "has_fix_request": bool(row.has_fix_request),
        "fix_request": _fix_request_summary(bool(row.has_fix_request), row.external_id),
        "transit": {
            "parking": transit.parking,
            "parking_count": transit.parking_count,
            "bus_walkable": transit.bus_walkable,
            "parking_radius_km": search_mod.PARKING_RADIUS_KM,
            "busstop_radius_km": search_mod.BUSSTOP_RADIUS_KM,
        },
        "note": "이용자 정보 수정요청 이력" if bool(row.has_fix_request) else None,
        "check_required": check_required,
    }


def _run_verify_claim(args: dict) -> dict:
    """verify_claim 도구 실행. verify.py 재활용."""
    text_in = args.get("text") or ""
    if not text_in:
        return {"claims": []}
    results = verify_mod.verify_text(text_in)
    return {
        "claims": [
            {
                "text": r.text,
                "verdict": r.verdict,
                "fallback_reason": r.fallback_reason,
                "matched_name": r.matched_name,
                "reason": r.reason,
            }
            for r in results
        ],
    }


def _run_verify_review(args: dict) -> dict:
    """리뷰·블로그 문장을 /verify 로직으로 검증해 대화용 payload로 직렬화한다."""
    text_in = str(args.get("text") or "").strip()
    if not text_in:
        return {"claims": []}
    results = verify_mod.verify_text(text_in)
    return {
        "claims": [
            {
                "text": r.text,
                "verdict": r.verdict,
                "fallback_reason": r.fallback_reason,
                "matched_name": r.matched_name,
                "matched_external_id": getattr(r, "matched_external_id", None),
                "reason": r.reason,
                "sources": getattr(r, "sources", []),
            }
            for r in results
        ],
    }


def _run_suggest_form_update(args: dict) -> dict:
    """suggest_form_update는 실제 실행이 아니라 프론트로 넘겨줄 제안.
    도구 실행 결과는 반영 대기 상태로 프론트에 노출."""
    # enum 유효성만 최소 확인 후 그대로 통과.
    return {"suggestion": args}


def _run_preview_region_coverage(args: dict) -> dict:
    """지역별 순간 카드 커버리지 프리뷰를 대화용 payload로 묶는다."""
    raw_regions = args.get("regions") or []
    if isinstance(raw_regions, str):
        raw_regions = [raw_regions]
    regions = [r for r in raw_regions if isinstance(r, str) and r in filters_mod.REGIONS]
    previews = []
    for region in regions:
        try:
            previews.append(region_coverage_mod.build_region_preview(region))
        except Exception as e:
            previews.append({
                "region": region,
                "available": False,
                "error": f"{type(e).__name__}: {e}",
            })
    return {"regions": previews}


@dataclass(frozen=True)
class WebSearchResult:
    available: bool
    query: str
    answer: str = ""
    sources: list[dict] = field(default_factory=list)
    reason: str = ""


def _source_key(source: dict) -> str:
    return str(source.get("url") or source.get("title") or "").strip().lower()


def _dedupe_sources(sources: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for source in sources:
        url = str(source.get("url") or "").strip()
        title = str(source.get("title") or "").strip()
        snippet = str(source.get("snippet") or "").strip()
        if not url and not title:
            continue
        key = _source_key({"url": url, "title": title})
        if key in seen:
            continue
        seen.add(key)
        item = {"title": title or url, "url": url}
        if snippet:
            item["snippet"] = snippet
        result.append(item)
    return result[:5]


def _extract_response_sources(resp: Any) -> list[dict]:
    sources: list[dict] = []
    for output in getattr(resp, "output", []) or []:
        for content in getattr(output, "content", []) or []:
            for annotation in getattr(content, "annotations", []) or []:
                url = getattr(annotation, "url", "") or ""
                title = getattr(annotation, "title", "") or ""
                if url or title:
                    sources.append({"title": title, "url": url})
    return _dedupe_sources(sources)


def _perform_web_search_jeju(query: str, context: str = "") -> WebSearchResult:
    """OpenAI web_search tool을 통해 최신 웹 근거를 가져온다. 실패해도 서버는 죽지 않는다."""
    import os

    clean_query = str(query or "").strip()
    clean_context = str(context or "").strip()
    if not clean_query:
        return WebSearchResult(available=False, query=clean_query, reason="query is required")

    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return WebSearchResult(
            available=False,
            query=clean_query,
            reason="OPENAI_API_KEY not set",
        )

    try:
        from openai import OpenAI
    except Exception as e:
        return WebSearchResult(available=False, query=clean_query, reason=f"openai import failed: {e}")

    prompt = (
        "제주 여행 질문에 대해 웹에서 확인한 출처가 있는 내용만 한국어로 짧게 답하세요. "
        "출처가 부족하면 확인하지 못했다고 말하세요. 장소명·주소·운영시간은 출처에 있는 범위만 말하세요.\n\n"
        f"질문: {clean_query}"
    )
    if clean_context:
        prompt += f"\n사용자 맥락: {clean_context}"

    client = OpenAI(api_key=key)
    last_error = ""
    for tool_type in ("web_search", "web_search_preview"):
        try:
            resp = client.responses.create(
                model=llm.MODEL,
                tools=[{"type": tool_type}],
                input=prompt,
                max_output_tokens=600,
            )
            answer = (getattr(resp, "output_text", "") or "").strip()
            sources = _extract_response_sources(resp)
            return WebSearchResult(
                available=bool(answer or sources),
                query=clean_query,
                answer=answer,
                sources=sources,
                reason="" if (answer or sources) else "web search returned no usable result",
            )
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
    return WebSearchResult(available=False, query=clean_query, reason=last_error)


def _run_web_search_jeju(args: dict) -> dict:
    query = str(args.get("query") or "").strip()
    context = str(args.get("context") or "").strip()
    result = _perform_web_search_jeju(query, context=context)
    return {
        "available": result.available,
        "query": result.query,
        "answer": result.answer,
        "sources": result.sources,
        "source_type": "web",
        "trust_level": "web_source",
        "reason": result.reason,
        "note": (
            "웹검색 결과는 최신 외부 출처 기준입니다. 내부 공공데이터 검증 완료와 구분해서 사용자에게 안내해야 합니다."
        ),
    }


def _run_suggest_form_augment(args: dict) -> dict:
    """폼 증강 제안을 대화용 payload로 직렬화한다."""
    form_state = args.get("form_state") or {}
    if not isinstance(form_state, dict):
        return {"available": False, "suggestions": [], "reason": "form_state must be an object"}
    result = augment_mod.build_augment(form_state)
    return {
        "available": result.available,
        "suggestions": [
            {
                "field": suggestion.field,
                "kind": suggestion.kind,
                "values": suggestion.values,
                "labels": suggestion.labels,
                "reason": suggestion.reason,
                "counts": suggestion.counts,
            }
            for suggestion in result.suggestions
        ],
        "llm_used": result.llm_used,
        "reason": result.reason,
    }


def _run_build_pack(args: dict) -> dict:
    """현재 폼 상태로 /pack 핵심 조립 로직을 실행해 대화용 요약 payload를 만든다."""
    form_state = args.get("form_state") or {}
    if not isinstance(form_state, dict):
        return {
            "available": False,
            "error": "form_state must be an object",
            "fallback_reason": "out_of_scope",
        }

    try:
        req = filters_mod.PackRequest.from_dict(form_state)
        bundle = filters_mod.build_filters(req)
    except (
        KeyError,
        ValueError,
        filters_mod.UnknownRegion,
        filters_mod.UnknownMoment,
        filters_mod.UnknownCompanion,
        filters_mod.UnknownPurpose,
    ) as e:
        return {
            "available": False,
            "error": f"{type(e).__name__}: {e}",
            "fallback_reason": "out_of_scope",
        }

    weather_snapshot = weather_mod.smoke_kma_nowcast(
        req.regions[0] if req.regions else "jeju_city",
        target_start=req.start_date,
        target_days=req.days,
    )
    sections = [trust_mod.judge_section(mf, weather_snapshot=weather_snapshot) for mf in bundle.per_moment]
    intro = assemble_mod.compose_intro(
        sections,
        req.companion,
        special_notes=form_state.get("special_notes"),
    )
    itinerary = assemble_mod.dispatch_itinerary(
        sections,
        req.days,
        req.start_date,
        selected_regions=req.regions,
        selected_moments=req.moments,
    )

    return {
        "available": True,
        "intro": {"text": intro.text, "llm_used": intro.llm_used},
        "sections": [_pack_section_payload(section) for section in sections],
        "weather": _pack_weather_payload(weather_snapshot),
        "itinerary": itinerary,
    }


def _pack_section_payload(section: Any) -> dict:
    return {
        "moment": getattr(section, "moment", ""),
        "items": [
            {
                "name": getattr(item, "name", ""),
                "badge": getattr(item, "badge", ""),
                "note": getattr(item, "note", ""),
                "address": getattr(item, "address", None),
            }
            for item in (getattr(section, "items", None) or [])
        ],
        "fallback": _pack_fallback_payload(getattr(section, "fallback", None)),
    }


def _pack_fallback_payload(fallback: Any) -> dict | None:
    if fallback is None:
        return None
    return {
        "reason": getattr(fallback, "reason", ""),
        "message": getattr(fallback, "message", ""),
        "stats": getattr(fallback, "stats", None),
    }


def _pack_weather_payload(snapshot: dict | None) -> dict:
    if not snapshot:
        return {"available": False, "provider": "kma_api_hub"}
    public_keys = {
        "available",
        "provider",
        "risk_level",
        "signals",
        "labels",
        "summary",
        "issued_at_label",
        "daily_forecasts",
        "region",
        "source",
        "http_status",
    }
    return {k: snapshot.get(k) for k in public_keys if k in snapshot}


TOOL_RUNNERS = {
    "web_search_jeju": _run_web_search_jeju,
    "search_places": _run_search_places,
    "get_place_detail": _run_get_place_detail,
    "verify_claim": _run_verify_claim,
    "verify_review": _run_verify_review,
    "suggest_form_update": _run_suggest_form_update,
    "preview_region_coverage": _run_preview_region_coverage,
    "suggest_form_augment": _run_suggest_form_augment,
    "build_pack": _run_build_pack,
}


def _normalize_place_name(name: str | None) -> str:
    return re.sub(r"[\s,·ㆍ]+", "", name or "").lower()


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        clean = value.strip(" \t\n\r,，.。·ㆍ-")
        if not clean:
            continue
        key = _normalize_place_name(clean)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(clean)
    return result


def _extract_candidate_names_from_assistant_text(text_in: str) -> list[str]:
    matches = re.findall(r"먼저\s+(.+?)(?:\s+같은 후보|\s+후보를|\s+볼 수|\s+확인)", text_in)
    matches.extend(re.findall(r"([\w가-힣&().\s,·ㆍ]+?)\s+후보가\s+있", text_in))
    names: list[str] = []
    for match in matches:
        names.extend(re.split(r"\s*,\s*|\s*·\s*|\s*ㆍ\s*", match))
    return _unique_preserve_order(names)


def _extract_explicit_exclusions_from_user_text(text_in: str) -> list[str]:
    if not re.search(r"제외|빼고|말고", text_in):
        return []
    before = re.split(r"제외|빼고|말고", text_in, maxsplit=1)[0]
    before = re.sub(r"은$|는$|을$|를$", "", before.strip())
    names = re.split(r"\s*,\s*|\s*·\s*|\s*ㆍ\s*", before)
    return _unique_preserve_order(names)


def _conversation_exclude_names(conv: list[dict]) -> list[str]:
    user_messages = [m.get("content") or "" for m in conv if m.get("role") == "user"]
    last_user = user_messages[-1] if user_messages else ""
    wants_more = bool(re.search(r"더|이외|다른|추가|제외|빼고|말고", last_user))
    if not wants_more:
        return []

    names: list[str] = []
    for message in conv:
        if message.get("role") == "assistant":
            names.extend(_extract_candidate_names_from_assistant_text(message.get("content") or ""))
    names.extend(_extract_explicit_exclusions_from_user_text(last_user))
    return _unique_preserve_order(names)


def _latest_user_text(conv: list[dict]) -> str:
    return next(
        (m.get("content") or "" for m in reversed(conv) if m.get("role") == "user"),
        "",
    )


def _all_user_text(conv: list[dict]) -> str:
    return " ".join(m.get("content") or "" for m in conv if m.get("role") == "user")


def _infer_regions_from_text(text_in: str, form_state: dict | None = None) -> list[str]:
    regions: list[str] = []
    for key, label in REGION_LABEL_KO.items():
        if label and label in text_in:
            regions.append(key)
    if regions:
        return _unique_preserve_order(regions)

    raw_regions = (form_state or {}).get("regions") or []
    if isinstance(raw_regions, str):
        raw_regions = [raw_regions]
    return [r for r in raw_regions if r in filters_mod.REGIONS]


def _infer_category_from_text(text_in: str, form_state: dict | None = None) -> str:
    if re.search(r"숙박|숙소|호텔|펜션|리조트|게스트하우스", text_in):
        return "accommodation"
    if re.search(r"축제|행사|공연|이벤트", text_in):
        return "festival"
    if re.search(r"문화|전시|전시관|미술관|박물관|실내|비\s*오는\s*날", text_in):
        return "culture"
    if re.search(r"쇼핑|기념품|선물|면세|소품샵|특산품", text_in):
        return "shopping"
    if re.search(r"체험|감귤|액티비티|승마|요트|공방|클래스", text_in):
        return "experience"
    if re.search(r"맛집|식당|점심|저녁|아침|해산물|해물|횟집|먹|음식|한식|갈치|고등어|전복|우럭", text_in):
        return "food"
    if re.search(r"카페|커피|찻집|차\s*(마시|한잔|한\s*잔)|글쓰기", text_in):
        return "cafe"
    if re.search(r"바다|바닷가|해변|해수욕장|해안|비치", text_in):
        return "beach"
    if re.search(r"오름|산책|걷|트레킹", text_in):
        return "oreum"
    if re.search(r"시장|오일장|로컬", text_in):
        return "market"

    moments = (form_state or {}).get("moments") or []
    if isinstance(moments, str):
        moments = [moments]
    for moment in moments:
        category = filters_mod.MOMENT_TO_CATEGORY.get(moment)
        if category:
            return category
    return ""


def _infer_keywords_from_text(text_in: str) -> list[str]:
    keywords: list[str] = []
    if re.search(r"해산물|해물|횟집|회|생선|갈치|고등어|전복|우럭|fish|seafood", text_in, re.IGNORECASE):
        keywords.append("해산물")
    if re.search(r"혼자|혼밥|혼자서|솔로", text_in):
        keywords.append("혼자")
    if re.search(r"점심|런치", text_in):
        keywords.append("점심")
    if re.search(r"조용|한적|고요", text_in):
        keywords.append("조용한")
    return _unique_preserve_order(keywords)


def _infer_limit_from_text(text_in: str) -> int:
    match = re.search(r"(\d+)\s*곳", text_in)
    if match:
        return max(1, min(10, int(match.group(1))))
    if re.search(r"한\s*곳|한곳|하나|1\s*곳|한\s*군데|한군데|추천해준다면", text_in):
        return 1
    return 3


def _infer_limit_from_conversation(last_user: str, text_all: str) -> int:
    if re.search(r"한\s*곳|한곳|하나|1\s*곳|한\s*군데|한군데|추천해준다면", last_user):
        return 1
    if re.search(r"\d+\s*곳", last_user):
        return _infer_limit_from_text(last_user)
    if re.search(r"한\s*곳|한곳|하나|1\s*곳|한\s*군데|한군데|추천해준다면", text_all):
        return 1
    return _infer_limit_from_text(text_all if text_all else last_user)


def _is_search_like_text(text_in: str) -> bool:
    return bool(re.search(
        r"추천|맛집|식당|카페|오름|바다|바닷가|해변|해수욕장|해산물|해물|점심|저녁|어디|몇\s*개|몇\s*곳|리스트|후보|한\s*곳|한곳",
        text_in,
    ))


def _is_fix_request_question(text_in: str) -> bool:
    return bool(re.search(r"수정\s*요청|수정\s*이력|수정요청내역|주의\s*내용|뭐.*주의|무엇.*주의", text_in))


def _is_transit_question(text_in: str) -> bool:
    return bool(re.search(r"주차|주차장|정류소|버스\s*정류|대중교통|교통|이동", text_in))


def _is_weather_question(text_in: str) -> bool:
    return bool(re.search(r"날씨|기상|비|강수|바람|풍속|기온|덥|더워|추워|춥|우산", text_in))


def _parse_form_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _run_weather_signal(form_state: dict) -> dict:
    raw_regions = form_state.get("regions") or ["jeju_city"]
    if isinstance(raw_regions, str):
        raw_regions = [raw_regions]
    region = next((r for r in raw_regions if r in filters_mod.REGIONS), "jeju_city")
    target_start = _parse_form_date(form_state.get("start_date") or form_state.get("startDate"))
    try:
        target_days = int(form_state.get("days") or form_state.get("durationDays") or 1)
    except (TypeError, ValueError):
        target_days = 1
    target_days = max(1, min(3, target_days))
    snapshot = weather_mod.smoke_kma_nowcast(
        region,
        target_start=target_start,
        target_days=target_days,
    )
    return {
        "region": region,
        "region_label": REGION_LABEL_KO.get(region, region),
        "target_start": target_start.isoformat() if target_start else None,
        "target_days": target_days,
        "available": bool(snapshot.get("available")),
        "provider": snapshot.get("provider"),
        "risk_level": snapshot.get("risk_level"),
        "labels": list(snapshot.get("labels") or []),
        "summary": snapshot.get("summary"),
        "daily_forecasts": list(snapshot.get("daily_forecasts") or []),
        "reason": snapshot.get("reason"),
        "source": snapshot.get("source"),
    }


def _infer_search_places_args(conv: list[dict], form_state: dict | None = None) -> dict:
    text_all = _all_user_text(conv)
    last_user = _latest_user_text(conv)
    intent = "list"
    if re.search(r"몇\s*개|몇\s*곳|총\s*개수|개수", last_user):
        intent = "count"
    elif re.search(r"추천|한\s*곳|한곳|하나|점심|저녁|해산물|해물|혼자", text_all):
        intent = "recommend"

    return {
        "regions": _infer_regions_from_text(text_all, form_state),
        "category": _infer_category_from_text(text_all, form_state),
        "limit": _infer_limit_from_conversation(last_user, text_all),
        "intent": intent,
        "keywords": _infer_keywords_from_text(text_all),
        "exclude_names": _conversation_exclude_names(conv),
    }


def _is_web_search_question(text_in: str) -> bool:
    return bool(re.search(
        r"요즘|최신|최근|지금|오늘|내일|이번\s*주|이번\s*달|웹|검색|찾아봐|찾아줘|"
        r"운영시간|휴무|폐업|축제|행사|공연|이벤트|가볼\s*만한|갈\s*만한|핫플|"
        r"실시간|어느\s*지역|어디\s*지역|지역에\s*있|어디에\s*있",
        text_in,
    ))


def _infer_place_detail_query(conv: list[dict]) -> str:
    last_user = _latest_user_text(conv).strip()
    if not last_user:
        return ""
    if _is_weather_question(last_user):
        return ""

    previous_candidates: list[str] = []
    for message in conv:
        if message.get("role") == "assistant":
            previous_candidates.extend(_extract_candidate_names_from_assistant_text(message.get("content") or ""))
    normalized_user = _normalize_place_name(last_user)
    for candidate in _unique_preserve_order(previous_candidates):
        key = _normalize_place_name(candidate)
        if key and key in normalized_user:
            return candidate

    if _is_general_advice_text(last_user) or _is_region_category_query(last_user):
        return ""

    asks_detail = bool(re.search(r"자세|상세|관해|대해|어때|뭐야|어떤|위치|주소|하\.*", last_user))
    asks_detail = asks_detail or _is_fix_request_question(last_user) or _is_transit_question(last_user)
    asks_list = bool(re.search(r"추천|리스트|몇\s*개|몇\s*곳|후보|어디|맛집들|식당들", last_user))
    if not asks_detail or asks_list:
        return ""

    cleaned = re.sub(
        r"(?i)(에\s*관해|에\s*대해|관해|대해|자세히|상세히|정보|위치|주소|알려줘|알려주세요|어때|뭐야|어떤거야|어떤가요|수정\s*요청\s*내역|수정요청내역|수정\s*요청|수정\s*이력|주의\s*내용|교통\s*편|주차장?|정류소|버스\s*정류장?|대중교통|교통|이동|있어|있나요|가능|하\.*)",
        " ",
        last_user,
    )
    cleaned = re.sub(r"[?？！!~…]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip(" \t\n\r,，.。·ㆍ")
    for _ in range(3):
        next_cleaned = re.sub(r"\s*(이나|하고|의|은|는|이|가|을|를|와|과|나|랑)$", "", cleaned).strip()
        if next_cleaned == cleaned:
            break
        cleaned = next_cleaned
    if len(_normalize_place_name(cleaned)) < 2:
        return ""
    return cleaned


def _is_general_advice_text(text_in: str) -> bool:
    return bool(re.search(r"처음|여행계획|계획|코스|일정|어떻게|세우|준비|팁|방법|어떤\s*곳|가보면\s*좋", text_in))


def _is_region_category_query(text_in: str) -> bool:
    has_region = bool(_infer_regions_from_text(text_in, {}))
    has_category = bool(_infer_category_from_text(text_in, {}))
    return has_region and has_category


def _should_answer_without_search(messages_in: list[dict]) -> bool:
    conv = [
        {"role": m.get("role"), "content": m.get("content") or ""}
        for m in messages_in
        if m.get("role") in {"user", "assistant"}
    ]
    last_user = _latest_user_text(conv)
    if not last_user:
        return False
    if _infer_place_detail_query(conv):
        return False
    if _is_fix_request_question(last_user) or _is_transit_question(last_user) or _is_weather_question(last_user):
        return False
    if _is_region_category_query(last_user):
        return False
    if re.search(r"맛집|식당|카페|오름|바다|바닷가|해변|해수욕장|해산물|몇\s*곳|몇\s*개|리스트", last_user):
        return False
    return bool(re.search(r"처음|여행계획|계획|코스|일정|어떻게|세우|준비|팁|방법|어떤\s*곳|가보면\s*좋", last_user))


def _free_advice_user_text(messages_in: list[dict]) -> str:
    return "\n".join(
        f"{m.get('role')}: {m.get('content') or ''}"
        for m in messages_in[-6:]
        if m.get("role") in {"user", "assistant"}
    )


def _template_free_advice(last_user: str) -> str:
    if "제주시" in last_user:
        return (
            "제주시는 처음 여행에서 동선을 잡기 좋은 출발점이에요. "
            "도착일에는 공항에서 가까운 원도심·해안 산책 흐름을 가볍게 잡고, 바다 산책, 오름 산책, 로컬 시장, 조용한 카페처럼 "
            "원하는 순간을 1~2개만 고른 뒤 지도에서 지역을 선택해 보세요. "
            "구체적인 장소명은 공공데이터로 확인되는 후보만 따로 좁혀드릴게요."
        )
    return (
        "제주가 처음이라면 제주시, 애월·한림, 성산·구좌, 서귀포처럼 지역을 먼저 넓게 나누고 하루에 한 권역만 잡는 방식이 좋아요. "
        "첫째 날은 제주시나 공항 근처에서 가볍게 시작하고, 둘째 날은 성산·구좌의 오름·바다나 애월·한림의 카페·해안 중 하나를 고르는 식이 안정적입니다. "
        "마지막 날은 공항 이동을 고려한 짧은 코스로 잡아보세요. "
        "지도에서 지역과 담고 싶은 순간을 고르면 확인된 후보만 근거와 함께 좁혀드릴게요."
    )


def _is_specific_fact_or_search_question(text_in: str) -> bool:
    return bool(re.search(
        r"추천|맛집|식당|카페|오름|바다|바닷가|해변|해수욕장|해산물|해물|점심|저녁|"
        r"몇\s*개|몇\s*곳|리스트|후보|한\s*곳|한곳|하나|가볼\s*만한|갈\s*만한|"
        r"운영시간|휴무|폐업|축제|행사|공연|이벤트|리뷰|블로그|검증|팩트체크|"
        r"주소|주차|정류소|대중교통|수정\s*요청|수정요청",
        text_in,
    ))


def _template_general_question_answer(last_user: str) -> str:
    if re.search(r"제주\s*공항|제주국제공항", last_user) and re.search(
        r"어느\s*지역|어디\s*지역|지역에\s*있|어디에\s*있|위치|권역",
        last_user,
    ):
        return (
            "제주공항은 여행 권역으로 보면 제주시 쪽에 있어요. "
            "도착일이나 출발일에는 제주시 권역을 가볍게 잡는 편이 동선이 편합니다. "
            "다만 특정 숙소·식당·운영시간처럼 바뀔 수 있는 정보는 공공데이터나 웹 출처로 따로 확인해서 안내할게요."
        )

    if "제주시" in last_user and re.search(r"처음|흐름|동선|어떻게|시작", last_user):
        return (
            "제주시는 공항을 기준으로 도착일이나 출발일 동선을 잡기 좋은 권역이에요. "
            "처음이라면 공항 근처에서 시작해 원도심, 해안 산책, 시장이나 카페처럼 부담이 작은 흐름으로 잡는 편이 좋습니다. "
            "구체적인 장소는 지역과 순간을 고르면 제주를 담다가 확인한 공공데이터 기준 후보만 골라드릴게요."
        )

    if re.search(r"제주.*처음|처음.*제주", last_user) and re.search(r"지역|어디|권역|좋", last_user):
        return (
            "제주가 처음이라면 제주시, 애월·한림, 성산·구좌, 서귀포를 큰 권역으로 나눠 보면 좋아요. "
            "공항 접근성과 짧은 동선은 제주시, 카페·해안 흐름은 애월·한림, 오름·일출·바다 조합은 성산·구좌, 폭포·남쪽 바다는 서귀포가 잡기 쉽습니다. "
            "하루에 한 권역만 잡고, 선택한 지역에서 공공데이터로 확인되는 장소 후보를 좁히는 방식이 가장 안정적입니다."
        )

    if re.search(r"공항.*근처|근처.*공항|도착일|출발일", last_user) and not _is_specific_fact_or_search_question(last_user):
        return (
            "도착일과 출발일은 공항 이동 시간을 먼저 비워두고 제주시 권역에서 짧게 보는 흐름이 안전해요. "
            "짐 이동이 있으면 바다·오름처럼 이동 시간이 긴 순간보다 카페, 시장, 가벼운 산책을 앞에 두는 편이 좋습니다. "
            "장소 후보는 지역과 순간을 고르면 공공데이터 기준으로 확인되는 곳만 따로 좁혀드릴게요."
        )

    return ""


def _try_general_question_answer(messages_in: list[dict]) -> str:
    conv = [
        {"role": m.get("role"), "content": m.get("content") or ""}
        for m in messages_in
        if m.get("role") in {"user", "assistant"}
    ]
    last_user = _latest_user_text(conv)
    if not last_user:
        return ""
    if _infer_place_detail_query(conv):
        return ""
    airport_question = bool(re.search(r"제주\s*공항|제주국제공항", last_user))
    if not airport_question and _is_specific_fact_or_search_question(last_user):
        return ""
    return _template_general_question_answer(last_user)


def _answer_contract(
    answer_type: str,
    source_type: str,
    *,
    confidence: str = "medium",
    requires_tool: bool = False,
    limitations: list[str] | None = None,
) -> dict:
    return {
        "answer_type": answer_type,
        "source_type": source_type,
        "confidence": confidence,
        "requires_tool": requires_tool,
        "limitations": limitations or [],
    }


def _general_question_contract() -> dict:
    return _answer_contract(
        "general_knowledge",
        "stable_general",
        requires_tool=False,
        limitations=["장소·운영시간·요금은 별도 근거 확인 필요"],
    )


def _contract_for_tool(tool_name: str) -> dict:
    if tool_name == "weather_signal":
        return _answer_contract(
            "weather",
            "kma_weather",
            confidence="high",
            requires_tool=True,
            limitations=["예보는 발표 시각 이후 바뀔 수 있음"],
        )
    if tool_name == "web_search_jeju":
        return _answer_contract(
            "fresh_web",
            "web",
            confidence="medium",
            requires_tool=True,
            limitations=["웹 출처 기준이며 내부 공공데이터 검증과 구분"],
        )
    if tool_name == "search_places":
        return _answer_contract(
            "place_recommendation",
            "public_data",
            confidence="high",
            requires_tool=True,
            limitations=["운영시간·대표 메뉴·혼잡도는 별도 확인 필요"],
        )
    if tool_name == "get_place_detail":
        return _answer_contract(
            "place_detail",
            "public_data",
            confidence="high",
            requires_tool=True,
            limitations=["실시간 운영 변동은 방문 전 확인 필요"],
        )
    if tool_name == "verify_review":
        return _answer_contract(
            "claim_verification",
            "public_data",
            confidence="medium",
            requires_tool=True,
            limitations=["공공데이터에 없는 주장은 확인 불가로 분리"],
        )
    if tool_name == "build_pack":
        return _answer_contract(
            "travel_pack",
            "public_data",
            confidence="high",
            requires_tool=True,
            limitations=["데이터 부족 조합은 fallback_reason으로 분리"],
        )
    if tool_name == "preview_region_coverage":
        return _answer_contract(
            "coverage_preview",
            "public_data",
            confidence="high",
            requires_tool=True,
            limitations=["후보 수는 현재 적재된 공공데이터 기준"],
        )
    return _answer_contract("conversation", "agent", limitations=["사실 정보는 추가 근거 확인 필요"])


def _pool_context(tool_name: str, args: dict, result: dict) -> dict:
    return {
        "tool": tool_name,
        "args": args,
        "result": result,
        "contract": _contract_for_tool(tool_name),
    }


def _category_label(category: str | None) -> str:
    if not category:
        return "선택한 순간"
    if category in CATEGORY_LABEL_KO:
        return CATEGORY_LABEL_KO[category]
    for moment, mapped_category in filters_mod.MOMENT_TO_CATEGORY.items():
        if mapped_category == category:
            return MOMENT_LABEL_KO.get(moment, category)
    return category


_SEARCH_POOL_CONTEXT_PREFIX = "HARUBANG_SEARCH_POOL_JSON:"


def _format_search_pool_context(pool: dict) -> str:
    return _SEARCH_POOL_CONTEXT_PREFIX + "\n" + json.dumps(pool, ensure_ascii=False)


def _search_pool_context_messages(conv: list[dict]) -> list[dict]:
    messages: list[dict] = []
    for message in conv:
        if message.get("role") != "system":
            continue
        content = message.get("content") or ""
        if _SEARCH_POOL_CONTEXT_PREFIX not in content:
            continue
        raw = content.split(_SEARCH_POOL_CONTEXT_PREFIX, 1)[1].strip()
        try:
            pool = json.loads(raw)
        except json.JSONDecodeError:
            continue
        tool_name = pool.get("tool")
        result = pool.get("result")
        if tool_name and isinstance(result, dict):
            messages.append({
                "role": "tool",
                "name": tool_name,
                "content": json.dumps(result, ensure_ascii=False),
            })
    return messages


def _candidate_names_from_pool_context(conv: list[dict]) -> list[str]:
    names: list[str] = []
    for message in _search_pool_context_messages(conv):
        try:
            payload = json.loads(message.get("content") or "{}")
        except json.JSONDecodeError:
            continue
        for item in payload.get("items") or []:
            name = item.get("name")
            if name:
                names.append(name)
    return _unique_preserve_order(names)


def _should_replace_low_value_reply(reply: str, conv: list[dict]) -> bool:
    if not _search_pool_context_messages(conv):
        return False
    normalized_reply = _normalize_place_name(reply)
    for name in _candidate_names_from_pool_context(conv):
        if _normalize_place_name(name) in normalized_reply:
            return False
    return bool(re.search(
        r"조건을.*알려|조금 더 확인|바로 단정|지역,?\s*음식|동행자.*알려|더 좁혀",
        reply,
    ))


def _prepare_tool_args(name: str, args: dict, conv: list[dict], form_state: dict) -> dict:
    """LLM tool-call arguments가 비어 있을 때 현재 대화와 폼 상태로 안전하게 보강한다."""
    prepared = dict(args or {})
    if name == "search_places":
        inferred_args = _infer_search_places_args(conv, form_state or {})
        for key in ("regions", "category", "intent", "limit", "keywords"):
            if inferred_args.get(key) and not prepared.get(key):
                prepared[key] = inferred_args[key]
        inferred_excludes = _conversation_exclude_names(conv)
        if inferred_excludes:
            prepared["exclude_names"] = _unique_preserve_order(
                list(prepared.get("exclude_names") or []) + inferred_excludes
            )
    elif name == "get_place_detail":
        inferred_query = _infer_place_detail_query(conv)
        if inferred_query and not prepared.get("query"):
            prepared["query"] = inferred_query
        inferred_args = _infer_search_places_args(conv, form_state or {})
        if inferred_args.get("regions") and not prepared.get("regions"):
            prepared["regions"] = inferred_args["regions"]
        if inferred_args.get("category") and not prepared.get("category"):
            prepared["category"] = inferred_args["category"]
    elif name in {"build_pack", "suggest_form_augment"}:
        if not isinstance(prepared.get("form_state"), dict):
            prepared["form_state"] = dict(form_state or {})
    elif name == "verify_review":
        if not prepared.get("text"):
            prepared["text"] = _latest_user_text(conv)
    elif name == "preview_region_coverage":
        if not prepared.get("regions"):
            prepared["regions"] = _infer_regions_from_text(_latest_user_text(conv), form_state)
    elif name == "web_search_jeju":
        if not prepared.get("query"):
            prepared["query"] = _latest_user_text(conv)
        if not prepared.get("context"):
            filled = {k: v for k, v in (form_state or {}).items() if v not in (None, "", [], 0)}
            if filled:
                prepared["context"] = json.dumps(filled, ensure_ascii=False)
    return prepared


def _build_search_pool_context(messages_in: list[dict], form_state: dict) -> dict | None:
    conv = [
        {"role": m.get("role"), "content": m.get("content") or ""}
        for m in messages_in
        if m.get("role") in {"user", "assistant"}
    ]
    last_user = _latest_user_text(conv)
    if not last_user:
        return None

    if _is_weather_question(last_user) and not _infer_place_detail_query(conv):
        try:
            result = _run_weather_signal(form_state)
        except Exception as e:
            result = {"available": False, "error": f"{type(e).__name__}: {e}"}
        return _pool_context("weather_signal", {}, result)

    detail_query = _infer_place_detail_query(conv)
    if detail_query:
        args = {"query": detail_query}
        inferred = _infer_search_places_args(conv, form_state)
        if inferred.get("regions"):
            args["regions"] = inferred["regions"]
        explicit_category = _infer_category_from_text(last_user, {})
        if explicit_category:
            args["category"] = explicit_category
        try:
            result = _run_get_place_detail(args)
        except Exception as e:
            result = {"query": detail_query, "items": [], "error": f"{type(e).__name__}: {e}"}
        return _pool_context("get_place_detail", args, result)

    if re.search(r"팩|일정|코스|만들|짜줘|짜 줘", last_user):
        args = {"form_state": dict(form_state or {})}
        try:
            result = _run_build_pack(args)
        except Exception as e:
            result = {"available": False, "error": f"{type(e).__name__}: {e}"}
        return _pool_context("build_pack", args, result)

    if re.search(r"리뷰|블로그|맞아|사실|검증|팩트체크", last_user):
        args = {"text": last_user}
        try:
            result = _run_verify_review(args)
        except Exception as e:
            result = {"claims": [], "error": f"{type(e).__name__}: {e}"}
        return _pool_context("verify_review", args, result)

    if _is_web_search_question(last_user):
        args = {"query": last_user}
        filled = {k: v for k, v in (form_state or {}).items() if v not in (None, "", [], 0)}
        if filled:
            args["context"] = json.dumps(filled, ensure_ascii=False)
        try:
            result = _run_web_search_jeju(args)
        except Exception as e:
            result = {
                "available": False,
                "query": last_user,
                "sources": [],
                "source_type": "web",
                "error": f"{type(e).__name__}: {e}",
            }
        return _pool_context("web_search_jeju", args, result)

    if re.search(r"비교|지역 추천|어디.*좋|좋아|강점|커버리지|가볼\s*만한|갈\s*만한|어디\s*갈|처음.*지역", last_user):
        regions = _infer_regions_from_text(last_user, form_state)
        if regions:
            args = {"regions": regions}
            try:
                result = _run_preview_region_coverage(args)
            except Exception as e:
                result = {"regions": [], "error": f"{type(e).__name__}: {e}"}
            return _pool_context("preview_region_coverage", args, result)

    if re.search(r"폼|조건|바꾸|추천 조합|더 좋은 조합|보강", last_user):
        args = {"form_state": dict(form_state or {})}
        try:
            result = _run_suggest_form_augment(args)
        except Exception as e:
            result = {"available": False, "suggestions": [], "error": f"{type(e).__name__}: {e}"}
            return _pool_context("suggest_form_augment", args, result)

    if not _is_search_like_text(_all_user_text(conv)):
        return None

    args = _infer_search_places_args(conv, form_state)
    if not args.get("regions") or not args.get("category"):
        return None
    try:
        result = _run_search_places(args)
    except Exception as e:
        result = {"items": [], "error": f"{type(e).__name__}: {e}"}
    return _pool_context("search_places", args, result)


def _fallback_reply_from_tool_messages(conv: list[dict]) -> str:
    """LLM이 도구 호출 뒤 최종 문장을 비우는 경우를 위한 사용자용 안전 답변."""
    last_user = next(
        (m.get("content") or "" for m in reversed(conv) if m.get("role") == "user"),
        "",
    )
    if re.search(r"왜.*반복|반복.*왜|계속.*나와|또.*나와", last_user):
        return (
            "이전 후보를 제외 조건으로 넘기지 못해서 같은 장소가 반복됐어요. "
            "이제 이미 보여드린 이전 후보와 사용자가 제외한 후보는 빼고 다시 좁혀드릴게요."
        )

    conv_with_pool = conv + _search_pool_context_messages(conv)
    for message in reversed(conv_with_pool):
        if message.get("role") != "tool":
            continue
        try:
            payload = json.loads(message.get("content") or "{}")
        except json.JSONDecodeError:
            continue

        name = message.get("name")
        if name == "web_search_jeju":
            if not payload.get("available"):
                reason = payload.get("reason") or payload.get("error") or "웹 출처를 확인하지 못했습니다"
                return (
                    f"지금 질문은 웹에서 바로 확인하려 했지만 {reason}. "
                    "그래서 확인된 출처 없이 장소명·운영시간을 단정하지 않겠습니다. 지역이나 순간을 하나 고르면 확인된 후보부터 좁혀드릴게요."
                )
            answer = (payload.get("answer") or "").strip()
            sources = payload.get("sources") or []
            source_text = ""
            if sources:
                labels = []
                for source in sources[:3]:
                    title = source.get("title") or source.get("url") or "웹 출처"
                    url = source.get("url")
                    labels.append(f"{title}({url})" if url else title)
                source_text = " 확인한 출처: " + ", ".join(labels) + "."
            if answer:
                return f"{answer} 웹 출처 기준으로 확인한 내용입니다.{source_text}"
            return "웹 출처는 확인했지만 요약 가능한 본문이 부족합니다." + source_text

        if name == "weather_signal":
            region_text = payload.get("region_label") or "선택한 지역"
            if not payload.get("available"):
                reason = payload.get("reason") or payload.get("error") or "기상청 예보를 확인하지 못했습니다"
                return (
                    f"{region_text}의 여행 기간 날씨는 지금 바로 확정해서 말하기 어렵습니다. "
                    f"기상청 예보 연결 결과: {reason}. "
                    "그래서 야외 일정은 바람·비를 한 번 더 확인한 뒤 넣는 편이 안전합니다."
                )
            daily = payload.get("daily_forecasts") or []
            labels = payload.get("labels") or []
            label_text = ", ".join(labels[:3]) if labels else "특이 신호 없음"
            if daily:
                lines = []
                for day in daily[:3]:
                    forecast = day.get("forecast") or {}
                    parts = [
                        day.get("date_label") or day.get("date") or "여행일",
                        str(forecast.get("sky") or "날씨 확인"),
                    ]
                    if forecast.get("precipitation_probability") is not None:
                        parts.append(f"강수확률 {forecast['precipitation_probability']}%")
                    if forecast.get("temperature") is not None:
                        parts.append(f"기온 {forecast['temperature']:g}도")
                    if forecast.get("wind_speed") is not None:
                        parts.append(f"풍속 {forecast['wind_speed']:g}m/s")
                    lines.append(" · ".join(parts))
                return (
                    f"{region_text}의 여행 기간 예보는 {label_text}로 볼 수 있습니다. "
                    + " / ".join(lines)
                    + " 야외 오름·바다 일정은 비와 바람 신호가 있는 날을 피해서 배치하면 좋습니다."
                )
            summary = payload.get("summary") or "기상청 예보가 확인되었습니다."
            return f"{region_text} 날씨는 {summary} 주요 신호는 {label_text}입니다."

        if name == "build_pack":
            if not payload.get("available", True):
                reason = payload.get("error") or "현재 폼 조건을 여행팩으로 조립하지 못했습니다"
                return (
                    f"이 조건으로는 바로 여행팩을 만들기 어렵습니다. {reason}. "
                    "지역, 날짜, 동행자, 순간 카드를 한 번 더 확인해 주세요."
                )
            intro_text = (payload.get("intro") or {}).get("text") or "선택한 조건으로 여행팩을 조립했습니다."
            sections = payload.get("sections") or []
            names: list[str] = []
            fallback_messages: list[str] = []
            for section in sections:
                for item in (section.get("items") or [])[:2]:
                    if item.get("name"):
                        names.append(item["name"])
                fallback = section.get("fallback")
                if fallback and fallback.get("message"):
                    fallback_messages.append(fallback["message"])
            weather_summary = (payload.get("weather") or {}).get("summary")
            parts = [intro_text]
            if names:
                parts.append("확인된 후보로는 " + ", ".join(_unique_preserve_order(names)[:4]) + " 등을 먼저 볼 수 있어요.")
            if fallback_messages:
                parts.append("다만 " + " ".join(fallback_messages[:2]))
            if weather_summary:
                parts.append(f"날씨 신호는 {weather_summary}입니다.")
            return " ".join(parts)

        if name == "verify_review":
            claims = payload.get("claims") or []
            if not claims:
                return (
                    "붙여주신 문장에서 바로 검증할 주장을 찾지 못했습니다. "
                    "장소명과 주장 문장을 함께 주시면 저희 공공데이터 기준으로 다시 확인할게요."
                )
            lines = []
            for claim in claims[:3]:
                text_in = claim.get("text") or "해당 문장"
                reason = claim.get("reason") or "근거를 확인했습니다."
                verdict = claim.get("verdict") or "coverage_gap"
                label = {
                    "verified": "확인됨",
                    "contradicted": "반증 확인",
                    "outdated": "변경 가능성",
                    "coverage_gap": "확인 불가",
                }.get(verdict, verdict)
                lines.append(f"{text_in}: {label}입니다. {reason}")
            return "저희 공공데이터 기준으로 보면 " + " ".join(lines)

        if name == "preview_region_coverage":
            previews = payload.get("regions") or []
            if not previews:
                return "비교할 지역을 찾지 못했습니다. 제주 지역을 하나 이상 알려주시면 공공데이터 커버리지를 비교해드릴게요."
            summaries = []
            for preview in previews[:3]:
                label = preview.get("region_label") or REGION_LABEL_KO.get(preview.get("region"), preview.get("region", "선택 지역"))
                briefing = preview.get("briefing")
                if briefing:
                    summaries.append(briefing)
                    continue
                moments = preview.get("moments") or []
                strong = [
                    m.get("moment_label") or MOMENT_LABEL_KO.get(m.get("moment"), m.get("moment", ""))
                    for m in moments
                    if not m.get("coverage_gap")
                ][:2]
                weak = [
                    m.get("moment_label") or MOMENT_LABEL_KO.get(m.get("moment"), m.get("moment", ""))
                    for m in moments
                    if m.get("coverage_gap")
                ][:2]
                summary = f"{label}은(는) "
                if strong:
                    summary += " · ".join(strong) + " 후보가 비교적 확인됩니다"
                else:
                    summary += "선택한 순간 후보가 저희가 참조하는 공공데이터 기준으로 확인되지 않습니다"
                if weak:
                    summary += f", { ' · '.join(weak) }은 데이터가 부족합니다"
                summaries.append(summary + ".")
            return " ".join(summaries)

        if name == "suggest_form_augment":
            suggestions = payload.get("suggestions") or []
            if not suggestions:
                return "지금 폼 조건에서는 바로 추가할 만한 보강 제안을 찾지 못했습니다. 현재 조건 그대로 팩을 만들어도 됩니다."
            lines = []
            for suggestion in suggestions[:3]:
                labels = ", ".join(suggestion.get("labels") or suggestion.get("values") or [])
                reason = suggestion.get("reason") or "저희 공공데이터 기준으로 함께 볼 만한 조건입니다."
                lines.append(f"{labels}: {reason}")
            return "폼에 더해볼 만한 제안은 " + " ".join(lines)

        if name == "search_places":
            total = int(payload.get("total_count") or 0)
            regions = payload.get("regions") or []
            region_text = " · ".join(REGION_LABEL_KO.get(r, r) for r in regions) or "선택한 지역"
            category_text = _category_label(payload.get("category"))
            items = payload.get("items") or []
            item_names = [item.get("name") for item in items[:3] if item.get("name")]
            intent = payload.get("intent") or "list"
            excluded_names = payload.get("excluded_names") or []
            excluded_note = ""
            if excluded_names:
                shown_excluded = ", ".join(str(name) for name in excluded_names[:3])
                excluded_note = f" 제외 요청하신 {shown_excluded}은(는) 빼고 봤습니다."
            wants_one = intent == "recommend" or bool(re.search(r"한\s*곳|한곳|하나|추천해준다면", last_user))

            if total <= 0:
                return (
                    f"{region_text}의 {category_text} 후보는 제주를 담다가 확인한 공공데이터 기준으로 "
                    "아직 확인되지 않았습니다. 지역이나 순간을 조금 바꾸면 다시 찾아볼게요."
                )

            if wants_one and items:
                first = items[0]
                place_name = first.get("name") or "이 후보"
                address = first.get("address")
                keywords = payload.get("keywords") or []
                reason = "수정요청 신호가 없는 후보" if not first.get("has_fix_request") else "확인 필요 신호가 있어 방문 전 확인이 필요한 후보"
                seafood_note = ""
                if any(_normalize_place_name(k) == "해산물" for k in keywords):
                    seafood_note = " 해산물 선호는 검색 조건에 반영했지만, 대표 메뉴는 저희 데이터만으로 확인되지 않습니다."
                address_text = f" 주소는 {address}입니다." if address else " 주소는 저희 데이터에 없습니다."
                return (
                    f"한 곳만 고르면 {place_name}을 먼저 보겠습니다. "
                    f"{region_text}의 {category_text} 후보는 공공데이터 기준으로 {total}곳 확인되고, "
                    f"이 후보는 그중 {reason}입니다."
                    f"{excluded_note}"
                    f"{address_text}"
                    f"{seafood_note} 영업시간은 저희가 참조하는 공공데이터 기준으로 확인되지 않아 방문 전 확인이 필요합니다."
                )

            if item_names:
                examples = ", ".join(item_names)
                return (
                    f"{region_text}에서 {category_text} 후보는 공공데이터 기준으로 {total}곳 확인됩니다. "
                    f"{excluded_note}먼저 {examples} 같은 후보를 볼 수 있어요. "
                    "이 중에서 하나를 고르면 주소와 확인 필요 항목을 기준으로 더 자세히 정리해드릴게요."
                )

            return (
                f"{region_text}에서 {category_text} 후보는 공공데이터 기준으로 {total}곳 확인됩니다. "
                "후보를 더 좁히려면 동행자나 원하는 분위기를 하나만 더 알려주세요."
            )

        if name == "get_place_detail":
            query = payload.get("query") or "물어보신 장소"
            items = payload.get("items") or []
            if not items:
                return (
                    f"{query}은(는) 저희가 참조하는 공공데이터 기준으로는 아직 확인되지 않았습니다. "
                    "장소명을 조금 다르게 적어주시면 다시 찾아볼게요."
                )
            item = items[0]
            place_name = item.get("name") or query
            region_text = item.get("region_label") or REGION_LABEL_KO.get(item.get("region"), item.get("region") or "선택한 지역")
            category_text = item.get("category_label") or _category_label(item.get("category"))
            address = item.get("address")
            source = item.get("source") or "공공데이터 근거"
            if _is_fix_request_question(last_user):
                fix = item.get("fix_request")
                if fix:
                    requests = fix.get("requests") or []
                    if requests:
                        first = requests[0]
                        parts = [
                            f"{place_name}은(는) 콘텐츠 수정요청 {fix.get('count', len(requests))}건이 연결되어 있습니다.",
                            f"최근 요청 유형은 {first.get('change_type_label') or '수정요청'}입니다.",
                        ]
                        if first.get("before_text"):
                            parts.append(f"기존/표기 내용은 {first.get('before_text')}입니다.")
                        if first.get("after_text"):
                            parts.append(f"요청된 수정 내용은 {first.get('after_text')}입니다.")
                        if not first.get("before_text") and not first.get("after_text") and first.get("display_text"):
                            parts.append(f"요청 내용은 {first.get('display_text')}입니다.")
                        parts.append("다만 수정요청은 확정 변경이 아니라 방문 전 확인이 필요한 공공데이터 신호로 보는 게 안전합니다.")
                        return " ".join(parts)
                    checks = ", ".join(fix.get("check_items") or [])
                    return (
                        f"{place_name}은(는) 수정요청 이력이 있는 후보입니다. "
                        f"{fix.get('summary')} "
                        f"다만 {fix.get('known_detail')} "
                        f"그래서 방문 전 확인할 항목은 {checks}입니다."
                    )
                return (
                    f"{place_name}은(는) 제주를 담다가 참조하는 공공데이터 기준으로 수정요청 이력이 확인되지 않았습니다. "
                    "다만 운영시간·휴무처럼 실시간으로 바뀌는 정보는 방문 전 한 번 더 확인하는 편이 좋습니다."
                )
            if _is_transit_question(last_user):
                transit = item.get("transit") or {}
                parking_count = int(transit.get("parking_count") or 0)
                parking_text = (
                    f"반경 {transit.get('parking_radius_km', 1)}km 안에 주차장 {parking_count}곳이 확인됩니다"
                    if parking_count > 0
                    else f"반경 {transit.get('parking_radius_km', 1)}km 안의 주차장 정보는 확인되지 않았습니다"
                )
                bus_text = (
                    f"반경 {transit.get('busstop_radius_km', 0.5)}km 안에 정류소 접근 신호가 있습니다"
                    if transit.get("bus_walkable")
                    else f"반경 {transit.get('busstop_radius_km', 0.5)}km 안의 정류소 접근 신호는 확인되지 않았습니다"
                )
                address_text = f" 주소는 {address}입니다." if address else ""
                return (
                    f"{place_name}의 이동 정보는 공공데이터 좌표 기준으로 보면, {parking_text}. "
                    f"또 {bus_text}.{address_text} 실제 이동 전에는 지도 앱에서 마지막 동선을 한 번 더 확인해 주세요."
                )
            caution = " 이용자 정보 수정요청 이력이 있어 방문 전 재확인이 필요합니다." if item.get("has_fix_request") else ""
            address_text = f" 주소: {address}." if address else " 주소는 저희 데이터에 없습니다."
            return (
                f"{place_name}은(는) {region_text}의 {category_text} 후보로 공공데이터 기준 확인됩니다. "
                f"{address_text} 근거 출처는 {source}입니다."
                f"{caution} 영업시간·대표 메뉴·혼잡도는 현재 저희가 참조하는 공공데이터 기준으로 확인되지 않아 방문 전 확인이 필요합니다."
            )

        if name == "verify_claim":
            claims = payload.get("claims") or []
            if not claims:
                return "검증할 문장을 찾지 못했어요. 리뷰나 안내 문장을 그대로 붙여주시면 공공데이터 기준으로 다시 확인해드릴게요."
            verified = sum(1 for claim in claims if claim.get("verdict") == "verified")
            gaps = sum(1 for claim in claims if claim.get("verdict") == "coverage_gap")
            return (
                f"보내주신 내용은 공공데이터 기준으로 {verified}건 확인했고, {gaps}건은 근거가 부족합니다. "
                "확인되지 않은 항목은 여행팩에 바로 넣기보다 한 번 더 확인하는 편이 좋아요."
            )

        if name == "suggest_form_update":
            return "폼에 반영할 제안을 준비했어요. 아래 제안 카드를 보고 괜찮으면 반영해 주세요."

    return "지금 질문은 바로 단정하기보다 조건을 조금 더 확인해야 해요. 지역, 음식 종류, 동행자 중 하나만 더 알려주시면 공공데이터 기준으로 다시 좁혀드릴게요."


# ─── 시스템 프롬프트 ───

_BASE_SYSTEM_PROMPT = (
    "너는 '하루방 에이전트'이다. 제주 여행 준비를 돕는 신뢰 기반 에이전트 캐릭터로, "
    "제주 상징 돌하르방을 캐릭터화한 존재다.\n\n"
    "모델: 너는 gpt-5-mini이다. 이 서비스는 'gpt-5-mini + RAG + Trust Engine'으로 "
    "같은 모델의 성능을 끌어올리는 프리아이펠 규정을 따른다. "
    "너의 우선 역할은 사용자의 자연어 질문을 먼저 이해하고, 사실 확인이 필요한 부분에만 "
    "공공데이터 근거 도구를 호출한 뒤, 원본·출처 데이터와 대조된 범위 안에서 답변하는 것이다.\n\n"
    "말투: 정중하고 부드러운 존댓말. 무거운 격식은 피하고, 짧고 따뜻하게. "
    "이모지는 쓰지 않는다.\n\n"
    "역할: 사용자가 폼을 채우는 과정에서 궁금한 것에 답하고, 검증된 데이터로 조언한다. "
    "일반 여행 상담, 준비물, 서비스 사용법, 선택 기준 설명처럼 새 사실 조회가 필요 없는 질문은 "
    "gpt-5-mini가 바로 답해도 된다. 장소 추천, 장소 개수, 특정 지역의 후보, 특정 장소 상세, 최신 웹 정보, 리뷰 검증처럼 "
    "사실 확인이 필요한 질문은 반드시 도구(web_search_jeju, search_places, get_place_detail, verify_claim, suggest_form_update)를 "
    "먼저 호출한 뒤 답한다.\n\n"
    "도구 사용 정책:\n"
    "- 사용자가 특정 장소명을 말하며 '자세히', '어때', '위치', '주소', '정보'를 물으면 get_place_detail을 먼저 호출한다.\n"
    "- 사용자가 '수정요청내역', '수정이력', '주의 내용'을 물으면 get_place_detail 결과의 fix_request만 근거로 답한다. "
    "상세 사유가 없으면 없다고 말하고 추정하지 않는다.\n"
    "- 사용자가 '주차장', '정류소', '대중교통', '이동'을 특정 장소와 함께 물으면 get_place_detail 결과의 transit만 근거로 답한다.\n"
    "- 사용자가 여행 기간 날씨를 물으면 기상청 예보 스냅샷만 근거로 날짜별로 답하고, 장소 카드마다 날씨를 반복하지 않는다.\n"
    "- 사용자가 요즘/최신/웹검색/축제/행사/가볼만한 곳처럼 최신성이나 외부 출처가 필요한 질문을 하면 web_search_jeju를 호출한다.\n"
    "- web_search_jeju 결과는 웹 출처 기준이라고 구분하고, sources 밖의 사실은 말하지 않는다.\n"
    "- 사용자가 '한 곳만', '하나만', '점심으로 한 곳 추천'을 말하면 search_places의 intent='recommend', limit=1을 사용한다.\n"
    "- 사용자가 '더', '이외에', '제외하고', '빼고'를 말하면 이미 보여준 후보와 사용자가 제외한 후보를 exclude_names에 넣는다.\n"
    "- '해산물', '조용한', '혼자', '점심' 같은 선호는 keywords로 넘긴다. 단, 메뉴·영업시간은 도구 결과에 없으면 말하지 않는다.\n\n"
    "답변 구조:\n"
    "- 첫 문장은 사용자의 질문에 대한 직접 답변으로 시작한다.\n"
    "- 그 다음 현재 폼 상태나 여행 목적을 반영해 왜 그렇게 판단했는지 짧게 설명한다.\n"
    "- 공공데이터로 확인한 내용과 확인하지 못한 한계를 자연스럽게 구분한다.\n"
    "- 더 좁히면 좋은 선택지 1개를 마지막에 제안한다.\n\n"
    "절대 규칙 (지키지 않으면 저희 서비스의 정체성이 무너진다):\n"
    "1) 도구 결과나 폼 컨텍스트 밖의 장소·수치·시간·운영시간을 지어내지 마라. "
    "정보가 없으면 '저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다'라고만 말하라.\n"
    "2) '가장 좋은 곳' '반드시 가야 하는 곳' 같은 단정적 표현을 쓰지 마라. "
    "'저희 데이터로 확인된 곳'이라는 범위 한정을 유지하라.\n"
    "3) 카카오·네이버·블로그 리뷰를 근거로 삼지 마라. "
    "리뷰는 verify_claim의 입력값으로만 활용된다.\n"
    "4) 사용자에게 폼 반영이 필요하면 반드시 suggest_form_update 도구로 제안하고, "
    "사용자 승인 후 반영됨을 안내하라.\n"
    "5) 사용자에게 'DB/RAG', 'tool', '도구 호출', '검색 기준' 같은 내부 구현 표현을 노출하지 마라. "
    "사용자 표현은 '제주를 담다가 확인한 공공데이터 기준'으로 통일한다.\n"
    "6) search_places 결과에 total_count가 있으면 개수 질문에 그 숫자를 먼저 답하고, "
    "items가 있으면 후보 2~3개를 예시로 제시하라.\n"
    "7) 검색 풀 컨텍스트가 제공되면 그 안의 result만 사실 근거로 사용하고, 같은 질문을 다시 묻지 마라.\n"
    "8) items가 1개 이상 있으면 '조건을 더 알려달라'로 답변을 끝내지 마라. "
    "현재 후보 안에서 먼저 판단하고, 마지막에 선택적으로 더 좁힐 기준을 제안하라.\n"
    "9) exclude_names가 있으면 그 후보를 절대 다시 추천하지 말고, 답변에 '제외한 후보는 빼고 봤다'는 취지를 짧게 포함하라.\n"
    "10) 사용자가 불만이나 답답함을 표현하면 사과보다 먼저 문제를 인정하고, 이전 후보 반복·조건 누락을 바로잡아 다시 제안하라."
)


def _form_context_block(form_state: dict) -> str:
    """폼 상태를 시스템 프롬프트 뒤에 붙이는 컨텍스트 블록."""
    filled = {k: v for k, v in form_state.items() if v not in (None, "", [], 0)}
    if not filled:
        return "\n\n현재 사용자 폼은 비어 있다."
    return "\n\n현재 사용자가 채운 폼 상태 (참고용):\n" + json.dumps(
        filled, ensure_ascii=False, indent=2
    )


# ─── 대화 실행 ───

@dataclass(frozen=True)
class HarubanMessage:
    role: str                                        # user | assistant | tool
    content: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    tool_call_id: str = ""
    name: str = ""


@dataclass(frozen=True)
class HarubanTurn:
    """하루방 한 턴 결과. 최종 사용자 노출 텍스트 + 반영 제안(있으면)."""
    available: bool
    reply_text: str = ""
    form_suggestion: dict | None = None              # suggest_form_update args (있을 때만)
    tool_trace: list[dict] = field(default_factory=list)  # 디버깅용
    reason: str = ""
    answer_contract: dict = field(default_factory=dict)


def chat_turn(
    messages_in: list[dict],
    form_state: dict,
    *,
    max_iterations: int = 3,
) -> HarubanTurn:
    """대화 한 턴. LLM이 도구 호출을 원하면 자동 실행 후 다음 회차로 넘어간다.

    messages_in: [{role, content, tool_calls?, tool_call_id?, name?}, ...]
                 role=system은 포함하지 않는다 (여기서 자동 추가).
    form_state: 사용자 현재 폼 상태 (regions, days, companion, purpose, moments 등).

    llm.complete_with_tools는 단일 system/user만 받아서, 여기서는 openai 클라이언트를
    직접 사용해 conv 배열 통째로 전달하고 도구 실행 루프를 돌린다. 모델·키 규칙은 유지.
    """
    general_reply = _try_general_question_answer(messages_in)
    if general_reply:
        return HarubanTurn(
            available=True,
            reply_text=general_reply,
            reason="general question template",
            answer_contract=_general_question_contract(),
        )

    if _should_answer_without_search(messages_in):
        last_user = next(
            (m.get("content") or "" for m in reversed(messages_in) if m.get("role") == "user"),
            "",
        )
        if llm.is_available():
            system = (
                "너는 하루방 에이전트다. 사용자의 제주 여행 계획 상담에 답한다. "
                "이 경로에서는 도구 검색 없이 gpt-5-mini의 일반 추론으로 답하되, "
                "구체적인 장소명·주소·영업시간·수치처럼 사실 확인이 필요한 정보는 지어내지 않는다. "
                "장소 추천이 필요하면 지역과 순간을 선택하면 공공데이터 기준으로 좁혀드리겠다고 안내한다. "
                "답변은 한국어 존댓말 3~5문장으로, 바로 실행할 수 있는 계획 방식 중심으로 말한다."
            )
            resp = llm.complete(
                system=system + _form_context_block(form_state),
                user=_free_advice_user_text(messages_in),
                max_completion_tokens=500,
                temperature=0.7,
            )
            if resp.available and resp.text:
                return HarubanTurn(available=True, reply_text=resp.text)
        return HarubanTurn(
            available=True,
            reply_text=_template_free_advice(last_user),
            reason="free advice template fallback",
        )

    system_prompt = _BASE_SYSTEM_PROMPT + _form_context_block(form_state)
    search_pool = _build_search_pool_context(messages_in, form_state)

    conv: list[dict] = [{"role": "system", "content": system_prompt}]
    if search_pool:
        conv.append({"role": "system", "content": _format_search_pool_context(search_pool)})
    for m in messages_in:
        role = m.get("role")
        if role == "user":
            conv.append({"role": "user", "content": m.get("content") or ""})
        elif role == "assistant":
            item: dict = {"role": "assistant", "content": m.get("content") or ""}
            if m.get("tool_calls"):
                item["tool_calls"] = m["tool_calls"]
            conv.append(item)
        elif role == "tool":
            conv.append({
                "role": "tool",
                "tool_call_id": m.get("tool_call_id", ""),
                "name": m.get("name", ""),
                "content": m.get("content") or "",
            })

    trace = []
    if search_pool:
        trace.append({
            "tool": f"preload:{search_pool.get('tool')}",
            "args": search_pool.get("args") or {},
            "result_size": len(json.dumps(search_pool.get("result") or {}, ensure_ascii=False)),
        })

    if not llm.is_available():
        if search_pool:
            return HarubanTurn(
                available=True,
                reply_text=_fallback_reply_from_tool_messages(conv),
                tool_trace=trace,
                reason="OPENAI_API_KEY not set; used search pool fallback",
                answer_contract=search_pool.get("contract") or {},
            )
        return HarubanTurn(available=False, reason="OPENAI_API_KEY not set", tool_trace=trace)

    return _chat_turn_raw(
        conv,
        trace,
        max_iterations,
        form_state,
        answer_contract=(search_pool.get("contract") if search_pool else None),
    )


def _chat_turn_raw(
    conv: list[dict],
    trace: list[dict],
    max_iterations: int,
    form_state: dict | None = None,
    answer_contract: dict | None = None,
) -> HarubanTurn:
    """openai client를 직접 사용해 conv 배열 통째 전달 + tool 실행 루프."""
    import os
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return HarubanTurn(available=False, reason="OPENAI_API_KEY not set")

    try:
        from openai import OpenAI
    except Exception as e:
        return HarubanTurn(available=False, reason=f"openai import failed: {e}")

    client = OpenAI(api_key=key)
    form_suggestion: dict | None = None

    for it in range(max_iterations):
        try:
            resp = client.chat.completions.create(
                model=llm.MODEL,
                messages=conv,
                tools=TOOLS,
                tool_choice="auto",
                max_completion_tokens=600,
            )
        except Exception as e:
            return HarubanTurn(available=False, reason=f"openai call failed: {e}", tool_trace=trace)

        choice = resp.choices[0] if resp.choices else None
        if not choice:
            return HarubanTurn(available=False, reason="no choice returned", tool_trace=trace)
        msg = choice.message
        tool_calls = getattr(msg, "tool_calls", None) or []
        text_reply = (msg.content or "").strip()

        if not tool_calls:
            # 최종 응답. 반환.
            if not text_reply or _should_replace_low_value_reply(text_reply, conv):
                text_reply = _fallback_reply_from_tool_messages(conv)
            return HarubanTurn(
                available=True,
                reply_text=text_reply,
                form_suggestion=form_suggestion,
                tool_trace=trace,
                answer_contract=answer_contract or {},
            )

        # 도구 호출들을 실제로 실행하고 tool role 메시지 추가.
        conv.append({
            "role": "assistant",
            "content": text_reply,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            args = _prepare_tool_args(name, args, conv, form_state or {})

            runner = TOOL_RUNNERS.get(name)
            if runner is None:
                result = {"error": f"unknown tool: {name}"}
            else:
                try:
                    result = runner(args)
                except Exception as e:
                    result = {"error": f"{type(e).__name__}: {e}"}

            trace.append({"tool": name, "args": args, "result_size": len(json.dumps(result, ensure_ascii=False))})

            # suggest_form_update는 별도 추적 (프론트에 그대로 넘긴다).
            if name == "suggest_form_update" and isinstance(result, dict):
                form_suggestion = result.get("suggestion")

            conv.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            })

    # 반복 상한 도달. 마지막 assistant 메시지 있으면 그것을 반환.
    last_assistant = next(
        (m for m in reversed(conv) if m.get("role") == "assistant" and m.get("content")),
        None,
    )
    return HarubanTurn(
        available=True,
        reply_text=(last_assistant.get("content") if last_assistant else "") or _fallback_reply_from_tool_messages(conv),
        form_suggestion=form_suggestion,
        tool_trace=trace,
        reason=f"max iterations ({max_iterations}) reached",
        answer_contract=answer_contract or {},
    )


# ─── 하루방 인사 (임계 도달 시 자동 팝업) ───────────────────────────
#
# 목적: 사용자가 폼에서 지역+순간을 하나 이상 채우면 하루방이 스스로 인사하며
#       "이 조합에서 저희 데이터로 확인된 곳" 하이라이트 카드를 첫 봇 메시지로 준다.
#
# 흐름 (결정적):
#   1) 폼 → PackRequest → build_filters
#   2) 각 moment별 search_strict → badge_item
#   3) 하이라이트 후보 선정 (규칙 기반: verified 우선, region×moment 다양성)
#   4) coverage_matrix에서 items=0인 조합 → gaps 나열
#   5) LLM 있으면 greeting + 각 하이라이트 reason(한 줄) 조립
#      없으면 템플릿 폴백
#
# 사실은 절대 LLM이 만들지 않는다: 이름·주소·배지는 DB 조회값 그대로.
# LLM은 greeting 문구와 "왜 이 곳인지" 한 줄만 채운다.


@dataclass(frozen=True)
class HarubanIntro:
    available: bool
    greeting: str = ""
    highlights: list[dict] = field(default_factory=list)   # place 카드
    coverage: dict = field(default_factory=dict)           # verified/caution/gap 카운트
    gaps: list[dict] = field(default_factory=list)         # (region × moment) items=0 조합
    llm_used: bool = False
    reason: str = ""


def build_intro(form_state: dict, *, max_highlights: int = 6) -> HarubanIntro:
    """폼 상태 → 하이라이트 카드 + 인사 문구.

    LLM은 greeting과 각 place의 reason 한 줄만. 이름/주소/배지는 DB 조회값 그대로.
    LLM 미가용 시 템플릿 greeting + reason 생략 (배지·주소는 정상 노출).
    """
    # 1) 폼 검증. 임계 미달(regions/moments 비어 있음) 등은 available=False.
    try:
        req = filters_mod.PackRequest.from_dict(form_state)
    except (ValueError, KeyError) as e:
        return HarubanIntro(available=False, reason=f"form invalid: {type(e).__name__}: {e}")

    if not req.moments:
        return HarubanIntro(available=False, reason="no moments selected")

    try:
        bundle = filters_mod.build_filters(req)
    except (
        filters_mod.UnknownRegion, filters_mod.UnknownMoment,
        filters_mod.UnknownCompanion, filters_mod.UnknownPurpose,
        ValueError,
    ) as e:
        return HarubanIntro(available=False, reason=f"filters invalid: {type(e).__name__}: {e}")

    # 2) 각 moment의 items 수집 (badge 판정 포함)
    now = datetime.now(timezone.utc)
    per_moment: dict[str, list[trust_mod.BadgedItem]] = {}
    # 검색 limit은 하이라이트 6 + 여유. moment별 6이면 4*6=24 hit, 감당 가능.
    per_moment_hits: dict[str, list] = {}
    for mf in bundle.per_moment:
        hits = search_mod.search_strict(mf, limit=max_highlights)
        per_moment_hits[mf.moment] = hits
        per_moment[mf.moment] = [trust_mod.badge_item(h, mf, now=now) for h in hits]

    # 3) 하이라이트 선정 (verified 우선, (region, moment) 다양성)
    highlights = _pick_highlights(per_moment, per_moment_hits, req, max_count=max_highlights)

    # 4) coverage 매트릭스 & gaps
    coverage_matrix = _compute_coverage_matrix(per_moment, req)
    gaps = _compute_gaps(coverage_matrix, req)
    coverage = _compute_coverage_summary(per_moment, gaps)

    # 5) LLM 조립 (greeting + reasons)
    greeting = ""
    reasons_by_id: dict[str, str] = {}
    llm_used = False
    llm_reason = ""

    if llm.is_available():
        greeting, reasons_by_id, llm_used, llm_reason = _llm_compose(req, highlights, gaps)

    if not llm_used or not greeting:
        greeting = _template_greeting(req, highlights, gaps, coverage)

    # 6) reason 병합 (LLM이 준 것만)
    for h in highlights:
        r = reasons_by_id.get(h["external_id"])
        if r:
            h["reason"] = r

    return HarubanIntro(
        available=True,
        greeting=greeting,
        highlights=highlights,
        coverage=coverage,
        gaps=gaps,
        llm_used=llm_used,
        reason=llm_reason,
    )


def _pick_highlights(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    per_moment_hits: dict[str, list],
    req: filters_mod.PackRequest,
    *,
    max_count: int,
) -> list[dict]:
    """규칙 기반 하이라이트 선정.

    규칙:
      - (region × moment) 조합에서 하나씩 뽑아 다양성 확보 (라운드 로빈)
      - 각 조합 안에서는 verified > caution 순
      - contradicted / tombstoned는 이미 search_strict에서 배제됨
      - 결과가 max_count 미달이면 나머지 슬롯은 남은 verified/caution로 채움
    """
    # (region, moment) → 배지 순 정렬된 후보 리스트
    buckets: dict[tuple[str, str], list[dict]] = {}
    for moment, items in per_moment.items():
        hits = per_moment_hits.get(moment, [])
        for i, it in enumerate(items):
            region = it.region_normalized or (hits[i].region_normalized if i < len(hits) else "")
            hit = hits[i] if i < len(hits) else None
            entry = {
                "external_id": it.external_id,
                "name": it.name,
                "region": region,
                "region_label": REGION_LABEL_KO.get(region, region),
                "moment": moment,
                "moment_label": MOMENT_LABEL_KO.get(moment, moment),
                "address": (hit.address if hit else None),
                "badge": it.badge,
                "note": it.note,
                "sources": it.sources,
                "transit": it.transit,
                # 상세 확장용 (근거 있는 값만; 결측은 그대로 넘겨 프론트가 '미확인' 표기)
                "category": it.category,
                "amenities": it.amenities,
                "hygiene_grade": it.hygiene_grade,
                "freshness": it.freshness,
                "reason": None,   # LLM이 채움. 없으면 None.
            }
            buckets.setdefault((region, moment), []).append(entry)

    for key in buckets:
        buckets[key].sort(key=lambda e: (0 if e["badge"] == "verified" else 1))

    # 라운드 로빈: 선택된 (region, moment) 조합을 반복 순회하며 하나씩 뽑음.
    combos = [
        (r, m)
        for r in req.regions
        for m in req.moments
        if (r, m) in buckets and buckets[(r, m)]
    ]
    chosen: list[dict] = []
    while combos and len(chosen) < max_count:
        next_round: list[tuple[str, str]] = []
        for key in combos:
            if buckets[key]:
                chosen.append(buckets[key].pop(0))
                if len(chosen) >= max_count:
                    break
                if buckets[key]:
                    next_round.append(key)
        combos = next_round

    return chosen


def _compute_coverage_matrix(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    req: filters_mod.PackRequest,
) -> dict[tuple[str, str], int]:
    """선택된 (region × moment) 조합별 verified+caution 카운트."""
    matrix: dict[tuple[str, str], int] = {}
    for r in req.regions:
        for m in req.moments:
            items = per_moment.get(m, [])
            n = sum(1 for it in items if (it.region_normalized or "") == r)
            matrix[(r, m)] = n
    return matrix


def _compute_gaps(
    matrix: dict[tuple[str, str], int],
    req: filters_mod.PackRequest,
) -> list[dict]:
    """items=0인 조합을 데이터 부족 안내와 함께 나열."""
    gaps: list[dict] = []
    for (r, m), n in matrix.items():
        if n == 0:
            gaps.append({
                "region": r,
                "region_label": REGION_LABEL_KO.get(r, r),
                "moment": m,
                "moment_label": MOMENT_LABEL_KO.get(m, m),
                "note": (
                    f"{REGION_LABEL_KO.get(r, r)}에서 {MOMENT_LABEL_KO.get(m, m)}은(는) "
                    "저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다."
                ),
            })
    return gaps


def _compute_coverage_summary(
    per_moment: dict[str, list[trust_mod.BadgedItem]],
    gaps: list[dict],
) -> dict:
    verified = 0
    caution = 0
    for items in per_moment.values():
        for it in items:
            if it.badge == "verified":
                verified += 1
            elif it.badge == "caution":
                caution += 1
    total = verified + caution
    return {
        "verified": verified,
        "caution": caution,
        "total": total,
        "gap_combos": len(gaps),
    }


def _template_greeting(
    req: filters_mod.PackRequest,
    highlights: list[dict],
    gaps: list[dict],
    coverage: dict,
) -> str:
    """LLM 없어도 항상 나오는 안전 문구.

    형식: "{동행자}와 {지역} {목적}이시라구요? 저희 데이터로 확인된 곳 N곳 보여드릴게요."
    조합에 빈 것이 있으면 두 번째 문장으로 데이터 부족 범위를 덧붙임.
    """
    companion_ko = COMPANION_LABEL_KO.get(req.companion, "")
    purpose_ko = PURPOSE_LABEL_KO.get(req.purpose, "")
    regions_ko = ", ".join(REGION_LABEL_KO.get(r, r) for r in req.regions)

    head = ""
    if companion_ko and purpose_ko:
        head = f"{regions_ko}에서 {companion_ko} {purpose_ko} 여행이시라구요? "
    elif regions_ko:
        head = f"{regions_ko} 여행이시라구요? "

    if highlights:
        body = f"저희 공공데이터로 확인된 {len(highlights)}곳을 먼저 보여드릴게요."
    else:
        body = "이 조합에서 저희 데이터로 확인된 곳이 아직 없어요."

    tail = ""
    if gaps:
        tail = f" (데이터가 부족한 조합 {len(gaps)}개는 아래에 따로 묶어둘게요.)"

    return (head + body + tail).strip()


def _llm_compose(
    req: filters_mod.PackRequest,
    highlights: list[dict],
    gaps: list[dict],
) -> tuple[str, dict[str, str], bool, str]:
    """LLM에 greeting + reason 한 줄씩 요청.

    반환: (greeting_text, reasons_by_external_id, llm_used, reason)
    실패/키 없음 시 (있는 그대로 반환) — 호출부가 폴백.
    """
    # LLM 호출 시 사실 그대로 지어내지 않도록: 후보 리스트를 JSON으로 넘기고
    # 오직 이 external_id 목록에 한해 reason을 매기라고 지시.
    payload = {
        "user": {
            "regions": [REGION_LABEL_KO.get(r, r) for r in req.regions],
            "companion": COMPANION_LABEL_KO.get(req.companion, req.companion),
            "purpose": PURPOSE_LABEL_KO.get(req.purpose, req.purpose),
            "moments": [MOMENT_LABEL_KO.get(m, m) for m in req.moments],
        },
        "candidates": [
            {
                "external_id": h["external_id"],
                "name": h["name"],
                "region": h["region_label"],
                "moment": h["moment_label"],
                "badge": h["badge"],
                "note": h["note"],
            }
            for h in highlights
        ],
        "gaps": [
            {"region": g["region_label"], "moment": g["moment_label"]}
            for g in gaps
        ],
    }

    system = (
        "너는 '하루방 에이전트'이다. 제주 여행 신뢰 기반 에이전트 캐릭터.\n"
        "말투: 부드러운 존댓말, 짧고 따뜻하게, 이모지 없이.\n\n"
        "역할: 사용자가 폼에서 지역·순간을 방금 골랐다. "
        "저희 데이터로 확인된 후보들과 확인되지 않은 조합이 아래 JSON에 있다. "
        "이걸 바탕으로 (1) 짧은 인사 한두 문장과 (2) 각 후보의 '이 곳을 왜 보여드리는지' 한 줄을 만들어라.\n\n"
        "절대 규칙:\n"
        "- candidates에 없는 장소·주소·운영시간·수치를 지어내지 마라.\n"
        "- '가장 좋은 곳' 같은 단정 대신 '저희 데이터로 확인된 곳' 톤을 유지하라.\n"
        "- 확인되지 않은 조합(gaps)은 인사에서 데이터 부족 범위로 언급하되 '없다'고 단언하지 마라.\n"
        "- reasons는 반드시 candidates의 external_id를 key로 써라. 다른 id를 지어내지 마라.\n\n"
        "출력 형식은 아래 JSON 스키마 그대로:\n"
        '{\n'
        '  "greeting": "한 두 문장",\n'
        '  "reasons": { "<external_id>": "한 줄 이유", ... }\n'
        '}'
    )

    user = "다음 JSON에 근거해서만 답하라:\n" + json.dumps(payload, ensure_ascii=False, indent=2)

    resp = llm.complete(system=system, user=user, max_completion_tokens=700, temperature=0.3)
    if not resp.available:
        return "", {}, False, resp.reason

    text_out = resp.text.strip()
    # 코드펜스 제거 (LLM이 ```json ...``` 감쌀 때)
    if text_out.startswith("```"):
        text_out = text_out.strip("`")
        # ```json\n{...}\n``` 형태
        if text_out.startswith("json"):
            text_out = text_out[4:]
        text_out = text_out.strip()

    try:
        parsed = json.loads(text_out)
    except json.JSONDecodeError as e:
        return "", {}, False, f"json decode failed: {e}"

    greeting = str(parsed.get("greeting") or "").strip()
    reasons_raw = parsed.get("reasons") or {}

    # candidates에 없는 id는 조용히 버림 (사실 생성 방지 게이트).
    valid_ids = {h["external_id"] for h in highlights}
    reasons: dict[str, str] = {}
    if isinstance(reasons_raw, dict):
        for k, v in reasons_raw.items():
            if k in valid_ids and isinstance(v, str) and v.strip():
                reasons[k] = v.strip()

    return greeting, reasons, True, ""
