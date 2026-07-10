"""pack_result 조립 + 팩 소개 문구 (LLM + 템플릿 폴백).

원칙 (CLAUDE.md 절대 규칙 1·5·6):
  - LLM은 조립·요약만. 새 장소·수치·시간을 생성하면 안 됨.
  - gpt-5.3-mini 고정, max_completion_tokens 사용.
  - 키 없거나 실패 시 템플릿 문구로 폴백 — 서버가 죽지 않는다.

TRUST_ENGINE §5:
  - 입력: 검증된 항목들 + 순간·동행자
  - 출력: 2~3문장 감성 문구, 새 사실 추가 금지
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta

from apps.api.engine import llm
from apps.api.engine.trust import Section

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
    "local_market": "로컬 시장 투어",
    "local_food":   "현지 맛집",
    "quiet_cafe":   "조용한 카페",
    "gotjawal":     "곶자왈 숲길",
    "citrus":       "감귤 체험",
    "stay":          "숙소까지 같이 보기",
    "festival_event": "축제·행사 맞춰가기",
    "souvenir_shopping": "특산물·기념품 쇼핑",
    "culture_stop":  "전시·문화 공간",
}


@dataclass(frozen=True)
class Intro:
    text: str
    llm_used: bool
    reason: str = ""      # llm_used=False 사유 (unavailable/error 등)


# ---- 템플릿 폴백 ----

def _template_intro(sections: list[Section], companion: str) -> str:
    """LLM 없이도 항상 나오는 안전 문구.

    검증된 항목이 있는 순간과 확인 안 된 순간을 정직하게 구분해 두 문장으로.
    """
    companion_ko = COMPANION_LABEL_KO.get(companion, "")
    verified: list[str] = []
    gapped: list[str] = []
    for s in sections:
        label = MOMENT_LABEL_KO.get(s.moment, s.moment)
        if s.items:
            verified.append(label)
        elif s.fallback and s.fallback.reason == "coverage_gap":
            gapped.append(label)

    parts: list[str] = []
    if verified:
        head = "".join([companion_ko + " 함께하는 " if companion_ko else ""])
        parts.append(f"{head}{', '.join(verified)}을(를) 준비했습니다.")
    if gapped:
        parts.append(
            f"{', '.join(gapped)}은(는) 저희가 참조하는 공공데이터 기준으로 "
            "이 지역에서 확인되지 않아 이번 팩에서는 비워두었습니다."
        )
    if not parts:
        parts.append("이번 요청에 맞는 항목을 아직 찾지 못했습니다. 다른 지역/순간을 시도해 보세요.")
    return " ".join(parts)


# ---- LLM 경로 ----

_SYSTEM_PROMPT = (
    "너는 여행 준비 서비스의 안내 문구 작성자다. "
    "제공된 검증된 항목 목록과 확인되지 않은 항목 목록만을 근거로 "
    "2~3문장의 한국어 소개를 만든다. "
    "장소명·수치·시간을 새로 만들지 마라. 목록에 없는 이름을 언급하지 마라. "
    "확인되지 않은 항목이 있으면 '저희가 참조하는 공공데이터 기준으로 확인되지 않는다'는 "
    "표현으로만 언급하고, '없다'고 단언하지 마라. "
    "사용자가 special_notes를 남겼다면 톤·배려 문구에만 반영하고, "
    "이를 근거로 새 장소·시간·조건을 지어내지 마라.\n\n"
    "출력 형식: JSON이나 코드블록 없이 순수 한국어 문장 그대로만 출력하라. "
    "따옴표·중괄호·키 이름 없이 사용자에게 그대로 보여줄 문구만 반환하라."
)


def _build_user_prompt(
    sections: list[Section], companion: str, special_notes: str | None = None,
) -> str:
    payload: dict = {
        "companion": companion,
        "moments": [
            {
                "moment": s.moment,
                "verified_items": [it.name for it in s.items if it.badge == "verified"],
                "caution_items":  [it.name for it in s.items if it.badge == "caution"],
                "coverage_gap":   bool(s.fallback and s.fallback.reason == "coverage_gap"),
                "contradicted":   bool(s.fallback and s.fallback.reason == "contradicted"),
            }
            for s in sections
        ],
    }
    if special_notes:
        payload["special_notes"] = special_notes
    return json.dumps(payload, ensure_ascii=False)


# 12지역 → 대표 시권 (지역별 요일 그룹핑에 사용).
# 인접 지역은 같은 요일 클러스터로 묶여 동선이 자연스러워진다.
_REGION_CLUSTER: dict[str, str] = {
    "jeju_city": "west", "aewol": "west", "hallim": "west",
    "seogwipo":  "south", "andeok": "south", "daejeong": "south",
    "namwon":    "south", "pyoseon": "south",
    "seongsan":  "east", "gujwa": "east", "jocheon": "east", "udo": "east",
}


def _item_to_dict(moment: str, it) -> dict:
    return {
        "moment": moment,
        "name": it.name,
        "badge": it.badge,
        "external_id": it.external_id,
        "sources": it.sources,
        "freshness": it.freshness,
        "transit": it.transit,
        "note": it.note,
        "region_normalized": getattr(it, "region_normalized", ""),
        "trust_score": getattr(it, "trust_score", 0),
        "score_breakdown": getattr(it, "score_breakdown", {}),
        "check_required": getattr(it, "check_required", []),
    }


def _compute_unavailable(
    day_regions: list[str],
    day_items: list[dict],
    selected_moments: tuple[str, ...],
) -> list[dict]:
    """이 요일의 (region × 사용자 선택 순간) 조합 중 items로 채워지지 않은 것들을 나열.

    정직함 원칙 (CLAUDE.md 절대 규칙 3): 빈 요일에 이유를 사실 그대로 노출한다.
    """
    if not day_regions or not selected_moments:
        return []
    present: set[tuple[str, str]] = {
        (str(it.get("region_normalized") or ""), str(it.get("moment") or ""))
        for it in day_items
    }
    out: list[dict] = []
    for r in day_regions:
        for m in selected_moments:
            if (r, m) not in present:
                out.append({"region": r, "moment": m})
    return out


def dispatch_itinerary(
    sections: list[Section],
    days: int,
    start_date: date,
    selected_regions: tuple[str, ...] = (),
    selected_moments: tuple[str, ...] = (),
) -> list[dict]:
    """검증된 items를 요일별로 배치 (규칙 기반, LLM 없음).

    원칙 (CLAUDE.md 절대 규칙 1):
      - LLM 사용 금지. items를 지어내지 않고 기존 검증된 것들만 재배치.
      - 각 item은 원래 moment 정보를 유지 → UI에서 "어느 순간에서 왔는지" 표시.

    배치 규칙 (지역 선택 개수에 따라):
      A) 여러 지역 선택 → 지역별 그룹핑
         선택 지역 수 <= days: 지역 하나당 최소 하루씩 배정
         선택 지역 수 > days:  인접 지역(_REGION_CLUSTER)끼리 같은 날에 합침
      B) 지역 하나만 선택 (또는 selected_regions 미지정) → 순간별 순환 배치
         같은 moment는 서로 다른 요일에 분산 (하루당 다양한 순간)

    입력:
      sections: trust.judge_section 결과.
      days: 여행 일수 (>= 1).
      start_date: 여행 시작일.
      selected_regions: 사용자가 폼에서 선택한 지역들 (순서 유지). 하나면 B 규칙.
    """
    def _empty_days() -> list[dict]:
        return [
            {
                "day": i + 1,
                "date": (start_date + timedelta(days=i)).isoformat(),
                "items": [],
                "regions": [],
                "unavailable_moments": [],
            }
            for i in range(days)
        ]

    # 규칙 B: 지역 하나 또는 미지정 — 순간별 순환
    unique_regions = tuple(dict.fromkeys(selected_regions))  # 순서 유지 uniq
    if len(unique_regions) <= 1:
        result = _empty_days()
        if unique_regions:
            for day in result:
                day["regions"] = list(unique_regions)
        for s in sections:
            for idx, it in enumerate(s.items):
                result[idx % days]["items"].append(_item_to_dict(s.moment, it))
        # 각 요일마다 (region × moment) 중 빈 조합 진단
        for day in result:
            day["unavailable_moments"] = _compute_unavailable(
                day["regions"], day["items"], selected_moments,
            )
        return result

    # 규칙 A: 여러 지역 — 지역별로 요일 배정
    # 1) 지역 → 클러스터 별로 묶기 (인접 지역 합치기)
    #    days보다 지역 수가 많으면 클러스터 단위로 배정
    cluster_of = lambda r: _REGION_CLUSTER.get(r, r)
    n_regions = len(unique_regions)

    if n_regions <= days:
        # 지역 하나당 최소 하루. 남는 요일은 첫 지역 반복 or 균등 채움.
        # 균등 채움: days를 n_regions로 나눠 각 지역에 몫만큼 배정, 나머지는 앞쪽 지역에.
        base = days // n_regions
        extra = days - base * n_regions
        day_to_region: list[str] = []
        for i, r in enumerate(unique_regions):
            n = base + (1 if i < extra else 0)
            day_to_region.extend([r] * n)
    else:
        # 지역 수 > days: 클러스터별로 요일 배정 → 클러스터 안의 지역들을 같은 날에 몰기.
        # 클러스터도 days보다 많으면 초과분은 마지막 날에 합쳐 넣는다.
        cluster_seq: list[str] = []
        seen: set[str] = set()
        for r in unique_regions:
            c = cluster_of(r)
            if c not in seen:
                cluster_seq.append(c)
                seen.add(c)
        n_clusters = len(cluster_seq)
        if n_clusters <= days:
            base = days // n_clusters
            extra = days - base * n_clusters
            day_to_cluster: list[str] = []
            for i, c in enumerate(cluster_seq):
                n = base + (1 if i < extra else 0)
                day_to_cluster.extend([c] * n)
            day_to_region = day_to_cluster  # 실제로는 cluster id로 배정
        else:
            # 클러스터도 days보다 많음: 앞 (days-1)개는 하루씩, 마지막 날에 나머지 몰아넣기
            day_to_region = list(cluster_seq[:days])
            day_to_region[-1] = "|".join(cluster_seq[days - 1:])

    result = _empty_days()

    # 2) 각 요일에 노출할 지역 라벨(들) 세팅
    day_match_regions: list[list[str]] = []
    for day_idx, tag in enumerate(day_to_region):
        if n_regions <= days:
            match_regions = [tag]
        else:
            match_regions = (
                [r for r in unique_regions if cluster_of(r) == tag]
                if "|" not in tag
                else [r for r in unique_regions if cluster_of(r) in tag.split("|")]
            )
        result[day_idx]["regions"] = match_regions
        day_match_regions.append(match_regions)

    # 3) 지역별 items 수집 (같은 items가 여러 요일에 중복되지 않도록 지역별 pool 구성)
    region_pool: dict[str, list[dict]] = {r: [] for r in unique_regions}
    for s in sections:
        for it in s.items:
            r = getattr(it, "region_normalized", "") or ""
            if r in region_pool:
                region_pool[r].append(_item_to_dict(s.moment, it))

    # 4) 각 지역에 할당된 요일 리스트를 만들고, 그 요일들에 items를 순환 배치
    region_day_indices: dict[str, list[int]] = {r: [] for r in unique_regions}
    for day_idx, matches in enumerate(day_match_regions):
        for r in matches:
            if r in region_day_indices:
                region_day_indices[r].append(day_idx)

    for r, items in region_pool.items():
        target_days = region_day_indices.get(r, [])
        if not target_days:
            continue
        for i, item in enumerate(items):
            di = target_days[i % len(target_days)]
            result[di]["items"].append(item)

    # 5) 매칭 실패 items (원 응답에는 있는데 지역 매칭 안 된 것) 마지막 요일에 흡수 (정직: 유실 방지)
    placed_ids: set[str] = {i["external_id"] for day in result for i in day["items"]}
    orphans: list[dict] = []
    for s in sections:
        for it in s.items:
            if it.external_id not in placed_ids:
                orphans.append(_item_to_dict(s.moment, it))
    if orphans:
        result[-1]["items"].extend(orphans)

    # 규칙 A 결과에도 요일별 (region × moment) 빈 조합 진단
    for day in result:
        day["unavailable_moments"] = _compute_unavailable(
            day["regions"], day["items"], selected_moments,
        )

    return result


def compose_intro(
    sections: list[Section], companion: str, special_notes: str | None = None,
) -> Intro:
    """LLM 시도 → 실패면 템플릿 폴백. 항상 Intro를 반환한다.

    special_notes: 사용자 자유 텍스트. LLM 프롬프트에 톤 힌트로만 전달.
    템플릿 폴백은 그대로 (자유 텍스트를 그대로 되풀이하지 않음 — 톤 조작은 LLM 경로에서만).
    """
    if not llm.is_available():
        return Intro(text=_template_intro(sections, companion), llm_used=False,
                     reason="OPENAI_API_KEY not set")

    resp = llm.complete(
        system=_SYSTEM_PROMPT,
        user=_build_user_prompt(sections, companion, special_notes),
        max_completion_tokens=250,
        temperature=0.4,
    )
    if not resp.available or not resp.text:
        return Intro(text=_template_intro(sections, companion), llm_used=False,
                     reason=resp.reason or "empty response")

    # 방어적 파싱: llm.py의 공통 NO_HALLUCINATION_CLAUSE에 'JSON 외 출력 금지'가
    # 포함돼 모델이 {"introduction": "..."} 같은 JSON으로 응답할 수 있다.
    # 사용자 화면에는 순수 문자열만 노출한다.
    cleaned = _unwrap_intro_text(resp.text)
    return Intro(text=cleaned, llm_used=True)


def _unwrap_intro_text(raw: str) -> str:
    """LLM 응답에서 사용자 노출용 순수 문장만 추출."""
    text = raw.strip()
    # 코드펜스 제거
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # JSON이면 introduction/text/message 순으로 필드 시도, 안 되면 값들의 첫 문자열.
    if text.startswith("{") and text.endswith("}"):
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                for key in ("introduction", "text", "message", "intro", "content"):
                    v = obj.get(key)
                    if isinstance(v, str) and v.strip():
                        return v.strip()
                # 최후: dict의 첫 문자열 값
                for v in obj.values():
                    if isinstance(v, str) and v.strip():
                        return v.strip()
        except json.JSONDecodeError:
            pass
    return text
