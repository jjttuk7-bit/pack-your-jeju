"""팩 결과 → 감성 톤 여행 저널 PDF.

원칙 (CLAUDE.md):
  - 문구·수치·시간을 LLM으로 지어내지 않는다. 표지 문안은 폼 입력만으로 조립.
  - 각 place 카드의 이름·주소·배지·근거 URL은 100% DB 조회값.
  - 확인되지 않은 (region × moment) 조합은 정직하게 마지막에 노출.

폰트: 로컬 Windows(맑은 고딕) → 프로덕션 Linux(Noto CJK) 순으로 fallback.
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


# ─── 폰트 등록 (환경별 fallback) ─────────────────────────
#
# reportlab는 임베딩할 TTF/OTF 파일 경로가 필요하다. 로컬(Windows)과 프로덕션(Linux)
# 둘 다에서 동작하도록 후보 경로를 순차 탐색해 가장 먼저 발견된 것을 등록한다.

_FONT_CANDIDATES_REGULAR: list[str] = [
    # 프로덕션(Debian slim + fonts-noto-cjk)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    # 나눔고딕(존재 시)
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    # 로컬 Windows
    r"C:\Windows\Fonts\malgun.ttf",
]
_FONT_CANDIDATES_BOLD: list[str] = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    r"C:\Windows\Fonts\malgunbd.ttf",
]

FONT_REGULAR = "PYJ-KR"
FONT_BOLD = "PYJ-KR-Bold"

_font_registered = False


def _pick_font(candidates: list[str]) -> str | None:
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def _ensure_fonts() -> tuple[bool, str]:
    """실제로 등록된 상태를 True/False와 진단 메시지로 반환.

    폰트 파일이 없으면 등록 실패 → 호출부는 500 대신 상태 코드로 안내.
    """
    global _font_registered
    if _font_registered:
        return True, "cached"

    reg = _pick_font(_FONT_CANDIDATES_REGULAR)
    if reg is None:
        return False, "no Korean font found (tried Noto CJK, Nanum, malgun)"

    bold = _pick_font(_FONT_CANDIDATES_BOLD) or reg

    try:
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, reg))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, bold))
    except Exception as e:
        return False, f"reportlab registerFont failed: {e}"

    _font_registered = True
    return True, f"regular={reg} bold={bold}"


# ─── 컬러 팔레트 (프론트 톤과 동일) ─────────────────────

CITRUS = colors.HexColor("#E67A34")
CITRUS_2 = colors.HexColor("#C55A18")
MINT = colors.HexColor("#3C8D6F")
BASALT = colors.HexColor("#2D2A26")
BASALT_2 = colors.HexColor("#5A554F")
EARTH = colors.HexColor("#E9DFCF")
IVORY = colors.HexColor("#FDF6EA")
AMBER_BG = colors.HexColor("#FEF3C7")
AMBER_TEXT = colors.HexColor("#78350F")
BG_SAND = colors.HexColor("#FBF6EA")


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
    "oreum": "오름 산책",
    "beach_walk": "바다 산책",
    "sunset": "노을 감상",
    "local_market": "로컬 시장",
    "local_food": "현지 맛집",
    "quiet_cafe": "조용한 카페",
    "gotjawal": "곶자왈 숲길",
    "citrus": "감귤 체험",
}

COMPANION_LABEL_KO: dict[str, str] = {
    "solo": "혼자",
    "couple": "연인과",
    "friend": "친구와",
    "family": "가족과",
    "kids": "아이와",
    "parents": "부모님과",
}

PURPOSE_LABEL_KO: dict[str, str] = {
    "healing": "쉼과 치유",
    "sightseeing": "관광",
    "food": "먹부림",
    "activity": "액티비티",
    "hocance": "호캉스",
}

BADGE_KO: dict[str, str] = {
    "verified": "확인됨",
    "caution": "주의",
    "contradicted": "폐업 확인",
    "reference": "참고",
}


# ─── 스타일 ─────────────────────────────────────

def _make_styles() -> dict[str, ParagraphStyle]:
    common = dict(fontName=FONT_REGULAR, textColor=BASALT)
    return {
        "cover_kicker": ParagraphStyle(
            "ck", fontName=FONT_BOLD, fontSize=10, leading=13,
            textColor=CITRUS_2, alignment=TA_LEFT, spaceAfter=4,
        ),
        "cover_title": ParagraphStyle(
            "ct", fontName=FONT_BOLD, fontSize=34, leading=42,
            textColor=BASALT, alignment=TA_LEFT, spaceAfter=6,
        ),
        "cover_subtitle": ParagraphStyle(
            "cs", fontName=FONT_REGULAR, fontSize=14, leading=20,
            textColor=BASALT_2, alignment=TA_LEFT, spaceAfter=12,
        ),
        "cover_hero": ParagraphStyle(
            "ch", fontName=FONT_REGULAR, fontSize=13, leading=22,
            textColor=BASALT, alignment=TA_LEFT, spaceAfter=6,
        ),
        "day_head": ParagraphStyle(
            "dh", fontName=FONT_BOLD, fontSize=22, leading=28,
            textColor=BASALT, spaceAfter=2,
        ),
        "day_sub": ParagraphStyle(
            "ds", fontName=FONT_REGULAR, fontSize=11, leading=15,
            textColor=CITRUS_2, spaceAfter=10,
        ),
        "item_title": ParagraphStyle(
            "it", fontName=FONT_BOLD, fontSize=13, leading=17,
            textColor=BASALT, spaceAfter=1,
        ),
        "item_meta": ParagraphStyle(
            "im", fontName=FONT_REGULAR, fontSize=9, leading=13,
            textColor=BASALT_2, spaceAfter=1,
        ),
        "item_body": ParagraphStyle(
            "ib", fontName=FONT_REGULAR, fontSize=9.5, leading=14,
            textColor=BASALT, spaceAfter=2,
        ),
        "moment_pill": ParagraphStyle(
            "mp", fontName=FONT_BOLD, fontSize=8, leading=11,
            textColor=CITRUS_2, spaceAfter=1,
        ),
        "section_head": ParagraphStyle(
            "sh", fontName=FONT_BOLD, fontSize=14, leading=18,
            textColor=BASALT, spaceBefore=12, spaceAfter=6,
        ),
        "closing": ParagraphStyle(
            "cl", fontName=FONT_REGULAR, fontSize=11, leading=18,
            textColor=BASALT, alignment=TA_CENTER, spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "sm", fontName=FONT_REGULAR, fontSize=8.5, leading=12,
            textColor=BASALT_2,
        ),
    }


# ─── 콘텐츠 조립 ─────────────────────────────────

def _fmt_date_ko(iso: str) -> str:
    try:
        d = date.fromisoformat(iso[:10])
        weekday = ["월", "화", "수", "목", "금", "토", "일"][d.weekday()]
        return f"{d.year}. {d.month}. {d.day}. ({weekday})"
    except Exception:
        return iso


def _hero_line(req: dict) -> str:
    """표지 부제 — '{동행자}와 {지역}에서 {N}일간 {목적}' 형태.

    폼 값만으로 조립 (LLM 불사용). '가슴 두근거리는' 톤은 컬러·타이포로 살린다.
    """
    regions = req.get("regions") or ([req.get("region")] if req.get("region") else [])
    reg_ko = " · ".join(REGION_LABEL_KO.get(r, r) for r in regions if r)
    days = req.get("days") or 0
    companion_ko = COMPANION_LABEL_KO.get(req.get("companion", ""), "")
    purpose_ko = PURPOSE_LABEL_KO.get(req.get("purpose", ""), "")

    parts = []
    if companion_ko:
        parts.append(companion_ko)
    if reg_ko:
        parts.append(f"{reg_ko}에서")
    if days:
        parts.append(f"{days}일")
    if purpose_ko:
        parts.append(f"{purpose_ko} 여행")
    return " ".join(parts)


def _badge_flowable(badge: str, styles: dict) -> Table:
    """배지 라벨을 컬러 배경 셀로 렌더. 프론트 배지 톤과 색을 맞춤."""
    label = BADGE_KO.get(badge, badge)
    if badge == "verified":
        bg, fg = colors.HexColor("#DDF0E6"), MINT
    elif badge == "caution":
        bg, fg = AMBER_BG, AMBER_TEXT
    elif badge == "contradicted":
        bg, fg = colors.HexColor("#FEE2E2"), colors.HexColor("#7F1D1D")
    else:
        bg, fg = colors.HexColor("#EEE7D6"), BASALT_2

    style = ParagraphStyle(
        "bp", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=fg,
        alignment=TA_CENTER,
    )
    t = Table([[Paragraph(label, style)]], colWidths=[16 * mm], rowHeights=[6 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("BOX", (0, 0), (-1, -1), 0.3, fg),
    ]))
    return t


def _item_card(item: dict, styles: dict) -> Table:
    """place 하나를 한 개의 카드로 렌더 — 이름 · 배지 · 순간 · 주소 · 근거."""
    moment = item.get("moment") or ""
    moment_ko = MOMENT_LABEL_KO.get(moment, moment)
    region = item.get("region") or ""
    region_ko = REGION_LABEL_KO.get(region, region) if region else ""

    meta_bits = []
    if moment_ko:
        meta_bits.append(moment_ko)
    if region_ko:
        meta_bits.append(region_ko)
    meta = " · ".join(meta_bits)

    left_lines = [Paragraph(meta, styles["moment_pill"])] if meta else []
    left_lines.append(Paragraph(item.get("name", ""), styles["item_title"]))
    if item.get("address"):
        left_lines.append(Paragraph(item["address"], styles["item_meta"]))
    if item.get("note"):
        left_lines.append(Paragraph(f"※ {item['note']}", styles["item_meta"]))
    if item.get("sources"):
        src = item["sources"][0]
        left_lines.append(
            Paragraph(
                f'<link href="{src.get("url","")}"><font color="#5A554F">근거: {src.get("name","")}</font></link>',
                styles["item_meta"],
            )
        )

    left_cell = Table(
        [[p] for p in left_lines],
        colWidths=[130 * mm],
        style=TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]),
    )
    right_cell = _badge_flowable(item.get("badge") or "reference", styles)

    card = Table(
        [[left_cell, right_cell]],
        colWidths=[130 * mm, 20 * mm],
        style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.4, EARTH),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]),
    )
    return card


def _day_block(day: dict, styles: dict) -> list:
    """Day 하나 = 헤더 + 카드 리스트 + (선택) 미확인 조합 노트."""
    day_no = day.get("day", 0)
    date_iso = day.get("date", "")
    date_ko = _fmt_date_ko(date_iso)
    regions = day.get("regions") or []
    region_ko = " · ".join(REGION_LABEL_KO.get(r, r) for r in regions)

    story: list = []
    story.append(Paragraph(f"Day {day_no}", styles["day_head"]))
    subtitle_parts = [date_ko]
    if region_ko:
        subtitle_parts.append(region_ko)
    story.append(Paragraph(" · ".join(subtitle_parts), styles["day_sub"]))

    for it in day.get("items", []):
        story.append(_item_card(it, styles))
        story.append(Spacer(1, 3 * mm))

    unavailable = day.get("unavailable_moments") or []
    if unavailable:
        by_region: dict[str, list[str]] = {}
        for u in unavailable:
            by_region.setdefault(u.get("region", ""), []).append(u.get("moment", ""))
        lines = []
        for r, ms in by_region.items():
            reg_ko = REGION_LABEL_KO.get(r, r)
            ms_ko = " · ".join(MOMENT_LABEL_KO.get(m, m) for m in ms)
            lines.append(f"{reg_ko}에서는 {ms_ko}이(가) 저희 공공데이터로 확인되지 않았습니다.")
        note_style = ParagraphStyle(
            "un", fontName=FONT_REGULAR, fontSize=9, leading=13,
            textColor=AMBER_TEXT, backColor=AMBER_BG,
            borderColor=colors.HexColor("#FCD34D"),
            borderWidth=0.3, borderPadding=6, spaceBefore=4, spaceAfter=6,
        )
        for l in lines:
            story.append(Paragraph(l, note_style))

    story.append(Spacer(1, 6 * mm))
    return story


# ─── 페이지 프레임 ─────────────────────────────

def _draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_REGULAR, 8)
    canvas.setFillColor(BASALT_2)
    canvas.drawString(20 * mm, 12 * mm, "Pack Your Jeju — 근거 있는 여행 저널")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(EARTH)
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, A4[1] - 15 * mm, A4[0] - 20 * mm, A4[1] - 15 * mm)
    canvas.restoreState()


def _draw_cover(canvas, doc):
    # 표지 배경 — 아이보리 톤 살짝
    canvas.saveState()
    canvas.setFillColor(BG_SAND)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()
    _draw_footer(canvas, doc)


# ─── 표지 조립 ─────────────────────────────

def _cover_story(req: dict, pack: dict, styles: dict) -> list:
    story: list = []
    story.append(Spacer(1, 55 * mm))
    story.append(Paragraph("PACK YOUR JEJU", styles["cover_kicker"]))
    story.append(Paragraph("이 여행을,<br/>정직하게 담았습니다.", styles["cover_title"]))
    story.append(Spacer(1, 4 * mm))

    hero = _hero_line(req)
    if hero:
        story.append(Paragraph(hero, styles["cover_subtitle"]))

    intro_text = ""
    if isinstance(pack.get("intro"), dict):
        intro_text = pack["intro"].get("text") or ""
    if intro_text:
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(intro_text, styles["cover_hero"]))

    # 커버리지 스냅샷
    counts = _pack_counts(pack)
    if counts["total"] > 0:
        story.append(Spacer(1, 12 * mm))
        chip = ParagraphStyle(
            "cvc", fontName=FONT_BOLD, fontSize=9.5, leading=14,
            textColor=BASALT_2, spaceAfter=4,
        )
        story.append(Paragraph(
            f"저희 공공데이터로 확인된 곳 {counts['total']}곳"
            f" &nbsp;·&nbsp; 확인됨 {counts['verified']}"
            f" &nbsp;·&nbsp; 주의 {counts['caution']}",
            chip,
        ))

    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph(
        "저희는 지어내지 않았습니다. 근거로 담고, 없는 것은 정직하게 비웠습니다.",
        styles["small"],
    ))

    story.append(PageBreak())
    return story


def _pack_counts(pack: dict) -> dict[str, int]:
    verified = 0
    caution = 0
    for day in pack.get("itinerary", []) or []:
        for it in day.get("items", []) or []:
            b = it.get("badge")
            if b == "verified":
                verified += 1
            elif b == "caution":
                caution += 1
    return {"verified": verified, "caution": caution, "total": verified + caution}


# ─── 미확인 조합 요약 (마지막 페이지) ─────────

def _honesty_page(pack: dict, styles: dict) -> list:
    story: list = []
    story.append(Paragraph("정직하게, 확인되지 않은 것들", styles["section_head"]))
    story.append(Paragraph(
        "저희 데이터에서 확인되지 않은 조합입니다. 없다는 뜻이 아니라, "
        "저희가 참조하는 공공데이터 기준으로 확인되지 않았다는 뜻입니다.",
        styles["item_body"],
    ))

    combos: list[str] = []
    for day in pack.get("itinerary", []) or []:
        for u in day.get("unavailable_moments") or []:
            r_ko = REGION_LABEL_KO.get(u.get("region", ""), u.get("region", ""))
            m_ko = MOMENT_LABEL_KO.get(u.get("moment", ""), u.get("moment", ""))
            combos.append(f"{r_ko} · {m_ko}")

    combos = sorted(set(combos))
    if combos:
        for c in combos:
            story.append(Paragraph(f"· {c}", styles["item_body"]))
    else:
        story.append(Paragraph(
            "다행히도 선택하신 지역·순간 조합은 모두 저희 데이터로 확인됐습니다.",
            styles["item_body"],
        ))

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "Pack Your Jeju — 근거 있는 여행 준비.",
        styles["closing"],
    ))
    return story


# ─── 메인 엔트리 ─────────────────────────────

def build_pack_pdf(pack: dict, req: dict) -> bytes:
    """팩 응답(dict) + 원 요청(dict) → PDF 바이트.

    폰트 미탐지 시 RuntimeError 발생. 호출부(API 레이어)가 503으로 처리하도록.
    """
    ok, diag = _ensure_fonts()
    if not ok:
        raise RuntimeError(f"font unavailable: {diag}")

    styles = _make_styles()

    buf = io.BytesIO()

    # 표지는 별도 배경으로 그리기 위해 두 개의 PageTemplate.
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
        title="Pack Your Jeju — 여행 저널",
        author="Pack Your Jeju",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        id="normal",
    )
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=_draw_cover),
        PageTemplate(id="body", frames=[frame], onPage=_draw_footer),
    ])

    story: list = []
    story += _cover_story(req, pack, styles)

    # 표지 다음 페이지부터 body 템플릿.
    from reportlab.platypus.doctemplate import NextPageTemplate
    story.append(NextPageTemplate("body"))

    story.append(Paragraph("여행 일정", styles["section_head"]))
    for day in pack.get("itinerary", []) or []:
        story += _day_block(day, styles)

    story += _honesty_page(pack, styles)

    doc.build(story)
    return buf.getvalue()
