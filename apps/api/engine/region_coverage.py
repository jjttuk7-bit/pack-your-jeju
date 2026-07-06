"""지역 선택 직후 보여줄 공공데이터 커버리지 프리뷰.

LLM 없이 count query와 템플릿 문구만 사용한다. 목적은 사용자가 팩 생성 전
지역별 강점과 빈틈을 먼저 보게 하는 것.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Mapping

from sqlalchemy import text

from apps.api import db
from apps.api.engine.filters import MOMENT_TO_CATEGORY, REGIONS

REGION_LABEL_KO: dict[str, str] = {
    "jeju_city": "제주시",
    "seogwipo": "서귀포",
    "aewol": "애월",
    "hallim": "한림",
    "seongsan": "성산",
    "jocheon": "조천",
    "gujwa": "구좌",
    "andeok": "안덕",
    "daejeong": "대정",
    "pyoseon": "표선",
    "namwon": "남원",
    "udo": "우도",
}

MOMENT_LABEL_KO: dict[str, str] = {
    "oreum": "오름",
    "beach_walk": "바다 산책",
    "sunset": "노을 감상",
    "local_market": "로컬 시장",
    "local_food": "현지 맛집",
    "quiet_cafe": "조용한 카페",
    "gotjawal": "곶자왈",
    "citrus": "감귤밭 체험",
}


def build_preview_from_counts(
    *,
    region: str,
    counts: Mapping[str, Mapping[str, int]],
) -> dict:
    """moment별 verified/caution 카운트로 preview 응답을 조립."""
    if region not in REGIONS:
        raise ValueError(f"UnknownRegion: {region}")

    moments: list[dict] = []
    recommended: list[tuple[str, int]] = []
    weak: list[str] = []
    total_places = 0

    for moment, category in MOMENT_TO_CATEGORY.items():
        c = counts.get(moment, {})
        verified = int(c.get("verified", 0) or 0)
        caution = int(c.get("caution", 0) or 0)
        total = verified + caution
        total_places += total
        is_gap = total == 0
        if is_gap:
            weak.append(moment)
        else:
            recommended.append((moment, total))
        moments.append(
            {
                "moment": moment,
                "moment_label": MOMENT_LABEL_KO.get(moment, moment),
                "category": category,
                "verified": verified,
                "caution": caution,
                "coverage_gap": is_gap,
            }
        )

    recommended_moments = [
        moment for moment, _ in sorted(recommended, key=lambda x: (-x[1], x[0]))[:3]
    ]

    return {
        "region": region,
        "region_label": REGION_LABEL_KO.get(region, region),
        "total_places": total_places,
        "moments": moments,
        "recommended_moments": recommended_moments,
        "weak_moments": weak,
        "briefing": _briefing(region, recommended_moments, weak),
    }


def build_region_preview(region: str) -> dict:
    """DB에서 지역별 moment 커버리지를 집계해 preview를 반환."""
    counts = _load_counts(region)
    return build_preview_from_counts(region=region, counts=counts)


def _load_counts(region: str) -> dict[str, dict[str, int]]:
    if region not in REGIONS:
        raise ValueError(f"UnknownRegion: {region}")

    category_to_moments: dict[str, list[str]] = {}
    for moment, category in MOMENT_TO_CATEGORY.items():
        category_to_moments.setdefault(category, []).append(moment)

    now = datetime.now(timezone.utc)
    rows = []
    with db.get_engine().connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT category,
                       SUM(
                         CASE
                           WHEN valid_until > :now
                            AND has_fix_request = false
                            AND tombstoned = false
                           THEN 1 ELSE 0
                         END
                       ) AS verified,
                       SUM(
                         CASE
                           WHEN tombstoned = false
                            AND (
                              valid_until <= :now
                              OR has_fix_request = true
                            )
                           THEN 1 ELSE 0
                         END
                       ) AS caution
                  FROM place
                 WHERE region_normalized = :region
                   AND tombstoned = false
                   AND category = ANY(:categories)
                 GROUP BY category
                """
            ),
            {"region": region, "categories": list(category_to_moments), "now": now},
        ).all()

    counts: dict[str, dict[str, int]] = {}
    for row in rows:
        for moment in category_to_moments.get(row.category, []):
            counts[moment] = {
                "verified": int(row.verified or 0),
                "caution": int(row.caution or 0),
            }
    return counts


def _briefing(region: str, recommended: list[str], weak: list[str]) -> str:
    region_label = REGION_LABEL_KO.get(region, region)
    topic = _topic(region_label)
    if recommended and weak:
        rec = "·".join(MOMENT_LABEL_KO.get(m, m) for m in recommended[:2])
        gap = "·".join(MOMENT_LABEL_KO.get(m, m) for m in weak[:2])
        return (
            f"{topic} {rec} 쪽 후보가 비교적 확인되어 있고, "
            f"{gap}은 저희가 참조하는 공공데이터 기준으로 확인되지 않습니다."
        )
    if recommended:
        rec = "·".join(MOMENT_LABEL_KO.get(m, m) for m in recommended[:3])
        return f"{topic} {rec} 쪽으로 확인된 후보가 있습니다."
    return (
        f"{topic} 선택하신 순간과 연결할 후보가 "
        "저희가 참조하는 공공데이터 기준으로 확인되지 않습니다."
    )


def _topic(label: str) -> str:
    if not label:
        return label
    code = ord(label[-1])
    if not (0xAC00 <= code <= 0xD7A3):
        return f"{label}은"
    has_batchim = (code - 0xAC00) % 28 != 0
    return f"{label}{'은' if has_batchim else '는'}"
