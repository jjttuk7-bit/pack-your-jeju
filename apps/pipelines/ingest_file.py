"""위생등급 / 주차장 / 정류장 / 수정요청 CSV 적재기.

DATA_PIPELINE.md §3 규칙:
  - S2 위생등급 → place.hygiene_grade UPDATE (contentsid 또는 상호명 매칭)
  - S3 주차장  → transit_point(kind='parking')
  - S4 정류장  → transit_point(kind='busstop')
  - S5 수정요청 → place.has_fix_request UPDATE (contentsid 매칭)

Day3 스코프:
  - S5(has_fix_request)를 먼저 붙인다 — 골든셋 G09 성립을 위해.
  - CSV 컬럼명은 다운로드 후 실제 헤더 보고 확정. 지금은 방어적으로
    contentsid/CONTENTS_ID/contents_id 여러 후보를 시도.
  - 실 CSV가 없을 때 데모 재현 가능하도록 --seed-dev-fix-request 옵션 제공.
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
from pathlib import Path

from sqlalchemy import text

from apps.api import db

FIX_REQUEST_ID_CANDIDATES: tuple[str, ...] = (
    "contentsid", "CONTENTS_ID", "contents_id",
    "CONTENTSID", "contentsId",
    "콘텐츠아이디",  # 제주관광공사 실 CSV 헤더
)


def _pick_first(row: dict[str, str], keys: tuple[str, ...]) -> str | None:
    for k in keys:
        v = row.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _open_csv_autodetect(csv_path: Path):
    """공공데이터포털 CSV는 CP949가 흔하고, 재저장본은 UTF-8-SIG.
    두 인코딩을 순차 시도해 성공한 것을 사용한다.
    """
    for encoding in ("cp949", "utf-8-sig", "utf-8"):
        try:
            with csv_path.open(encoding=encoding) as f:
                f.readline()
            return csv_path.open(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("cp949/utf-8-sig/utf-8", b"", 0, 1, "unknown encoding")


def ingest_fix_request_csv(csv_path: Path) -> tuple[int, int]:
    """CSV의 contentsid 목록을 place.has_fix_request=true로 UPDATE.
    반환: (input_rows, updated_places)"""
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    ids: list[str] = []
    with _open_csv_autodetect(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            eid = _pick_first(row, FIX_REQUEST_ID_CANDIDATES)
            if eid:
                ids.append(eid)

    engine = db.get_engine()
    with engine.begin() as conn:
        result = conn.execute(
            text("UPDATE place SET has_fix_request=true WHERE external_id = ANY(:ids)"),
            {"ids": ids},
        )
        return len(ids), result.rowcount or 0


# ---- dev seed (CSV 도착 전 데모 재현용) ----

def seed_dev_tombstone(
    *,
    region: str = "aewol",
    category: str = "food",
    limit: int = 1,
    rng_seed: int | None = 7,
) -> list[str]:
    """G10/G14 데모용: 특정 장소를 tombstoned=true로.

    실제로는 raw_source에서 미등장 시 tombstone이 자동 세워지지만,
    한 번의 fetch로 확인되는 tombstone이 없으니 데모 재현용 seed.
    """
    if rng_seed is not None:
        random.seed(rng_seed)
    engine = db.get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT external_id, name FROM place
                 WHERE region_normalized = :region
                   AND category = :category
                   AND tombstoned = false
                 ORDER BY external_id
                """
            ),
            {"region": region, "category": category},
        ).all()
        if not rows:
            return []
        chosen = random.sample(list(rows), min(limit, len(rows)))
        ids = [r.external_id for r in chosen]
        conn.execute(
            text("UPDATE place SET tombstoned=true WHERE external_id = ANY(:ids)"),
            {"ids": ids},
        )
        return ids


def seed_dev_fix_request(
    *,
    region: str = "aewol",
    category: str = "food",
    limit: int = 3,
    rng_seed: int | None = None,
) -> list[str]:
    """CSV가 없을 때 데모를 살리기 위한 임시 플래그.

    골든셋 G09 재현을 보장하려면 검색 상위(=updated_at DESC로 정렬)에
    걸리는 항목을 결정론적으로 선택한다. rng_seed는 하위 호환 인자.
    """
    engine = db.get_engine()
    with engine.begin() as conn:
        # 검색 SQL(search.py)의 ORDER BY와 동일한 정렬로 상위 N개를 골라
        # 실제 노출 결과에 포함되도록 보장.
        rows = conn.execute(
            text(
                """
                SELECT external_id, name FROM place
                 WHERE region_normalized = :region
                   AND category = :category
                   AND has_fix_request = false
                   AND tombstoned = false
                 ORDER BY updated_at DESC
                 LIMIT :limit
                """
            ),
            {"region": region, "category": category, "limit": limit},
        ).all()

        if not rows:
            return []
        ids = [r.external_id for r in rows]
        conn.execute(
            text("UPDATE place SET has_fix_request=true WHERE external_id = ANY(:ids)"),
            {"ids": ids},
        )
        return ids


# ---- CLI ----

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="파일 기반 적재 (수정요청/위생/교통).")
    p.add_argument("--fix-request-csv", metavar="PATH",
                   help="S5 콘텐츠수정요청 CSV → has_fix_request UPDATE")
    p.add_argument("--seed-dev-fix-request", action="store_true",
                   help="CSV 없을 때 애월/food 몇 곳에 플래그를 세워 데모 재현")
    p.add_argument("--seed-dev-tombstone", action="store_true",
                   help="G10/G14 데모용 tombstone을 애월/food 한 곳에 세움")
    p.add_argument("--seed-region", default="aewol")
    p.add_argument("--seed-category", default="food")
    p.add_argument("--seed-limit", type=int, default=3)
    args = p.parse_args(argv)

    if not (args.fix_request_csv or args.seed_dev_fix_request or args.seed_dev_tombstone):
        print(
            "모드가 필요합니다: --fix-request-csv PATH / --seed-dev-fix-request / --seed-dev-tombstone",
            file=sys.stderr,
        )
        return 64

    if args.fix_request_csv:
        rows, updated = ingest_fix_request_csv(Path(args.fix_request_csv))
        print(f"[fix-request] csv rows={rows}  updated_places={updated}")
        return 0

    if args.seed_dev_fix_request:
        ids = seed_dev_fix_request(
            region=args.seed_region,
            category=args.seed_category,
            limit=args.seed_limit,
        )
        print(f"[fix-request/seed] flagged {len(ids)} places: {ids}")

    if args.seed_dev_tombstone:
        ids = seed_dev_tombstone(
            region=args.seed_region,
            category=args.seed_category,
            limit=max(1, args.seed_limit // 3),
        )
        print(f"[tombstone/seed] tombstoned {len(ids)} places: {ids}")

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
