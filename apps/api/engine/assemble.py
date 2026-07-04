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
    "이를 근거로 새 장소·시간·조건을 지어내지 마라."
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

    return Intro(text=resp.text, llm_used=True)
