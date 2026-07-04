"""/verify — 킥1 데모.

입력: 리뷰 텍스트 원문.
출력: 문장별 verdict (verified | outdated | contradicted | coverage_gap) + 근거.

파이프라인 (TRUST_ENGINE §6):
  1. claim 분해: LLM 사용 가능하면 JSON, 아니면 문장 분리 폴백.
  2. claim별 장소명 후보 추출 → pg_trgm 유사도로 place 매칭.
  3. 판정:
     - 매칭 없음                     → coverage_gap ("확인되지 않음", "없다" 금지)
     - 매칭 + tombstoned              → contradicted
     - 매칭 + has_fix_request         → outdated (수정요청 이력)
     - 매칭 + valid_until 경과        → outdated
     - 매칭 + 문제 없음                → verified

원칙:
  - LLM은 claim 분해에만 도움 역할. 사실 판단은 DB만.
  - LLM 실패해도 규칙 기반으로 완주. (CLAUDE.md 절대 규칙 6)
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from apps.api import db
from apps.api.engine import llm

MIN_TRGM_SIMILARITY = 0.3


@dataclass(frozen=True)
class Claim:
    text: str
    place_candidate: str | None  # LLM이 추출한 장소명 힌트 (없으면 문장 전체 자동 스캔)


@dataclass(frozen=True)
class VerifiedClaim:
    text: str
    verdict: str                 # verified | outdated | contradicted | coverage_gap
    matched_name: str | None
    matched_external_id: str | None
    reason: str                  # 사용자 노출 문구
    sources: list[dict]


# ---- claim 분해 ----

_SPLIT_RE = re.compile(r"(?<=[\.\?\!。？！])\s+|\n+")


def split_by_sentence(text_in: str) -> list[str]:
    parts = [p.strip() for p in _SPLIT_RE.split(text_in or "") if p and p.strip()]
    return parts


def decompose_claims_via_llm(text_in: str) -> list[Claim] | None:
    """LLM으로 claim 분해. 실패/미사용 시 None (호출부가 폴백)."""
    if not llm.is_available():
        return None
    system = (
        "리뷰 텍스트에서 사실 주장을 문장 단위로 추출한다. "
        "각 주장에 대해 언급된 장소명이 있으면 place_candidate에 담고, "
        "없으면 null. 지어내지 마라. JSON만 출력한다: "
        '{"claims":[{"text":"...","place_candidate":"..."}]}'
    )
    resp = llm.complete(
        system=system, user=text_in,
        max_completion_tokens=500, temperature=0.0,
    )
    if not resp.available or not resp.text:
        return None
    try:
        data = json.loads(_extract_json(resp.text))
    except Exception:
        return None
    claims_raw = data.get("claims") if isinstance(data, dict) else None
    if not isinstance(claims_raw, list):
        return None
    out: list[Claim] = []
    for c in claims_raw:
        if not isinstance(c, dict):
            continue
        t = str(c.get("text") or "").strip()
        if not t:
            continue
        cand = c.get("place_candidate")
        cand_s = str(cand).strip() if isinstance(cand, str) and cand.strip() else None
        out.append(Claim(text=t, place_candidate=cand_s))
    return out or None


def _extract_json(text_in: str) -> str:
    """모델이 JSON 앞뒤로 문자를 붙였을 때 대괄호/중괄호 첫 열림~마지막 닫힘을 잘라낸다."""
    start = min([i for i in [text_in.find("{"), text_in.find("[")] if i >= 0], default=-1)
    end = max(text_in.rfind("}"), text_in.rfind("]"))
    if start >= 0 and end > start:
        return text_in[start:end + 1]
    return text_in


def decompose_claims(text_in: str) -> list[Claim]:
    llm_claims = decompose_claims_via_llm(text_in)
    if llm_claims:
        return llm_claims
    # 폴백: 문장 분리만. 장소명 힌트는 없음.
    return [Claim(text=s, place_candidate=None) for s in split_by_sentence(text_in)]


# ---- place 매칭 ----

_MATCH_SQL = text(
    """
    SELECT external_id, name, tombstoned, has_fix_request, valid_until, source_url,
           similarity(name, :q) AS sim
      FROM place
     WHERE name % :q                  -- pg_trgm 유사도 인덱스
     ORDER BY sim DESC
     LIMIT 1
    """
)


def _match_place(query: str) -> dict[str, Any] | None:
    if not query or len(query) < 2:
        return None
    try:
        with db.get_engine().connect() as conn:
            row = conn.execute(_MATCH_SQL, {"q": query}).first()
    except Exception:
        return None
    if row is None:
        return None
    if row.sim is None or float(row.sim) < MIN_TRGM_SIMILARITY:
        return None
    return {
        "external_id": row.external_id,
        "name": row.name,
        "tombstoned": bool(row.tombstoned),
        "has_fix_request": bool(row.has_fix_request),
        "valid_until": row.valid_until,
        "source_url": row.source_url,
    }


# 문장에서 장소명 후보를 뽑기 위한 간단 휴리스틱:
# 큰따옴표/작은따옴표 안, 또는 '"...에" / "...에서"' 앞 명사구.
# LLM이 있으면 이 함수는 거의 안 쓰이지만, 폴백에서 유용.
_QUOTE_RE = re.compile(r"[「『\"'‘’“”]([^」』\"'‘’“”]{2,20})")
_PARTICLE_RE = re.compile(r"([\w가-힣]{2,20})(?:에서|에|을|를|이|가|은|는)")


def _guess_place_name(sentence: str) -> str | None:
    m = _QUOTE_RE.search(sentence)
    if m:
        return m.group(1).strip()
    m = _PARTICLE_RE.search(sentence)
    if m:
        return m.group(1).strip()
    return None


# ---- 판정 ----

MSG_VERIFIED     = "공공데이터에서 존재 확인."
MSG_OUTDATED_FIX = "이용자 정보 수정요청 이력이 있어 정보 신선도가 낮습니다."
MSG_OUTDATED_TTL = "정보 유효기간이 지났거나 임박했습니다."
MSG_CONTRADICTED = "폐업/이전이 확인됩니다."
MSG_COVERAGE_GAP = "저희가 참조하는 공공데이터에서 확인되지 않습니다."


def _judge_matched(match: dict[str, Any], *, now: datetime) -> tuple[str, str]:
    if match["tombstoned"]:
        return "contradicted", MSG_CONTRADICTED
    if match["has_fix_request"]:
        return "outdated", MSG_OUTDATED_FIX
    valid_until = match["valid_until"]
    if valid_until is not None:
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_until <= now:
            return "outdated", MSG_OUTDATED_TTL
    return "verified", MSG_VERIFIED


# 문장 안에 실제로 등장하는 place 이름을 SQL로 역탐색.
# trigram 유사도보다 훨씬 정직하고, 지명(제주시 등)이 잘못 잡히는 문제를
# 최소 이름 길이 조건과 REGION_STOPWORDS로 배제할 수 있다.
_SENTENCE_CONTAINS_SQL = text(
    """
    SELECT external_id, name, tombstoned, has_fix_request, valid_until, source_url
      FROM place
     WHERE length(name) >= 3
       AND name <> ALL(:stopwords)
       AND position(name IN :sentence) > 0
     ORDER BY length(name) DESC
     LIMIT 1
    """
)

REGION_STOPWORDS: tuple[str, ...] = (
    "제주시", "서귀포시", "서귀포", "애월", "한림", "성산", "조천",
    "구좌", "안덕", "대정", "표선", "남원", "우도", "한경", "중문",
    "제주도", "제주",
)


def _match_from_sentence(sentence: str) -> dict[str, Any] | None:
    """휴리스틱 실패 시 폴백: 문장 안에 place 이름이 부분 문자열로 존재하는가.

    - length(name) >= 3: '집', '카페' 같은 짧은 이름 오탐 방지.
    - REGION_STOPWORDS: 지명이 잘못 잡히는 문제 배제 (verify는 장소 특정 검증).
    """
    if not sentence:
        return None
    try:
        with db.get_engine().connect() as conn:
            row = conn.execute(
                _SENTENCE_CONTAINS_SQL,
                {"sentence": sentence, "stopwords": list(REGION_STOPWORDS)},
            ).first()
    except Exception:
        return None
    if row is None:
        return None
    return {
        "external_id": row.external_id,
        "name": row.name,
        "tombstoned": bool(row.tombstoned),
        "has_fix_request": bool(row.has_fix_request),
        "valid_until": row.valid_until,
        "source_url": row.source_url,
    }


def verify_text(text_in: str) -> list[VerifiedClaim]:
    now = datetime.now(timezone.utc)
    claims = decompose_claims(text_in)
    results: list[VerifiedClaim] = []
    for c in claims:
        # 정직함 우선: 정확 부분 문자열 매칭을 먼저 시도한다.
        # 얕은 조사-휴리스틱이 카테고리 명사("베이커리","카페")를 먼저 잡아
        # 엉뚱한 place로 verified가 나오는 사고를 차단한다.
        match = _match_from_sentence(c.text)
        if match is None and c.place_candidate:
            match = _match_place(c.place_candidate)
        if match is None:
            query = _guess_place_name(c.text)
            match = _match_place(query) if query else None
        if match is None:
            results.append(VerifiedClaim(
                text=c.text,
                verdict="coverage_gap",
                matched_name=None,
                matched_external_id=None,
                reason=MSG_COVERAGE_GAP,
                sources=[],
            ))
            continue
        verdict, reason = _judge_matched(match, now=now)
        sources = [{"name": "비짓제주", "url": match["source_url"]}] if match["source_url"] else []
        results.append(VerifiedClaim(
            text=c.text,
            verdict=verdict,
            matched_name=match["name"],
            matched_external_id=match["external_id"],
            reason=reason,
            sources=sources,
        ))
    return results
