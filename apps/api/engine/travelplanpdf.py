from __future__ import annotations

import html
import io
from datetime import timedelta
from typing import Any, Iterable
from urllib.parse import quote_plus

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from apps.api.engine import packpdf


SEA = colors.HexColor("#164E63")
SEA_LIGHT = colors.HexColor("#DDF2ED")
SKY = colors.HexColor("#E9F5F2")
INK = colors.HexColor("#263238")
INK_SOFT = colors.HexColor("#5E6668")
SAND = colors.HexColor("#FBF5E9")
PAPER = colors.HexColor("#FFFCF7")
LINE = colors.HexColor("#DDD2C2")
ORANGE = packpdf.CITRUS
ORANGE_DARK = packpdf.CITRUS_2
GREEN = packpdf.MINT

REGION_LABELS = packpdf.REGION_LABEL_KO
COMPANION_LABELS = packpdf.COMPANION_LABEL_KO
PURPOSE_LABELS = packpdf.PURPOSE_LABEL_KO
MOMENT_LABELS = packpdf.MOMENT_LABEL_KO

SOURCE_LABELS = {
    "public_data": "공공데이터",
    "web_search": "하루방 웹검색",
    "user_added": "직접 추가",
}
CHECK_LABELS = {
    "operating": "운영시간",
    "web_source": "웹 원문",
    "parking": "주차",
    "weather": "날씨",
    "movement": "이동 동선",
    "reservation": "예약",
    "price": "요금",
}


