"""비짓제주 API 수집기.

모드:
  --probe      : 1페이지 원본 덤프 + 필드명 리포트 (Day1 확정)
  --fetch-all  : 전 페이지 순회 → raw_source UPSERT + tombstone (Day2)

DATA_PIPELINE.md §3 규칙:
  1. checksum 비교로 신규 INSERT / 변경 UPDATE / 동일 skip
  2. 이번 실행에 미등장 external_id → tombstoned=true (즉시 삭제 금지)
  3. 멱등성: 연속 2회 실행 시 두 번째는 updated=0, inserted=0
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterator

import httpx
from sqlalchemy import text

from apps.api import db

VISITJEJU_BASE = "https://api.visitjeju.net/vsjApi/contents/searchList"
DEFAULT_LOCALE = "kr"
DEFAULT_PAGE = 1
DEFAULT_TIMEOUT_S = 15.0
INTER_PAGE_SLEEP_S = 0.2  # 폴리트니스 / 레이트리밋 회피

SOURCE_VISITJEJU = "visitjeju"

ITEM_LIST_CANDIDATE_PATHS: tuple[tuple[str, ...], ...] = (
    ("items",),
    ("result", "items"),
    ("body", "items"),
    ("response", "body", "items"),
)


def _dig(data: Any, path: tuple[str, ...]) -> Any:
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def find_items(payload: Any) -> tuple[list[Any] | None, tuple[str, ...] | None]:
    for path in ITEM_LIST_CANDIDATE_PATHS:
        candidate = _dig(payload, path)
        if isinstance(candidate, list):
            return candidate, path
    return None, None


def probe_field_names(items: list[Any]) -> list[str]:
    keys: set[str] = set()
    for item in items:
        if isinstance(item, dict):
            keys.update(item.keys())
    return sorted(keys)


def fetch_page(*, api_key: str, page: int, locale: str, timeout_s: float) -> dict:
    params = {"apiKey": api_key, "locale": locale, "page": page}
    with httpx.Client(timeout=timeout_s) as client:
        resp = client.get(VISITJEJU_BASE, params=params)
        resp.raise_for_status()
        return resp.json()


def compute_checksum(item: dict) -> str:
    canonical = json.dumps(item, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---- probe ----

def run_probe(*, out_dir: Path, api_key: str, page: int, locale: str) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = fetch_page(
        api_key=api_key, page=page, locale=locale, timeout_s=DEFAULT_TIMEOUT_S,
    )

    raw_path = out_dir / f"visitjeju_probe_page{page}_{locale}.json"
    raw_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8",
    )

    items, path = find_items(payload)
    report: dict[str, Any] = {
        "top_level_keys": sorted(payload.keys()) if isinstance(payload, dict) else None,
        "items_path": list(path) if path else None,
        "item_count": len(items) if items else 0,
        "field_names": probe_field_names(items) if items else [],
        "sample_item": items[0] if items else None,
    }
    report_path = out_dir / f"visitjeju_probe_page{page}_{locale}.report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8",
    )

    print(f"[probe] raw dumped   -> {raw_path}")
    print(f"[probe] report saved -> {report_path}")
    if not items:
        print(
            "[probe] items 배열을 자동 탐색으로 찾지 못했습니다.",
            file=sys.stderr,
        )
        return 2
    print(f"[probe] items path   = {'.'.join(path) if path else '?'}")
    print(f"[probe] item count   = {len(items)}")
    print(f"[probe] field names  = {', '.join(report['field_names'])}")
    return 0


# ---- fetch-all ----

def iter_all_items(
    *, api_key: str, locale: str, max_pages: int | None = None,
) -> Iterator[tuple[int, int, list[dict]]]:
    """(current_page, page_count, items) 튜플을 페이지마다 yield."""
    page = 1
    while True:
        payload = fetch_page(
            api_key=api_key, page=page, locale=locale, timeout_s=DEFAULT_TIMEOUT_S,
        )
        items, _ = find_items(payload)
        page_count = int(payload.get("pageCount") or 0)
        if not items:
            return
        yield page, page_count, items
        if max_pages is not None and page >= max_pages:
            return
        if page_count and page >= page_count:
            return
        page += 1
        time.sleep(INTER_PAGE_SLEEP_S)


def _extract_external_id(item: dict) -> str | None:
    """visitjeju 아이템의 안정적 식별자. contentsid가 정답이지만 방어적으로 탐색."""
    for key in ("contentsid", "contentsId", "contents_id"):
        v = item.get(key)
        if isinstance(v, str) and v:
            return v
    return None


def upsert_items(items: list[dict], *, source: str = SOURCE_VISITJEJU) -> tuple[int, int, int]:
    """items를 raw_source에 UPSERT. (inserted, updated, skipped_no_id) 반환."""
    inserted = 0
    updated = 0
    skipped = 0

    stmt = text(
        """
        INSERT INTO raw_source (source, external_id, payload, checksum, tombstoned, fetched_at)
        VALUES (:source, :external_id, CAST(:payload AS jsonb), :checksum, false, now())
        ON CONFLICT (source, external_id) DO UPDATE
          SET payload = EXCLUDED.payload,
              checksum = EXCLUDED.checksum,
              tombstoned = false,
              fetched_at = EXCLUDED.fetched_at
          WHERE raw_source.checksum IS DISTINCT FROM EXCLUDED.checksum
        RETURNING (xmax = 0) AS was_insert
        """
    )

    engine = db.get_engine()
    with engine.begin() as conn:
        for item in items:
            ext_id = _extract_external_id(item)
            if not ext_id:
                skipped += 1
                continue
            checksum = compute_checksum(item)
            result = conn.execute(
                stmt,
                {
                    "source": source,
                    "external_id": ext_id,
                    "payload": json.dumps(item, ensure_ascii=False),
                    "checksum": checksum,
                },
            ).first()
            if result is None:
                # checksum 동일 → 변경 없음
                continue
            if result.was_insert:
                inserted += 1
            else:
                updated += 1
    return inserted, updated, skipped


def tombstone_missing(seen_ids: set[str], *, source: str = SOURCE_VISITJEJU) -> int:
    """이번 실행에서 못 만난 external_id를 tombstoned=true로. 반환: 표시된 행 수."""
    if not seen_ids:
        return 0
    engine = db.get_engine()
    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE raw_source
                   SET tombstoned = true
                 WHERE source = :source
                   AND tombstoned = false
                   AND external_id <> ALL(:seen)
                """
            ),
            {"source": source, "seen": list(seen_ids)},
        )
        return result.rowcount or 0


