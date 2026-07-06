"""제주 ITS OPEN API (infoTourList) → place 이미지·태그·소개 병합.

원 데이터 소스는 여전히 비짓제주 (api.cdn.visitjeju.net CDN 사용)이나,
제주 ITS 게이트웨이가 img_path/thumbnail_path/tag/introduction 4개 필드를
함께 제공한다. contents_id가 우리 place.external_id(CNTS_*)와 완전 동일
형식이라 100% 정확 매핑 가능 — 잘못된 이미지 부착 위험 0.

원칙 (CLAUDE.md):
  - 규칙 1: 이미지 URL·태그·소개 모두 공공데이터 사실. LLM 생성 아님.
  - 규칙 6: 승인키 없으면 조용히 종료 (데모 안전판). place는 그대로 유지.

사용:
    export JEJU_ITS_API_KEY=<승인키>
    python -m apps.pipelines.ingest_jejuits
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import text

from apps.api import db

API_URL = "http://api.jejuits.go.kr/api/infoTourList"


def _api_key() -> str | None:
    key = os.environ.get("JEJU_ITS_API_KEY", "").strip()
    return key or None


@dataclass(frozen=True)
class Enrichment:
    external_id: str
    thumbnail_path: str | None
    img_path: str | None
    tag: str | None
    introduction: str | None


def fetch_all(*, timeout: float = 30.0) -> list[dict]:
    """제주 ITS API 호출 → Info 배열 반환. 승인키 없으면 빈 리스트."""
    key = _api_key()
    if key is None:
        print("[jejuits] JEJU_ITS_API_KEY not set — skip", file=sys.stderr)
        return []

    resp = httpx.get(API_URL, params={"code": key}, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    if data.get("result") != "success":
        print(f"[jejuits] non-success result: {data.get('result')}", file=sys.stderr)
        return []
    # 문서 표기는 'Info'지만 실제 응답은 소문자 'info'. 양쪽 다 방어적으로 탐색.
    items = data.get("info") or data.get("Info") or []
    if not isinstance(items, list):
        return []
    return items


def to_enrichments(items: list[dict]) -> list[Enrichment]:
    """API 응답 → Enrichment 리스트. contents_id 없거나 빈 항목은 스킵."""
    out: list[Enrichment] = []
    for it in items:
        ext_id = it.get("contents_id")
        if not isinstance(ext_id, str) or not ext_id.strip():
            continue
        out.append(Enrichment(
            external_id=ext_id.strip(),
            thumbnail_path=_str_or_none(it.get("thumbnail_path")),
            img_path=_str_or_none(it.get("img_path")),
            tag=_str_or_none(it.get("tag")),
            introduction=_str_or_none(it.get("introduction")),
        ))
    return out


def _str_or_none(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    s = v.strip()
    return s if s else None


UPDATE_SQL = text(
    """
    UPDATE place
       SET amenities = COALESCE(amenities, '{}'::jsonb) || CAST(:patch AS jsonb),
           updated_at = now()
     WHERE external_id = :external_id
    """
)


def merge_into_place(rows: list[Enrichment]) -> tuple[int, int]:
    """(matched, applied) 반환. 매칭되면 amenities에 4개 필드 병합.

    Postgres의 JSONB '||' 연산으로 부분 병합 (기존 phone 등 유지).
    """
    if not rows:
        return 0, 0

    matched = 0
    applied = 0
    engine = db.get_engine()
    with engine.begin() as conn:
        for r in rows:
            # 대상 place 존재 확인
            hit = conn.execute(
                text("SELECT 1 FROM place WHERE external_id = :ext"),
                {"ext": r.external_id},
            ).first()
            if hit is None:
                continue
            matched += 1

            patch: dict = {}
            if r.thumbnail_path:
                patch["thumbnail_path"] = r.thumbnail_path
            if r.img_path:
                patch["img_path"] = r.img_path
            if r.tag:
                patch["tag"] = r.tag
            if r.introduction:
                patch["introduction"] = r.introduction
            if not patch:
                continue

            conn.execute(
                UPDATE_SQL,
                {"patch": json.dumps(patch, ensure_ascii=False),
                 "external_id": r.external_id},
            )
            applied += 1
    return matched, applied


def main() -> int:
    print("[jejuits] fetching…")
    items = fetch_all()
    print(f"[jejuits] fetched {len(items)} items")

    enrichments = to_enrichments(items)
    print(f"[jejuits] valid enrichments: {len(enrichments)}")

    matched, applied = merge_into_place(enrichments)
    print(f"[jejuits] matched to existing place: {matched}")
    print(f"[jejuits] applied UPDATE with new fields: {applied}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