def _safe(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def _paragraph_text(value: Any) -> str:
    return _safe(value).replace("\n", "<br/>")


def _status(item: Any) -> tuple[str, colors.Color]:
    if item.source == "user_added":
        return "직접 추가·미검증", ORANGE_DARK
    if item.source == "public_data" and item.badge == "verified":
        return "확인됨", GREEN
    return "방문 전 재확인", ORANGE_DARK


def _source_label(item: Any) -> str:
    return SOURCE_LABELS.get(item.source, "출처 확인 필요")


def _label(value: str, labels: dict[str, str]) -> str:
    return labels.get(value, value)


def _styles() -> dict[str, ParagraphStyle]:
    regular = packpdf.FONT_REGULAR
    bold = packpdf.FONT_BOLD
    return {
        "cover_kicker": ParagraphStyle(
            "passport-cover-kicker",
            fontName=bold,
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#FFB26B"),
            spaceAfter=7,
        ),
        "cover_title": ParagraphStyle(
            "passport-cover-title",
            fontName=bold,
            fontSize=28,
            leading=38,
            textColor=colors.white,
            spaceAfter=12,
        ),
        "cover_subtitle": ParagraphStyle(
            "passport-cover-subtitle",
            fontName=regular,
            fontSize=12,
            leading=20,
            textColor=colors.HexColor("#D8ECEC"),
            spaceAfter=8,
        ),
        "cover_meta": ParagraphStyle(
            "passport-cover-meta",
            fontName=regular,
            fontSize=10,
            leading=16,
            textColor=colors.white,
        ),
        "eyebrow": ParagraphStyle(
            "passport-eyebrow",
            fontName=bold,
            fontSize=9,
            leading=12,
            textColor=ORANGE_DARK,
            spaceAfter=4,
        ),
        "h1": ParagraphStyle(
            "passport-h1",
            fontName=bold,
            fontSize=23,
            leading=30,
            textColor=SEA,
            spaceAfter=7,
        ),
        "h2": ParagraphStyle(
            "passport-h2",
            fontName=bold,
            fontSize=15,
            leading=20,
            textColor=INK,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "passport-body",
            fontName=regular,
            fontSize=9.5,
            leading=15,
            textColor=INK,
        ),
        "small": ParagraphStyle(
            "passport-small",
            fontName=regular,
            fontSize=8,
            leading=12,
            textColor=INK_SOFT,
        ),
        "ticket_title": ParagraphStyle(
            "passport-ticket-title",
            fontName=bold,
            fontSize=13,
            leading=17,
            textColor=INK,
            spaceAfter=2,
        ),
        "ticket_meta": ParagraphStyle(
            "passport-ticket-meta",
            fontName=regular,
            fontSize=8.5,
            leading=13,
            textColor=INK_SOFT,
            spaceAfter=2,
        ),
        "chip": ParagraphStyle(
            "passport-chip",
            fontName=bold,
            fontSize=7.5,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "center": ParagraphStyle(
            "passport-center",
            fontName=regular,
            fontSize=9,
            leading=14,
            textColor=INK_SOFT,
            alignment=TA_CENTER,
        ),
        "evidence_title": ParagraphStyle(
            "passport-evidence-title",
            fontName=bold,
            fontSize=10,
            leading=14,
            textColor=INK,
        ),
    }


class _OrangeRule(Flowable):
    def __init__(self, width: float = 30 * mm):
        super().__init__()
        self.width = width
        self.height = 3

    def draw(self) -> None:
        self.canv.setStrokeColor(ORANGE)
        self.canv.setLineWidth(2.5)
        self.canv.line(0, 1, self.width, 1)


def _draw_cover(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(SEA)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)

    canvas.setFillColor(colors.HexColor("#1D6370"))
    canvas.circle(width - 25 * mm, height - 28 * mm, 38 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#255F55"))
    canvas.circle(width - 10 * mm, 24 * mm, 70 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#E8793A"))
    canvas.circle(27 * mm, height - 27 * mm, 7 * mm, stroke=0, fill=1)

    canvas.setStrokeColor(colors.HexColor("#72AFA0"))
    canvas.setLineWidth(1)
    for offset in range(0, 7):
        y = 32 * mm + offset * 4 * mm
        canvas.line(18 * mm, y, width - 18 * mm, y + 2 * mm)
    canvas.restoreState()


def _draw_body(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(17 * mm, 13 * mm, width - 17 * mm, 13 * mm)
    canvas.setFont(packpdf.FONT_REGULAR, 7.5)
    canvas.setFillColor(INK_SOFT)
    canvas.drawString(17 * mm, 8.5 * mm, "PACK YOUR JEJU · MY TRAVEL PASSPORT")
    canvas.drawRightString(width - 17 * mm, 8.5 * mm, f"{doc.page}")
    canvas.restoreState()


def _summary_card(label: str, value: str, styles: dict[str, ParagraphStyle]) -> Table:
    data = [
        [Paragraph(_safe(label), styles["eyebrow"])],
        [Paragraph(_paragraph_text(value), styles["body"])],
    ]
    table = Table(data, colWidths=[80 * mm], rowHeights=[8 * mm, 19 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SKY),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9D8D2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def _qr_drawing(item: Any) -> Drawing:
    query = " ".join(part for part in [item.name, item.address] if part)
    target = f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"
    widget = QrCodeWidget(target)
    size = 24 * mm
    widget.barWidth = size
    widget.barHeight = size
    drawing = Drawing(size, size)
    drawing.add(widget, name="qr")
    return drawing


def _ticket(item: Any, styles: dict[str, ParagraphStyle]) -> KeepTogether:
    status_label, status_color = _status(item)
    source = _source_label(item)
    check_labels = [CHECK_LABELS.get(value, value) for value in item.check_required]
    checked = (
        item.checked_at.strftime("%Y.%m.%d %H:%M")
        if item.checked_at
        else "확인 시점 없음"
    )
    status_chip = Table(
        [[Paragraph(_safe(status_label), styles["chip"])]],
        colWidths=[35 * mm],
        rowHeights=[6 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), status_color),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        ),
    )

    detail_parts: list[Flowable] = [
        Paragraph(_paragraph_text(item.name), styles["ticket_title"]),
    ]
    if item.start_time:
        fixed_label = " · 고정 일정" if item.fixed else ""
        detail_parts.append(
            Paragraph(
                _paragraph_text(f"{item.start_time}{fixed_label}"),
                styles["ticket_meta"],
            )
        )
    address_copy = (
        item.address
        or (
            "사용자가 직접 입력한 일정입니다."
            if item.source == "user_added"
            else "주소는 여행 전 확인해 주세요."
        )
    )
    detail_parts.append(
        Paragraph(_paragraph_text(address_copy), styles["ticket_meta"])
    )
    if item.memo:
        detail_parts.extend(
            [
                Spacer(1, 1.5 * mm),
                Paragraph(f"<b>나의 메모</b> · {_paragraph_text(item.memo)}", styles["body"]),
            ]
        )
    detail_parts.extend(
        [
            Spacer(1, 1.5 * mm),
            Table(
                [
                    [
                        Paragraph(_safe(source), styles["small"]),
                        status_chip,
                    ]
                ],
                colWidths=[76 * mm, 35 * mm],
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            ),
            Paragraph(
                _paragraph_text(
                    f"확인: {checked}"
                    + (f" · 재확인: {', '.join(check_labels)}" if check_labels else "")
                ),
                styles["small"],
            ),
        ]
    )
    if item.source_url:
        url = _safe(item.source_url)
        title = _safe(item.source_title or "근거 원문")
        detail_parts.append(
            Paragraph(f'<link href="{url}" color="#C55A18">{title} · 원문 열기</link>', styles["small"])
        )

    inner = Table(
        [[detail_parts, _qr_drawing(item)]],
        colWidths=[119 * mm, 28 * mm],
        style=TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 4 * mm),
                ("LEFTPADDING", (1, 0), (1, 0), 2 * mm),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        ),
    )
    card = Table([[inner]], colWidths=[159 * mm])
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
            ]
        )
    )
    return KeepTogether([card, Spacer(1, 4 * mm)])


