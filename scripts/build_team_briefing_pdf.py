"""팀 발표용 통합 PDF 생성.

Pack Your Jeju의 프로젝트 정체성·아키텍처·워크플로우·발표 대본 핵심을
한 PDF로 조립. 발표 전 팀 동료가 순서대로 읽으면 이해가 완결되도록 설계.

의존성: reportlab (이미 설치), Windows 맑은 고딕 (C:\\Windows\\Fonts\\malgun.ttf).

사용:
    python scripts/build_team_briefing_pdf.py
    → docs/team_briefing.pdf 생성
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
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
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)


# ---- 폰트 등록 ----

FONT_REGULAR = "Malgun"
FONT_BOLD = "MalgunBold"

pdfmetrics.registerFont(TTFont(FONT_REGULAR, r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\malgunbd.ttf"))


# ---- 컬러 팔레트 (Pack Your Jeju 톤과 조화) ----

CITRUS = colors.HexColor("#E67A34")
CITRUS_2 = colors.HexColor("#C55A18")
MINT = colors.HexColor("#3C8D6F")
BASALT = colors.HexColor("#2D2A26")
BASALT_2 = colors.HexColor("#5A554F")
EARTH = colors.HexColor("#E9DFCF")
IVORY = colors.HexColor("#FDF6EA")
AMBER_BG = colors.HexColor("#FEF3C7")


# ---- 스타일 ----

def _styles() -> dict[str, ParagraphStyle]:
    base = dict(fontName=FONT_REGULAR, leading=14, textColor=BASALT)
    return {
        "cover_title": ParagraphStyle(
            "cover_title", fontName=FONT_BOLD, fontSize=32, leading=38,
            textColor=BASALT, alignment=TA_LEFT, spaceAfter=6,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle", fontName=FONT_REGULAR, fontSize=13, leading=18,
            textColor=BASALT_2, alignment=TA_LEFT, spaceAfter=10,
        ),
        "cover_kicker": ParagraphStyle(
            "cover_kicker", fontName=FONT_BOLD, fontSize=10, leading=14,
            textColor=CITRUS_2, alignment=TA_LEFT, spaceAfter=4,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", fontName=FONT_REGULAR, fontSize=10, leading=15,
            textColor=BASALT_2, alignment=TA_LEFT,
        ),
        "h1": ParagraphStyle(
            "h1", fontName=FONT_BOLD, fontSize=20, leading=26,
            textColor=BASALT, spaceBefore=6, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2", fontName=FONT_BOLD, fontSize=14, leading=20,
            textColor=BASALT, spaceBefore=14, spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "h3", fontName=FONT_BOLD, fontSize=11.5, leading=16,
            textColor=CITRUS_2, spaceBefore=8, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", fontSize=10, spaceAfter=6, **base,
        ),
        "body_tight": ParagraphStyle(
            "body_tight", fontSize=10, spaceAfter=2, **base,
        ),
        "callout": ParagraphStyle(
            "callout", fontName=FONT_REGULAR, fontSize=10.5, leading=16,
            textColor=BASALT, backColor=IVORY, borderColor=EARTH,
            borderWidth=0.6, borderPadding=8, spaceAfter=10,
        ),
        "quote": ParagraphStyle(
            "quote", fontName=FONT_REGULAR, fontSize=10.5, leading=16,
            textColor=BASALT_2, leftIndent=12, rightIndent=12,
            borderColor=CITRUS, borderPadding=6, spaceAfter=8,
            backColor=colors.HexColor("#FFF5EB"),
        ),
        "small": ParagraphStyle(
            "small", fontName=FONT_REGULAR, fontSize=8.5, leading=12,
            textColor=BASALT_2,
        ),
        "toc": ParagraphStyle(
            "toc", fontName=FONT_REGULAR, fontSize=11, leading=18,
            textColor=BASALT,
        ),
    }


S = _styles()


# ---- 헬퍼 ----

def para(text: str, style_key: str = "body") -> Paragraph:
    return Paragraph(text, S[style_key])


def h1(text: str) -> Paragraph:
    return Paragraph(text, S["h1"])


def h2(text: str) -> Paragraph:
    return Paragraph(text, S["h2"])


def h3(text: str) -> Paragraph:
    return Paragraph(text, S["h3"])


def callout(text: str) -> Paragraph:
    return Paragraph(text, S["callout"])


def quote(text: str) -> Paragraph:
    return Paragraph(text, S["quote"])


def code_block(text: str) -> Preformatted:
    """monospace 코드/다이어그램 블록."""
    style = ParagraphStyle(
        "code", fontName="Courier", fontSize=8.5, leading=11,
        textColor=BASALT, backColor=colors.HexColor("#F6F1E5"),
        borderColor=EARTH, borderWidth=0.4, borderPadding=6,
    )
    return Preformatted(text, style)


def bullet_list(items: list[str]) -> list:
    """리스트 아이템을 · 접두로 렌더링."""
    return [para(f"· {t}", "body_tight") for t in items]


def table_2col(rows: list[tuple[str, str]], col_widths=(45 * mm, 130 * mm)) -> Table:
    data = [[Paragraph(k, S["body_tight"]), Paragraph(v, S["body_tight"])] for k, v in rows]
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, EARTH),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, EARTH),
        ("BACKGROUND", (0, 0), (0, -1), IVORY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def table_grid(header: list[str], rows: list[list[str]], col_widths=None) -> Table:
    data = [[Paragraph(h, S["body_tight"]) for h in header]] + [
        [Paragraph(c, S["body_tight"]) for c in r] for r in rows
    ]
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, EARTH),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, EARTH),
        ("BACKGROUND", (0, 0), (-1, 0), CITRUS),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


# ---- 페이지 프레임 (푸터에 페이지 번호) ----

def _draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_REGULAR, 8)
    canvas.setFillColor(BASALT_2)
    # 좌: 프로젝트명, 우: 페이지 번호
    canvas.drawString(20 * mm, 12 * mm, "Pack Your Jeju — 팀 발표 브리핑")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"{doc.page}")
    # 상단 얇은 라인
    canvas.setStrokeColor(EARTH)
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, A4[1] - 15 * mm, A4[0] - 20 * mm, A4[1] - 15 * mm)
    canvas.restoreState()


def _build_doc(path: Path) -> BaseDocTemplate:
    doc = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
        title="Pack Your Jeju — 팀 발표 브리핑",
        author="Pack Your Jeju Team",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        id="normal",
    )
    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=_draw_footer),
    ])
    return doc


# ─────────────────────────────────────────────────────────
# 섹션별 콘텐츠
# ─────────────────────────────────────────────────────────

def sec_cover() -> list:
    story = []
    story.append(Spacer(1, 40 * mm))
    story.append(para("아이펠톤 4일 · 20팀 경쟁 · 목표 1등", "cover_kicker"))
    story.append(para("Pack Your Jeju", "cover_title"))
    story.append(para("제주 특화 · 정직한 여행 준비 서비스", "cover_subtitle"))
    story.append(Spacer(1, 6 * mm))
    story.append(callout(
        "<b>근거 없이 답하지 않는다.</b><br/>"
        "억지로 채우는 것보다 정직한 '확인 불가'가 낫다.<br/>"
        "못 채우는 카테고리가 나오는 것은 버그가 아니라, 이 시스템이 정직하다는 증거."
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(para("팀 발표 브리핑 문서", "cover_meta"))
    story.append(para(
        "이 문서는 발표 전 팀 동료가 <b>한 번 통독</b>하면 "
        "프로젝트의 구조 · 실제 워크플로우 · 발표 흐름을 완결적으로 이해하도록 구성되었습니다.",
        "cover_meta",
    ))
    story.append(Spacer(1, 20 * mm))
    story.append(para(
        "· 발표일 리소스: 브라우저 2탭 · 로컬 백업 노트북 · 스크린 녹화 · QR 슬라이드",
        "small",
    ))
    story.append(para(
        "· 프로덕션: pack-your-jeju.vercel.app (프론트) · "
        "pack-your-jeju-production.up.railway.app (API)",
        "small",
    ))
    story.append(PageBreak())
    return story


def sec_toc() -> list:
    story = [h1("목차")]
    items = [
        ("1. 프로젝트 정체성 (30초 엘리베이터)", ""),
        ("2. 문제 정의 — 1,686건의 증거", ""),
        ("3. 절대 원칙 6가지 (팀 공통 헌법)", ""),
        ("4. 시스템 아키텍처 개요", ""),
        ("5. 실제 워크플로우 — 사용자 여정", ""),
        ("6. 트러스트 엔진 상세 (fallback 4분기 + 배지 4종)", ""),
        ("7. 하루방 에이전트 — 능동 인사 흐름", ""),
        ("8. 데이터 파이프라인 & 골든셋 게이트", ""),
        ("9. 발표 3막 구성 (10분)", ""),
        ("10. 예상 Q&A 카드", ""),
        ("11. 데모 리스크 관리 & 백업", ""),
        ("12. 팀 액션 아이템 (발표 전 체크리스트)", ""),
    ]
    for label, _ in items:
        story.append(para(label, "toc"))
    story.append(PageBreak())
    return story


def sec_identity() -> list:
    return [
        h1("1. 프로젝트 정체성"),
        h3("한 줄 정의"),
        callout(
            "여행자가 (제주 지역 · 기간 · 동행자 · 목적 · 순간카드)를 선택하면, "
            "<b>공공데이터 근거로 검증된</b> 장소·음식·교통 정보와 그에 맞는 "
            "짐 체크리스트를 하나의 '팩'으로 조립해 반환하는 서비스."
        ),
        h3("30초 엘리베이터 피치"),
        quote(
            "여행 앱들은 '가성비 맛집' '숨은 명소'를 말합니다. 그중 몇 곳이 폐업했을까요? "
            "저희는 확인해봤습니다. 제주 공식 관광 포털에 이용자가 접수한 정보 수정요청이 "
            "1,686건 쌓여 있습니다. 공식 데이터조차 이 속도로 낡습니다. "
            "그래서 저희는 짐 싸기 앱에 <b>신뢰 엔진</b>을 심었습니다. "
            "근거 있는 것만 담고, 없는 것은 정직하게 비웁니다."
        ),
        h3("포지셔닝 — 20팀 경쟁 구도"),
        para(
            "예상 타팀 분포는 제주 여행 RAG 챗봇 다수 + 이미지/멀티모달 데모 + "
            "일부 고급 아키텍처(해외 팀). 이 구도에서 우리가 이기는 세 겹의 논리:"
        ),
        *bullet_list([
            "<b>카테고리 이탈</b>: '챗봇'이 아니라 '여행 준비 프로덕트 + 신뢰 엔진'. 첫 화면부터 다르게 보인다.",
            "<b>흉내 불가 요소</b>: 이미 존재하던 실사용 앱(Pack Your Moment)에 이식했다는 사실. "
            "4일 만에 만든 게 아니라 4일 만에 <b>진화시킨</b> 것.",
            "<b>엔지니어링 깊이의 증거</b>: fallback 4분기 · 배지 체계 · eval 게이트 — "
            "말이 아니라 라이브로 보여준다. 기술 심사 방어선.",
        ]),
        Spacer(1, 4 * mm),
        callout(
            "발표에서 반복할 <b>세 단어</b>:<br/>"
            "<b>출처를 붙인다 · 최신만 답한다 · 안 지어낸다.</b>"
        ),
        PageBreak(),
    ]


def sec_problem() -> list:
    return [
        h1("2. 문제 정의 — 1,686건의 증거"),
        h3("실증 데이터"),
        para(
            "소스: 제주관광공사 비짓제주(VISIT JEJU) 콘텐츠수정요청 공개 CSV. "
            "이용자들이 <b>직접 접수한</b> 정보 정정 요청 총 <b>1,686건</b>."
        ),
        table_grid(
            ["카테고리", "건수", "비율", "성격"],
            [
                ["폐업/영업종료", "20", "1.2%", "물리적 변화 (원래 있던 게 없음)"],
                ["이전/위치변경", "26", "1.5%", "물리적 변화"],
                ["운영시간/휴무", "235", "13.9%", "물리적 변화"],
                ["주소/도로명", "91", "5.4%", "물리적 변화"],
                ["연락처/전화", "119", "7.1%", "정보 갱신"],
                ["메뉴/가격", "154", "9.1%", "정보 갱신"],
                ["상세정보 수정", "202", "12.0%", "정보 갱신"],
                ["사진/이미지", "108", "6.4%", "정보 갱신"],
                ["기타", "731", "43.4%", "혼합"],
            ],
            col_widths=(45 * mm, 20 * mm, 20 * mm, 85 * mm),
        ),
        Spacer(1, 4 * mm),
        h3("발표 프레이밍 (권장 A안)"),
        quote(
            "1,686건 중 <b>372건은 물리적 변화</b>입니다 — 폐업 20, 이전 26, "
            "운영시간 변경 235, 주소 91. 원래 있던 곳이 지금은 다른 상태입니다. "
            "공식 포털조차 이 속도로 낡습니다. 개인 블로그는 어떨까요?"
        ),
        h3("톱3 강조 (백업 B안)"),
        para(
            "톱 3만 봐도 <b>591건</b> — 운영시간/휴무 235, 상세정보 수정 202, 메뉴/가격 154. "
            "전체의 <b>35%</b>가 이미 부정확한 정보."
        ),
        h3("이 데이터가 발표에서 하는 일"),
        *bullet_list([
            "오프닝의 <b>실증 근거</b>: '문제가 있다'가 아니라 '문제가 이만큼 크다'.",
            "이후 '킥1 라이브 검증'과 <b>서사적으로 연결</b>: 공식 데이터도 낡는데, 리뷰는? → /verify 데모.",
            "골든셋 G09/G10/G14 (수정요청·폐업 시나리오)와 <b>실 데이터로 연결</b>.",
        ]),
        PageBreak(),
    ]


def sec_rules() -> list:
    return [
        h1("3. 절대 원칙 6가지 (팀 공통 헌법)"),
        para(
            "CLAUDE.md의 절대 규칙. 발표·데모·Q&A 어디에서든 이 6개를 위반하는 순간 "
            "서비스의 정체성이 무너집니다. <b>발표 대사도 이 원칙 위에서만 나옵니다.</b>"
        ),
        Spacer(1, 3 * mm),
        table_grid(
            ["#", "원칙", "실무 적용"],
            [
                ["1", "환각 금지 설계",
                 "LLM이 장소명·주소·운영시간 등 사실 정보를 생성하는 코드 <b>절대 금지</b>. "
                 "사실은 DB(place/food/transit) 조회값만 사용. LLM은 조립·판정만."],
                ["2", "fallback 4분기 준수",
                 "결과가 없을 때 뭉뚱그리지 않는다. reason ∈ "
                 "{out_of_scope, coverage_gap, retrieval_miss, contradicted} 중 하나로 분류."],
                ["3", "'없다' 단언 금지",
                 "coverage_gap일 때 문구는 <b>'저희가 참조하는 공공데이터 기준으로 확인되지 않습니다'</b>. "
                 "'그런 곳은 없습니다' 금지. contradicted일 때만 '폐업/변경이 확인됩니다' 적극 진술."],
                ["4", "원본 앱 보호",
                 "Pack Your Moment 원본 코드/DB 수정 금지. 이 저장소는 <b>독립 에디션</b>."],
                ["5", "모델 고정",
                 "LLM은 <b>gpt-5.3-mini</b> 하나. Gateway 추상화·모델 스왑 금지. "
                 "GPT-5 계열은 max_completion_tokens 파라미터."],
                ["6", "LLM 없이도 동작",
                 "OPENAI_API_KEY 미설정 시 조립은 템플릿 폴백, 검증은 규칙 기반. "
                 "데모 안전판 — 발표장에서 키가 죽어도 시연이 완주된다."],
            ],
            col_widths=(10 * mm, 55 * mm, 105 * mm),
        ),
        Spacer(1, 4 * mm),
        h3("발표에서 이 원칙이 화면으로 증명되는 지점"),
        *bullet_list([
            "원칙 1 → 킥1 /verify 데모 (LLM이 사실을 만들지 못하는 파이프라인).",
            "원칙 2·3 → 정직함 장면 (감귤 × 7월 · 우도 × 카페 coverage_gap 문구).",
            "원칙 6 → OPENAI_API_KEY 미설정 상태에서도 팩 생성이 완주됨을 라이브 시연.",
        ]),
        PageBreak(),
    ]


def sec_architecture() -> list:
    diagram = (
        "사용자 폼 입력 (regions · moments · days · companion · purpose)\n"
        "           │\n"
        "           ▼\n"
        "  ┌────────────────────────────────────────┐\n"
        "  │ filters.py   폼 → 검색 필터 (LLM 없음)  │\n"
        "  └────────────────────────────────────────┘\n"
        "           │\n"
        "           ▼\n"
        "  ┌────────────────────────────────────────┐\n"
        "  │ search.py    strict → relaxed 완화 재시도 │\n"
        "  └────────────────────────────────────────┘\n"
        "           │\n"
        "           ▼\n"
        "  ┌────────────────────────────────────────┐\n"
        "  │ trust.py     fallback 4분기 + 배지 4종  │\n"
        "  └────────────────────────────────────────┘\n"
        "           │\n"
        "           ▼\n"
        "  ┌────────────────────────────────────────┐\n"
        "  │ assemble.py  템플릿 폴백 or LLM 문구      │\n"
        "  │              + dispatch_itinerary (요일)  │\n"
        "  └────────────────────────────────────────┘\n"
        "           │\n"
        "           ▼\n"
        "  query_log → /admin/metrics (라이브 대시보드)\n"
        "\n"
        "──────────── 게이트 ────────────\n"
        "  packages/eval/run.py\n"
        "    verified_precision · fallback_accuracy · badge_accuracy\n"
        "    미달 시 exit(1) — 배포가 물리적으로 차단\n"
    )
    return [
        h1("4. 시스템 아키텍처 개요"),
        h3("파이프라인 (신뢰 엔진)"),
        code_block(diagram),
        h3("저장소 구조"),
        code_block(
            "pack-your-jeju/\n"
            "├── CLAUDE.md, DECISIONS.md, PRD.md, TRUST_ENGINE.md ...   문서 스위트\n"
            "├── apps/\n"
            "│   ├── api/                              FastAPI\n"
            "│   │   ├── main.py                       /pack /verify /health /admin/metrics\n"
            "│   │   │                                 /agent/parse /agent/chat /agent/intro\n"
            "│   │   ├── engine/\n"
            "│   │   │   ├── filters.py                폼 → 검색 필터\n"
            "│   │   │   ├── search.py                 place · food · transit_check\n"
            "│   │   │   ├── trust.py                  fallback 4분기 · 배지 산출\n"
            "│   │   │   ├── assemble.py               팩 조립 (LLM 문구 + 템플릿 폴백)\n"
            "│   │   │   ├── verify.py                 /verify 판정 (킥1 데모)\n"
            "│   │   │   ├── agent.py                  자연어 → PackRequest 파싱\n"
            "│   │   │   └── haruban.py                하루방 에이전트 (대화 + 도구, 능동 인사)\n"
            "│   │   └── logging.py                    query_log 적재\n"
            "│   ├── pipelines/                        데이터 수집 (visitjeju · CSV · TAGO)\n"
            "│   └── web/                              React/Vite 프론트 (Pack Your Moment 제주판)\n"
            "├── packages/\n"
            "│   ├── schema/init.sql                   권위 DDL\n"
            "│   └── eval/                             골든셋 러너 (배포 게이트)\n"
            "└── docs/                                 슬라이드·데모 대본·QR\n"
        ),
        h3("스택 요약"),
        table_2col([
            ("백엔드", "Python 3.11 · FastAPI · SQLAlchemy Core · psycopg3"),
            ("DB", "PostgreSQL + pgvector + pg_trgm (Railway)"),
            ("프론트", "React + Vite + TypeScript + Tailwind + motion (Vercel)"),
            ("LLM", "OpenAI gpt-5.3-mini (고정). 키 없으면 규칙/템플릿 폴백."),
            ("배포", "Railway (API + DB) · Vercel (프론트). Auto Deploy on push."),
            ("데이터", "비짓제주 API · 위생등급 CSV · 공영주차장 · TAGO 버스정류소 · 수정요청 CSV"),
        ]),
        PageBreak(),
    ]


def sec_workflow() -> list:
    return [
        h1("5. 실제 워크플로우 — 사용자 여정"),
        para(
            "실사용자 관점에서 서비스가 어떻게 흘러가는지, 각 지점에서 어떤 백엔드 로직이 도는지를 "
            "화면 단위로 정리합니다."
        ),
        h3("화면 1 — 여행 계획하기 (폼)"),
        table_2col([
            ("입력 필드", "지역 (다중 선택 12개 값) · 출발일/기간 · 동행자 · 목적 · 특별 노트(자유 텍스트)"),
            ("트리거", "지역 1개 + 순간 1개 최초 충족 시 <b>하루방이 능동 인사</b> (POST /agent/intro)"),
            ("백엔드", "filters.build_filters(req) → 검증. LLM 미개입."),
            ("정직 UX", "폼 값이 확정되기 전에도 하루방이 '저희 데이터로 확인된 곳'을 미리 브리핑."),
        ]),
        h3("화면 2 — 순간 고르기"),
        table_2col([
            ("카드", "오름/바다산책/노을/로컬시장/현지맛집/조용한카페/곶자왈/감귤 (MOMENT_CARDS.md 권위 문서)"),
            ("매핑", "moment → category (강 신호) + purpose → categories (약 신호, 완화용)"),
            ("액션", "'근거 있는 팩 받기' 클릭 → POST /pack"),
        ]),
        h3("화면 3 — 대시보드 (팩 결과)"),
        table_2col([
            ("응답 스키마", "sections[moment].items[] + fallback + itinerary[day] + packing_additions"),
            ("배지", "verified 🟢 · caution ⚠︎ · contradicted × · reference 🟠"),
            ("교통", "🅿️ 주차장 개수 · 🚌 정류장 근접 (하버사인 거리 계산)"),
            ("뷰", "순간별 뷰 · 요일별 뷰 (지역 다중 선택 시 dispatch_itinerary가 규칙 기반 배치)"),
            ("정직함", "빈 (region × moment) 조합 명시적 노출 — '확인되지 않았습니다' 문구"),
        ]),
        h3("화면 4 — 리뷰 검증 (/verify, 킥1 데모)"),
        table_2col([
            ("입력", "리뷰/블로그 원문 텍스트"),
            ("처리", "claim 분해 → 문장별 장소명 추출 → place fuzzy 매칭 → verdict 판정"),
            ("verdict", "verified · outdated · coverage_gap · contradicted (근거 URL 함께)"),
            ("발표 대사", "'이 리뷰의 문장, 폐업이 확인됩니다. 근거는 여기 있습니다.'"),
        ]),
        h3("가로지르는 관측"),
        *bullet_list([
            "모든 요청이 <b>query_log</b>에 적재 (badge_counts, fallback_reasons, latency_ms).",
            "GET /admin/metrics — 실시간 배지/폴백/지연 집계. 킥4 클로징 소스.",
            "coverage_gap 로그가 <b>데이터 보강 우선순위</b>가 됨 → 시스템이 스스로 부족한 곳을 안다.",
        ]),
        PageBreak(),
    ]


def sec_trust() -> list:
    return [
        h1("6. 트러스트 엔진 상세"),
        h3("fallback 4분기 (판정 순서 중요)"),
        table_grid(
            ["reason", "정의", "판정 신호", "사용자 문구"],
            [
                ["out_of_scope", "제주/여행 범위 밖", "region이 UI 값 밖", "'제주 여행 정보 범위 밖입니다'"],
                ["contradicted", "반증 존재", "tombstone=true 또는 수정요청에 폐업 명시",
                 "<b>'폐업/변경이 확인됩니다'</b> (유일하게 단언 허용)"],
                ["retrieval_miss", "DB엔 있는데 못 찾음", "strict 실패 → relaxed 재시도 후 실패",
                 "사용자 노출 전 재시도로 해소 시도"],
                ["coverage_gap", "데이터에 없음", "재시도 후에도 후보 없음",
                 "<b>'저희가 참조하는 공공데이터 기준으로 확인되지 않습니다'</b>"],
            ],
            col_widths=(30 * mm, 30 * mm, 45 * mm, 65 * mm),
        ),
        Spacer(1, 3 * mm),
        callout(
            "<b>인식론 규칙:</b> coverage_gap은 절대 '없다'고 단언하지 않는다 "
            "(우리 DB ≠ 세계 전체). contradicted만 적극 진술."
        ),
        h3("배지 판정 (항목 단위)"),
        table_grid(
            ["배지", "기호", "조건"],
            [
                ["verified", "🟢",
                 "place 존재 + valid_until > 여행일 + tombstone=false + 수정요청 이력 없음"],
                ["caution", "⚠︎",
                 "존재하지만 (수정요청 이력) or (요구 amenity 결측) or (valid_until 임박)"],
                ["contradicted", "×", "tombstone=true 또는 폐업/이전 반증"],
                ["reference", "🟠",
                 "공공데이터 검증이 아닌 참고 정보 (스트레치). verified와 시각적 명확 분리"],
            ],
            col_widths=(30 * mm, 15 * mm, 130 * mm),
        ),
        h3("판정 의사코드 (trust.py)"),
        code_block(
            "def judge_section(mf: MomentFilter) -> Section:\n"
            "    # 0. 반증 우선\n"
            "    if anchor := find_contradicted_anchor(mf):\n"
            "        return Section(items=[], fallback=Fallback('contradicted', anchor))\n"
            "\n"
            "    # 1. strict 검색 후보 있음 → 항목별 배지\n"
            "    strict = search_strict(mf)\n"
            "    if strict:\n"
            "        return Section(items=[badge_item(h, mf) for h in strict])\n"
            "\n"
            "    # 2. 완화 재시도 1회 (지역 확대: 읍면동 → 시 단위)\n"
            "    relaxed = search_relaxed(mf)\n"
            "    if relaxed:\n"
            "        return Section(\n"
            "            items=[badge_item(h, mf, note='인근 지역 결과') for h in relaxed],\n"
            "            observed_reasons=['retrieval_miss'],\n"
            "        )\n"
            "\n"
            "    # 3. coverage_gap (커버리지 통계를 로그에 첨부)\n"
            "    stats = coverage_stats(mf.region, mf.primary_category)\n"
            "    return Section(items=[], fallback=Fallback('coverage_gap', stats=stats))\n"
        ),
        h3("Freshness (info_type)"),
        table_grid(
            ["info_type", "대상", "valid_until 규칙"],
            [
                ["static", "주소, 시설, 상시 관광지", "수집일 + 90d"],
                ["seasonal", "해수욕장 개장, 감귤 체험, 축제",
                 "시즌 종료일 (못 채우면 <b>place에 넣지 않음</b>)"],
                ["periodic", "오일장", "주기 규칙(예: '2,7') — 여행일과 대조해 개장일 계산"],
            ],
            col_widths=(30 * mm, 55 * mm, 90 * mm),
        ),
        PageBreak(),
    ]


def sec_haruban() -> list:
    return [
        h1("7. 하루방 에이전트 — 능동 인사 흐름"),
        callout(
            "하루방(돌하르방)은 이 서비스의 캐릭터이자, 정직 원칙을 사용자에게 전달하는 매개체. "
            "폼과 별개의 챗봇이 아니라, <b>폼과 나란히 사는 상담사</b>로 설계."
        ),
        h3("세 가지 도구"),
        table_grid(
            ["도구", "역할", "정직 게이트"],
            [
                ["search_places", "지역 · 카테고리로 검증된 장소 조회",
                 "반환 결과 밖의 장소를 절대 지어내지 않음 (프롬프트로 명시)"],
                ["verify_claim", "리뷰/블로그 문장 팩트체크",
                 "verify.py의 판정을 그대로 재사용 — verdict + 근거 URL"],
                ["suggest_form_update", "폼에 반영할 값을 사용자에게 제안",
                 "사용자 승인 없이는 반영되지 않음. 빈 값 넣지 않음."],
            ],
            col_widths=(45 * mm, 55 * mm, 75 * mm),
        ),
        h3("능동 인사 (POST /agent/intro) — 신규"),
        para(
            "폼에서 <b>지역 1개 + 순간 1개가 최초로 채워지는 순간</b>, 우측 하단 하루방 위젯이 "
            "자동 팝업되며 첫 인사말과 하이라이트 카드 리스트를 띄운다. "
            "이 흐름은 결정론적이라 LLM이 없어도 카드 자체는 정상 노출된다."
        ),
        code_block(
            "폼 상태 (regions[], companion, purpose, moments[], days, start_date)\n"
            "     │\n"
            "     ▼\n"
            "  build_filters(req)\n"
            "     │\n"
            "     ▼   (LLM 없음 — 결정적 DB 조회)\n"
            "  각 moment × region 조합 → search_strict → badge_item\n"
            "     │\n"
            "     ▼\n"
            "  하이라이트 6개 선정 (verified 우선, 조합 다양성 라운드 로빈)\n"
            "  coverage 매트릭스 → (region × moment) 카운트\n"
            "  gaps 나열 (items=0 조합)\n"
            "     │\n"
            "     ▼   (선택적)\n"
            "  LLM: greeting + reason 한 줄만 (candidates 밖 id는 필터로 폐기)\n"
            "     │\n"
            "     ▼\n"
            "  응답: {greeting, highlights[card], coverage, gaps, llm_used}\n"
        ),
        h3("정직 원칙 준수 (프론트/백엔드 모두)"),
        *bullet_list([
            "카드의 <b>이름 · 주소 · 배지 · 근거 URL</b>은 100% DB값. LLM은 greeting과 reason 한 줄만.",
            "LLM 응답에서 candidates에 없는 external_id는 <b>무조건 폐기</b> (사실 생성 방지 게이트).",
            "OPENAI_API_KEY 미설정 시 templates greeting + reason 생략 — 카드는 정상 노출.",
            "폼 변경 시 채팅창 하단에 <b>'조건이 바뀌었어요. 다시 물어볼까요?'</b> 인라인 재요청 버튼.",
            "gap 조합은 항상 '저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다' 문구 (규칙 3).",
        ]),
        h3("발표에서의 하루방"),
        para(
            "발표 대본에는 하루방을 <b>메인 시연 축으로 넣지 않음</b> — "
            "핵심 서사(신뢰 엔진)를 흐리지 않기 위함. 대신 오프닝 폼 시연 중에 "
            "'폼을 채우자 하루방이 저희 데이터로 확인된 곳을 미리 브리핑해줍니다' 정도로 "
            "1문장 언급하고 자연스럽게 지나간다."
        ),
        PageBreak(),
    ]


def sec_data_and_gate() -> list:
    return [
        h1("8. 데이터 파이프라인 & 골든셋 게이트"),
        h3("데이터 소스 (확정)"),
        table_grid(
            ["#", "소스", "역할", "적재 결과"],
            [
                ["S1", "비짓제주 API (키 있음)",
                 "관광지·카페·음식·체험 — 카드 8종의 주력", "place 4,422건"],
                ["S2", "위생등급/모범음식점 CSV",
                 "local_food 배지 보강", "food.hygiene_grade (P2, 스킵 가능)"],
                ["S3", "공영주차장 CSV (공공데이터포털)",
                 "교통 배지 🅿️", "transit_point 1,557건"],
                ["S4", "TAGO 버스정류소 API (국토부)",
                 "교통 배지 🚌", "transit_point 4,271건"],
                ["S5", "비짓제주 콘텐츠수정요청 CSV (1,686건)",
                 "신뢰 하향 신호 + 킥3 오프닝 근거", "place.has_fix_request 556건 매칭"],
            ],
            col_widths=(10 * mm, 45 * mm, 65 * mm, 55 * mm),
        ),
        h3("스키마 핵심 (packages/schema/init.sql)"),
        code_block(
            "-- valid_until NOT NULL: '못 채우면 place에 못 들어감' 원칙을 스키마로 강제\n"
            "CREATE TABLE place (\n"
            "  id BIGSERIAL PRIMARY KEY,\n"
            "  external_id TEXT UNIQUE,\n"
            "  name TEXT NOT NULL,\n"
            "  category TEXT NOT NULL,\n"
            "  region_normalized TEXT NOT NULL,  -- 12개 UI 값과 1:1\n"
            "  address TEXT,\n"
            "  lat DOUBLE PRECISION, lng DOUBLE PRECISION,\n"
            "  info_type TEXT NOT NULL,          -- static | seasonal | periodic\n"
            "  valid_until TIMESTAMPTZ NOT NULL, -- 원칙을 강제한다\n"
            "  periodic_rule TEXT,               -- 오일장: '2,7'\n"
            "  amenities JSONB DEFAULT '{}',\n"
            "  has_fix_request BOOLEAN DEFAULT false,   -- S5 매핑 결과\n"
            "  tombstoned BOOLEAN DEFAULT false,\n"
            "  source_url TEXT\n"
            ");\n"
        ),
        h3("골든셋 15문항 (packages/eval/run.py)"),
        para(
            "개수보다 <b>fallback 4분기와 배지 체계를 전부 커버</b>하는 것이 우선. "
            "'답을 잘하는 케이스'만이 아니라 <b>'답하지 않아야 정답인 케이스'</b>를 반드시 포함."
        ),
        table_grid(
            ["지표", "정의", "게이트"],
            [
                ["Verified Precision", "verified 배지 항목 중 골든셋 정답과 일치 비율", "≥ 0.9"],
                ["Fallback Accuracy", "fallback 케이스에서 올바른 reason으로 분류한 비율", "≥ 0.9"],
                ["Badge Accuracy", "caution/contradicted 기대 케이스의 배지 일치율", "≥ 0.8"],
            ],
            col_widths=(50 * mm, 100 * mm, 25 * mm),
        ),
        Spacer(1, 3 * mm),
        callout(
            "발표 멘트: <b>'이 게이트를 통과하지 못하면 저희는 배포하지 않습니다.'</b><br/>"
            "eval.py의 <b>exit(1)</b>이 이 문장의 실제 구현. "
            "최근 실행 결과: <b>12/12 통과, 3지표 모두 1.00</b> (data/eval-reports/eval-*.md)."
        ),
        h3("데모 시나리오와 직결되는 문항 (★)"),
        table_2col([
            ("G05 · citrus × 7월", "coverage_gap 또는 '시즌 아님' 명시 — Freshness 핵심 데모"),
            ("G11 · quiet_cafe × 우도", "coverage_gap + '저희 데이터 기준' 문구 — 인식론 규칙"),
            ("G13 · /verify 존재하지 않는 가게", "coverage_gap ('확인되지 않음') — '없다' 단언 금지"),
            ("G14 · /verify 폐업 가게 (킥1)", "contradicted + 근거 — 킥1 라이브 시연 시나리오"),
        ]),
        PageBreak(),
    ]


def sec_presentation() -> list:
    return [
        h1("9. 발표 3막 구성 (10분)"),
        para(
            "docs/slides_script.md의 대본을 압축. 총 10분 (오프닝 1.5 + 본편 5 + 클로징 1.5 + Q&A 2)."
        ),
        h3("Prolog — T-5분 체크리스트"),
        *bullet_list([
            "브라우저 두 탭: (a) pack-your-jeju.vercel.app  (b) /admin/metrics?window_hours=1",
            "로컬 백업 노트북 웜업 (docker + uvicorn)",
            "스크린 녹화 파일 위치 확인 (라이브 실패 시 재생)",
            "QR (docs/qr.png) 슬라이드 · 발표장 Wi-Fi 스캔 테스트",
            "Q&A 대응 카드 물리 프린트",
        ]),
        h3("1막 — 오프닝 · 킥3 '1,686건의 증거' (1.5분)"),
        quote(
            "여행 앱들은 '가성비 맛집', '숨은 명소'를 말합니다. 그중 폐업한 곳이 얼마나 될까요? "
            "저희는 확인해봤습니다. 비짓제주 — 제주 공식 관광 포털입니다. "
            "여기에 이용자가 접수한 수정요청이 <b>1,686건</b>. 저희가 전부 분석했습니다. "
            "폐업 20 · 이전 26 · 운영시간 변경 235 · 주소 91 — <b>372건이 물리적 변화</b>입니다. "
            "공식 데이터조차 이 속도로 낡습니다. 개인 블로그는 어떨까요? "
            "그래서 저희는 짐 싸기 앱에 <b>신뢰 엔진</b>을 심었습니다."
        ),
        para("<b>기억할 세 숫자:</b> 1,686 → 556 → 372."),
        h3("2막 — 본편 · 제품 데모 (5분)"),
        table_grid(
            ["장면", "시간", "화면 액션", "핵심 대사"],
            [
                ["2-1. 팩 만들기", "1'",
                 "구좌 · 연인 · 힐링 · 3일 · 오름/바다/맛집 → '팩 받기'",
                 "'배지 · 주차 · 정류장이 함께 표시됩니다.'"],
                ["2-2. 정직함 ① 감귤 × 7월", "40\"",
                 "순간에 감귤 체험 추가 → 재조립",
                 "'저희는 7월에 감귤을 지어내지 않습니다.'"],
                ["2-3. 요일별 뷰 (다중 지역)", "1'",
                 "애월·성산·서귀포 → 요일별 탭",
                 "'없는 조합은 정직하게 확인되지 않았다고 말합니다.'"],
                ["2-4. 킥1 /verify (하이라이트)", "1.5'",
                 "리뷰 3문장 붙여넣기 → 검증",
                 "'폐업이 확인됩니다. 근거는 여기 있습니다.'"],
                ["2-5. 아키텍처 1장 · 게이트", "30\"",
                 "다이어그램 슬라이드",
                 "'게이트 미달이면 exit(1) — 배포가 물리적으로 차단됩니다.'"],
            ],
            col_widths=(35 * mm, 15 * mm, 60 * mm, 65 * mm),
        ),
        h3("3막 — 클로징 · 킥4 QR + 라이브 대시보드 (1.5분)"),
        quote(
            "지금 직접 만들어보시죠. (QR 노출) 저희가 준비한 데이터: "
            "관광지·음식점 4,422건 · 수정요청 이력 556건 · 주차장 1,557 · 정류장 4,271 · "
            "골든셋 12/12 통과. (30초 후 /admin/metrics 전환) "
            "<b>방금 여러분이 만든 팩들입니다.</b> 저희는 발표하는 동안에도 운영 중이었습니다."
        ),
        para(
            "<b>마지막 슬라이드 로드맵:</b> 지역 팩 확장 (부산·도쿄) → 여행 일정 전체 검증 → "
            "다국어 UI (비짓제주 en/cn/jp locale)."
        ),
        callout(
            "<b>마무리 세 문장:</b><br/>"
            "'저희는 모든 곳을 아는 척하는 대신, 제주부터 완벽하게 하기로 했습니다. "
            "근거가 있는 것만 말합니다. 최신 정보만 답합니다. 지어내지 않습니다. "
            "Pack Your Jeju입니다.'"
        ),
        PageBreak(),
    ]


def sec_qa() -> list:
    return [
        h1("10. 예상 Q&A 카드"),
        para("Q&A는 심사 방어선. 대사는 <b>30초 이내</b>에 끝나야 한다."),
        table_grid(
            ["질문", "답변 골자"],
            [
                ["근거 없음과 정보 부족을 어떻게 구별하나?",
                 "fallback 4분기로 구분: 범위 밖 / 데이터에 없음 / 못 찾음(재시도 후) / 반증 있음. "
                 "어떤 경우에도 '없다'고 단언하지 않고 '저희 데이터 기준'을 명시. "
                 "사유는 전부 로깅되어 데이터 보강 우선순위가 됩니다."],
                ["일반 GPT와 뭐가 다른가?",
                 "GPT는 그럴듯하게 지어냅니다. 저희 LLM은 사실을 <b>생성할 권한이 없습니다</b> — "
                 "DB가 사실을 대고 LLM은 조립만. 지어낼 바엔 '확인 불가'라고 말합니다."],
                ["데이터가 오래되면?",
                 "valid_until이 스키마 레벨로 강제됩니다 (NOT NULL). 못 채우면 DB에 못 들어갑니다. "
                 "감귤 데모가 그 증거."],
                ["왜 제주만? (실용성)",
                 "지역 팩 아키텍처. 데이터 어댑터만 갈아끼우면 부산 팩, 도쿄 팩. "
                 "모든 곳을 아는 척하는 대신 제주부터 완벽하게."],
                ["커버리지가 좁은데 실용성이 있나?",
                 "coverage_gap 로그가 곧 데이터 보강 우선순위. 시스템이 스스로 부족한 곳을 압니다. "
                 "/admin/metrics에서 실시간 관측 가능."],
                ["품질을 어떻게 보장하나?",
                 "골든셋 15문항 게이트. 그중 4문항은 '답하지 않아야 정답'인 케이스. "
                 "미달이면 exit(1) — 배포가 물리적으로 차단."],
                ["게이트가 실패하면?",
                 "eval 실패 로그 캡처 1장으로 답변. main에 머지 금지."],
                ["챗봇 안 만든 이유?",
                 "챗봇은 '뭔가를 지어내는' 압박이 있습니다. 폼은 검증 필터를 이미 제공하므로 "
                 "LLM이 사실을 만들 권한을 안 가져도 됩니다."],
                ["이게 RAG인가?",
                 "네. /verify가 정통 RAG: LLM이 문장을 분해 → 저희 DB에서 근거를 찾음 → LLM 판정. "
                 "사실 생성은 없습니다. /pack은 구조화 검색 + LLM 조립."],
                ["교통 배지는 어떻게 검증하나요?",
                 "공공데이터포털 공영주차장 CSV (1,557건, 2026-04-16 갱신)와 "
                 "국토부 TAGO 버스정류소 API (4,271건). 위치만 검증 — 실시간 잔여 대수는 판단하지 않음."],
                ["카카오/네이버는요?",
                 "저희는 <b>근거로 인정하지 않습니다.</b> 대신 /verify에 입력값으로 받아 팩트체크는 해드립니다."],
                ["수익 모델은?",
                 "기술적 자산 자체가 관심. B2B 여행사 검증 API나 지자체 관광포털에 붙일 수 있습니다."],
            ],
            col_widths=(55 * mm, 120 * mm),
        ),
        PageBreak(),
    ]


def sec_risk() -> list:
    return [
        h1("11. 데모 리스크 관리 & 백업"),
        h3("실패 시나리오 대비"),
        table_grid(
            ["리스크", "1차 대응", "최종 백업"],
            [
                ["팩 생성 실패 (API 다운)", "로컬 백업 노트북 uvicorn으로 즉시 전환",
                 "사전 캡처 스크린샷 슬라이드"],
                ["/verify 응답 지연", "사전 준비한 스크린 녹화 재생",
                 "슬라이드에 결과 이미지 미리 삽입"],
                ["애월오누이 시나리오 미노출", "슬라이드에 캡처 이미지 미리 삽입",
                 "대안 대사: '이 케이스는 골든셋 G14로도 재현됩니다'"],
                ["감귤 fallback 미노출", "date를 수동으로 밀어 재시도", "슬라이드 캡처"],
                ["/admin/metrics 지연", "JSON 미리 캡처해 슬라이드 이미지로",
                 "URL 직접 노출"],
                ["QR 스캔 실패", "URL 직접 텍스트 노출 (pack-your-jeju.vercel.app)",
                 "'스캔 안 되시면 URL로 열어주세요' 대사"],
                ["발표장 Wi-Fi 죽음", "휴대폰 핫스팟", "로컬 노트북 화면만으로 진행"],
                ["OPENAI_API_KEY 오류", "이미 폴백으로 완주됨 (원칙 6)",
                 "'LLM이 없어도 팩은 완주됩니다' 대사로 오히려 강점화"],
            ],
            col_widths=(45 * mm, 60 * mm, 70 * mm),
        ),
        h3("현재 알려진 이슈"),
        *bullet_list([
            "Railway Auto Deploy 근본 원인 미해결 — 'Check for updates' 수동 갱신은 됨.",
            "OPENAI_API_KEY 미설정 상태 (아이펠톤 발표 전 사용자 준비 예정) → 현재 llm_used=false, "
            "카드/팩은 정상 노출.",
            "위생등급 CSV 미적재 — 발표 흐름에 영향 없음 (P2 스킵 가능).",
        ]),
        h3("심사 항목 자기 점검"),
        *bullet_list([
            "문제 정의가 실증 데이터(1,686건)로 시작되는가",
            "데모에서 성공 장면과 <b>정직한 실패 장면</b>이 둘 다 나오는가 (G05/G11)",
            "기술 깊이(4분기·게이트)가 말이 아니라 화면/로그로 증명되는가",
            "'이건 RAG인가?' 답변이 30초 안에 나오는가 (/verify 다이어그램)",
            "'이미 존재하는 앱의 진화' 서사가 오프닝과 클로징에 모두 걸리는가",
            "확장 로드맵(지역 팩 아키텍처)이 마지막 슬라이드에 명확한가",
        ]),
        PageBreak(),
    ]


def sec_actions() -> list:
    return [
        h1("12. 팀 액션 아이템 (발표 전 체크리스트)"),
        h3("D-1 (발표 전날)"),
        *bullet_list([
            "골든셋 게이트 최종 실행 → 12/12 통과 캡처 저장 (data/eval-reports/)",
            "전 구간 스크린 녹화 (킥1 · /pack · 요일별 뷰 · /admin/metrics)",
            "리허설 2회 이상 (대사 · 화면 액션 · 시간 배분)",
            "OPENAI_API_KEY 최종 세팅 확인 (Railway Variables)",
            "발표장 Wi-Fi에서 프로덕션 URL · QR 실측 성공 확인",
            "Q&A 대응 카드 프린트 (§10 표 그대로)",
        ]),
        h3("D-day 아침"),
        *bullet_list([
            "Health check: /health · /pack · /verify · /agent/intro · /admin/metrics 각 1회",
            "로컬 백업 노트북 웜업 완료 상태 유지 (docker + uvicorn)",
            "브라우저 두 탭 열어두고 즐겨찾기 등록",
            "발표 5분 전: 시계 확인, 대본 마지막 세 문장 한 번 리마인드",
        ]),
        h3("발표 중 절대 지킬 3가지"),
        callout(
            "1. <b>coverage_gap 문구</b>는 반드시 '저희가 참조하는 공공데이터 기준으로 "
            "확인되지 않습니다'로 말한다.<br/>"
            "2. <b>contradicted</b>일 때만 '확인됩니다'로 단언한다.<br/>"
            "3. '가장 좋은' '반드시 가야 하는' 같은 <b>단정 표현 금지</b> — "
            "'저희 데이터로 확인된' 톤을 유지."
        ),
        h3("발표 후"),
        *bullet_list([
            "심사평 기록 (특히 지적 사항) → DECISIONS.md에 반영",
            "Q&A에서 준비 못 했던 질문 있으면 §10 표에 추가",
            "결과와 무관하게 데모 URL은 살려두기 (지속 관측용)",
        ]),
        Spacer(1, 12 * mm),
        callout(
            "<b>한 문장 원칙:</b><br/>"
            "근거 없이 답하지 않는다. 못 채우는 카테고리가 나오는 것이 버그가 아니라, "
            "이 시스템이 정직하다는 증거다."
        ),
        Spacer(1, 8 * mm),
        para("<b>참조 문서:</b>", "body_tight"),
        para("· CLAUDE.md · DECISIONS.md · PRD.md · TRUST_ENGINE.md · MOMENT_CARDS.md", "small"),
        para("· DATA_PIPELINE.md · EVAL_GOLDENSET.md · PLAN_4DAYS.md · DEMO_PRESENTATION.md", "small"),
        para("· docs/slides_script.md · docs/kick3_stats.md · docs/rehearsal.md · docs/qa_cards.md", "small"),
        para("· DEPLOYMENT_STATUS.md (프로덕션 상태 스냅샷)", "small"),
    ]


# ─────────────────────────────────────────────────────────

def build() -> Path:
    out = Path("docs") / "team_briefing.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = _build_doc(out)

    story: list = []
    story += sec_cover()
    story += sec_toc()
    story += sec_identity()
    story += sec_problem()
    story += sec_rules()
    story += sec_architecture()
    story += sec_workflow()
    story += sec_trust()
    story += sec_haruban()
    story += sec_data_and_gate()
    story += sec_presentation()
    story += sec_qa()
    story += sec_risk()
    story += sec_actions()

    doc.build(story)
    return out


if __name__ == "__main__":
    p = build()
    print(f"generated: {p.resolve()}  size={p.stat().st_size:,} bytes")