def run_fetch_all(*, api_key: str, locale: str, max_pages: int | None) -> int:
    if not db.ping():
        print("DB 연결 실패. docker compose up -d db 로 기동 후 재시도하세요.", file=sys.stderr)
        return 3

    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    seen_ids: set[str] = set()

    for cur, total, items in iter_all_items(
        api_key=api_key, locale=locale, max_pages=max_pages,
    ):
        inserted, updated, skipped = upsert_items(items)
        total_inserted += inserted
        total_updated += updated
        total_skipped += skipped
        for it in items:
            eid = _extract_external_id(it)
            if eid:
                seen_ids.add(eid)
        print(
            f"[fetch] page {cur}/{total or '?'} "
            f"items={len(items)} +ins={inserted} ~upd={updated} skip={skipped}",
        )

    tombstoned = tombstone_missing(seen_ids)
    print(
        f"[fetch] done. seen={len(seen_ids)} "
        f"inserted={total_inserted} updated={total_updated} "
        f"skipped_no_id={total_skipped} tombstoned={tombstoned}",
    )
    return 0


# ---- CLI ----

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="비짓제주 수집.")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--probe", action="store_true", help="1페이지 원본 덤프 + 필드명 리포트")
    mode.add_argument(
        "--fetch-all", dest="fetch_all", action="store_true",
        help="전 페이지 순회 → raw_source UPSERT + tombstone",
    )
    p.add_argument("--page", type=int, default=DEFAULT_PAGE, help="(--probe) 대상 페이지")
    p.add_argument("--locale", default=DEFAULT_LOCALE)
    p.add_argument("--max-pages", type=int, default=None, help="(--fetch-all) 상한 (테스트/디버깅용)")
    p.add_argument(
        "--out-dir", default="data/probe",
        help="(--probe) raw 덤프와 리포트를 쓸 디렉토리",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)

    if not args.probe and not args.fetch_all:
        print("모드가 필요합니다: --probe 또는 --fetch-all", file=sys.stderr)
        return 64

    api_key = os.environ.get("VISITJEJU_API_KEY", "").strip()
    if not api_key:
        print("환경변수 VISITJEJU_API_KEY 가 필요합니다 (.env 또는 환경변수).", file=sys.stderr)
        return 2

    if args.probe:
        return run_probe(
            out_dir=Path(args.out_dir), api_key=api_key,
            page=args.page, locale=args.locale,
        )
    return run_fetch_all(
        api_key=api_key, locale=args.locale, max_pages=args.max_pages,
    )


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
