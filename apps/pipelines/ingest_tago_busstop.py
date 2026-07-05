"""TAGO 국토교통부 버스정류소정보 API → transit_point (kind='busstop').

DATA_PIPELINE.md §1 S4: 정류장 위치.
소스: https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnNoList
파라미터: cityCode=39 (제주도), _type=json.
응답 필드: gpslati(위도), gpslong(경도), nodeid, nodenm.

정직함:
  - transit_point는 UNIQUE 제약이 없어 UPSERT 불가 → kind='busstop' 완전 교체(DELETE+INSERT).
  - 좌표가 제주 bbox 밖이거나 결측이면 skip (관측용 카운트만).
  - TAGO_BUS_API_KEY 환경변수 필수. CLAUDE.md 절대 규칙 6: 키 없으면 즉시 종료(임의 시드 없음).

사용:
  python -m apps.pipelines.ingest_tago_busstop
  python -m apps.pipelines.ingest_tago_busstop --dry-run  # DB 미기록, 카운트만
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import httpx
from sqlalchemy import text

from apps.api import db

TAGO_BASE = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService"
JEJU_CITY_CODE = 39
PAGE_SIZE = 500                # 서버 상한이 어디까지인지 불명확 → 500이면 9페이지
INTER_PAGE_SLEEP_S = 0.4
TIMEOUT_S = 30.0


def _in_jeju_bbox(lat: float, lng: float) -> bool:
    return 33.1 <= lat <= 33.6 and 126.1 <= lng <= 127.0


def fetch_page(*, api_key: str, page: int) -> dict:
    r = httpx.get(
        f"{TAGO_BASE}/getSttnNoList",
        params={
            "serviceKey": api_key,
            "_type": "json",
            "cityCode": JEJU_CITY_CODE,
            "pageNo": page,
            "numOfRows": PAGE_SIZE,
        },
        timeout=TIMEOUT_S,
    )
    r.raise_for_status()
    return r.json()


def iter_all_stops(api_key: str) -> tuple[list[dict], int, int]:
    """모든 정류소 순회. 반환: (row 리스트, 총 API 반환건수, bbox 밖 skip 카운트)."""
    rows: list[dict] = []
    skipped = 0
    total_api = 0

    page = 1
    while True:
        payload = fetch_page(api_key=api_key, page=page)
        body = payload.get("response", {}).get("body", {})
        items_wrap = body.get("items")
        # 결과 없음 케이스: items가 빈 문자열이거나 dict가 아닐 수 있음
        if not items_wrap or not isinstance(items_wrap, dict):
            break
        raw = items_wrap.get("item")
        if raw is None:
            break
        items = raw if isinstance(raw, list) else [raw]
        total_api += len(items)
        for it in items:
            try:
                lat = float(it.get("gpslati"))
                lng = float(it.get("gpslong"))
            except (TypeError, ValueError):
                skipped += 1
                continue
            if not _in_jeju_bbox(lat, lng):
                skipped += 1
                continue
            rows.append({
                "kind": "busstop",
                "name": it.get("nodenm") or "",
                "lat": lat,
                "lng": lng,
                "capacity": None,
            })

        total_count = int(body.get("totalCount") or 0)
        if page * PAGE_SIZE >= total_count:
            break
        page += 1
        time.sleep(INTER_PAGE_SLEEP_S)

    return rows, total_api, skipped


def upsert_busstops(rows: list[dict]) -> None:
    """kind='busstop' 완전 교체."""
    engine = db.get_engine()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM transit_point WHERE kind='busstop'"))
        if rows:
            conn.execute(
                text(
                    "INSERT INTO transit_point (kind, name, lat, lng, capacity) "
                    "VALUES (:kind, :name, :lat, :lng, :capacity)"
                ),
                rows,
            )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="TAGO 버스정류소정보 → transit_point")
    p.add_argument("--dry-run", action="store_true", help="DB 기록 없이 카운트만")
    args = p.parse_args(argv)

    api_key = os.environ.get("TAGO_BUS_API_KEY", "").strip()
    if not api_key:
        print("환경변수 TAGO_BUS_API_KEY 가 필요합니다 (.env 또는 환경변수).", file=sys.stderr)
        return 2

    rows, total_api, skipped = iter_all_stops(api_key)
    print(f"[tago-busstop] api_items={total_api}  ingest={len(rows)}  skipped_no_coord_or_out_of_bbox={skipped}")

    if args.dry_run:
        print("[tago-busstop] dry-run: DB 미기록")
        return 0

    upsert_busstops(rows)
    print(f"[tago-busstop] DB upserted (kind='busstop'): {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