def _ordered(items: Iterable[Any], day: int) -> list[Any]:
    return sorted(
        (item for item in items if item.day == day),
        key=lambda item: (item.order, item.name),
    )


def _day_date(body: Any, day: int) -> str:
    value = body.travel.start_date + timedelta(days=day - 1)
    return value.strftime("%Y년 %m월 %d일")


def _evidence_row(item: Any, styles: dict[str, ParagraphStyle]) -> Table:
    status_label, status_color = _status(item)
    title = item.source_title or _source_label(item)
    details = [
        Paragraph(_paragraph_text(item.name), styles["evidence_title"]),
        Paragraph(
            _paragraph_text(f"{_source_label(item)} · {title}"),
            styles["small"],
        ),
    ]
    if item.source_url:
        details.append(
            Paragraph(
                f'<link href="{_safe(item.source_url)}" color="#C55A18">근거 원문 열기</link>',
                styles["small"],
            )
        )
    chip = Table(
        [[Paragraph(_safe(status_label), styles["chip"])]],
        colWidths=[37 * mm],
        rowHeights=[6 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), status_color),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        ),
    )
    row = Table([[details, chip]], colWidths=[116 * mm, 39 * mm])
    row.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return row


def build_travel_plan_pdf(body: Any) -> bytes:
    fonts_ok, diagnostics = packpdf._ensure_fonts()
    if not fonts_ok:
        raise RuntimeError(f"PDF 한글 폰트를 준비하지 못했습니다: {diagnostics}")

    styles = _styles()
    buffer = io.BytesIO()
    width, height = A4
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=body.title,
        author="Pack Your Jeju",
        subject="근거와 메모를 함께 담은 제주 여행 패스포트",
    )
    cover_frame = Frame(
        22 * mm,
        25 * mm,
        width - 44 * mm,
        height - 50 * mm,
        id="cover-frame",
        showBoundary=0,
    )
    body_frame = Frame(
        20 * mm,
        17 * mm,
        width - 40 * mm,
        height - 34 * mm,
        id="body-frame",
        showBoundary=0,
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=_draw_cover),
            PageTemplate(id="body", frames=[body_frame], onPage=_draw_body),
        ]
    )

    region_text = " · ".join(_label(region, REGION_LABELS) for region in body.travel.regions)
    companion = _label(body.travel.companion, COMPANION_LABELS)
    purpose = _label(body.travel.purpose, PURPOSE_LABELS)
    period_end = body.travel.start_date + timedelta(days=body.travel.days - 1)
    period_text = (
        f"{body.travel.start_date.strftime('%Y.%m.%d')} - "
        f"{period_end.strftime('%Y.%m.%d')} · {body.travel.days}일"
    )

    story: list[Flowable] = [
        Spacer(1, 26 * mm),
        Paragraph("PACK YOUR JEJU · TRAVEL PASSPORT", styles["cover_kicker"]),
        Paragraph(_paragraph_text(body.title), styles["cover_title"]),
        Paragraph(
            "고른 장소와 근거, 여행 중 확인할 일을 한 권에 담았습니다.",
            styles["cover_subtitle"],
        ),
        Spacer(1, 10 * mm),
        _OrangeRule(),
        Spacer(1, 9 * mm),
        Paragraph(_paragraph_text(period_text), styles["cover_meta"]),
        Paragraph(_paragraph_text(region_text or "제주"), styles["cover_meta"]),
        Paragraph(_paragraph_text(f"{companion} · {purpose}"), styles["cover_meta"]),
        Spacer(1, 68 * mm),
        Paragraph(
            "이 플랜은 출발점입니다.<br/>"
            "운영시간·날씨·이동 동선은 출발 전에 한 번 더 확인해 주세요.",
            styles["cover_subtitle"],
        ),
        NextPageTemplate("body"),
        PageBreak(),
        Paragraph("TRIP AT A GLANCE", styles["eyebrow"]),
        Paragraph("이번 제주 여행, 한눈에 보기", styles["h1"]),
        Paragraph(
            "하루방 추천, 공공데이터 장소, 직접 추가한 순간을 날짜별로 정리했습니다. "
            "각 장소의 상태와 근거를 함께 확인하면 여행 중 예상 밖의 변화를 줄일 수 있습니다.",
            styles["body"],
        ),
        Spacer(1, 7 * mm),
        Table(
            [
                [
                    _summary_card("여행 기간", period_text, styles),
                    _summary_card("여행 지역", region_text or "제주", styles),
                ],
                [
                    _summary_card("여행 방식", f"{companion} · {purpose}", styles),
                    _summary_card("담은 장소", f"{len(body.items)}곳 · {body.travel.days}일", styles),
                ],
            ],
            colWidths=[82 * mm, 82 * mm],
            rowHeights=[31 * mm, 31 * mm],
            hAlign="LEFT",
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                ]
            ),
        ),
        Spacer(1, 7 * mm),
        Paragraph("내가 고른 순간", styles["h2"]),
        Paragraph(
            _paragraph_text(
                " · ".join(_label(moment, MOMENT_LABELS) for moment in body.travel.moments)
                or "선택한 여행 순간 없음"
            ),
            styles["body"],
        ),
        Spacer(1, 8 * mm),
        Table(
            [
                [
                    Paragraph(
                        "<b>작은 약속</b><br/>QR은 지도 검색으로 연결됩니다. "
                        "웹검색 장소와 직접 추가 장소는 방문 전 주소와 운영 상태를 다시 확인해 주세요.",
                        styles["body"],
                    )
                ]
            ],
            colWidths=[164 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF0E3")),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#F3B78B")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
                ]
            ),
        ),
        PageBreak(),
    ]

    for day in range(1, body.travel.days + 1):
        story.extend(
            [
                Paragraph(f"DAY {day} · {_safe(_day_date(body, day))}", styles["eyebrow"]),
                Paragraph(f"Day {day}", styles["h1"]),
                Paragraph(
                    f"{day}일차에 담은 장소를 순서대로 확인하세요. "
                    "QR을 스캔하면 지도에서 다시 찾을 수 있습니다.",
                    styles["body"],
                ),
                Spacer(1, 6 * mm),
            ]
        )
        day_items = _ordered(body.items, day)
        if day_items:
            for item in day_items:
                story.append(_ticket(item, styles))
        else:
            story.append(
                Table(
                    [[Paragraph("아직 정한 장소가 없습니다. 여백도 여행의 일부입니다.", styles["center"])]],
                    colWidths=[164 * mm],
                    rowHeights=[38 * mm],
                    style=TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, -1), SKY),
                            ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ]
                    ),
                )
            )
        story.append(PageBreak())

    packing = body.packing_items or [
        "휴대전화와 보조배터리",
        "날씨에 맞는 겉옷",
        "편한 신발",
        "예약 및 운영시간 재확인",
    ]
    packing_rows = []
    for index, item in enumerate(packing, start=1):
        packing_rows.append(
            [
                Paragraph(f"{index:02d}", styles["eyebrow"]),
                Paragraph(f"□ {_paragraph_text(item)}", styles["body"]),
            ]
        )
    story.extend(
        [
            Paragraph("READY TO GO", styles["eyebrow"]),
            Paragraph("여행 준비 체크리스트", styles["h1"]),
            Paragraph(
                "준비물을 챙긴 뒤 네모 칸에 직접 표시해 보세요. "
                "여행 전날에는 날씨, 운영시간, 예약 여부를 마지막으로 확인합니다.",
                styles["body"],
            ),
            Spacer(1, 7 * mm),
            Table(
                packing_rows,
                colWidths=[16 * mm, 148 * mm],
                rowHeights=[13 * mm] * len(packing_rows),
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                    ]
                ),
            ),
            Spacer(1, 9 * mm),
            Table(
                [
                    [
                        Paragraph(
                            "<b>출발 전 3가지</b><br/>"
                            "① 변동 가능한 운영정보 재확인<br/>"
                            "② 기상청 예보와 이동 동선 확인<br/>"
                            "③ 여행 후 실제 경험을 피드백으로 남기기",
                            styles["body"],
                        )
                    ]
                ],
                colWidths=[164 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), SEA_LIGHT),
                        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#9ACEC2")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
                    ]
                ),
            ),
            PageBreak(),
            Paragraph("EVIDENCE CHECK", styles["eyebrow"]),
            Paragraph("근거 확인", styles["h1"]),
            Paragraph(
                "장소를 담은 경로와 확인 상태를 분리해 기록했습니다. "
                "공공데이터는 원본 상태를, 하루방 웹검색은 확인한 웹 출처를, "
                "직접 추가 장소는 사용자의 메모를 출발점으로 삼습니다.",
                styles["body"],
            ),
            Spacer(1, 6 * mm),
        ]
    )
    for item in sorted(body.items, key=lambda value: (value.day, value.order, value.name)):
        story.extend([_evidence_row(item, styles), Spacer(1, 2.5 * mm)])
    story.extend(
        [
            Spacer(1, 5 * mm),
            Paragraph(
                "여행 후 남긴 방문 결과와 수정 신호는 다음 여행자가 더 믿을 수 있는 "
                "제주 데이터를 만드는 근거가 됩니다.",
                styles["center"],
            ),
        ]
    )

    doc.build(story)
    return buffer.getvalue()
