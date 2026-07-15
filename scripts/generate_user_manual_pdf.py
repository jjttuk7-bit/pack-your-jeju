from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "manual_assets"
OUTPUT = ROOT / "docs" / "제주를_담다_사용자_매뉴얼_v1.2.pdf"
SERVICE_URL = "https://pack-your-jeju.vercel.app/"

PAGE_W, PAGE_H = A4
PAPER = colors.HexColor("#FFFDF8")
CREAM = colors.HexColor("#F8EBD4")
INK = colors.HexColor("#23302F")
MUTED = colors.HexColor("#68736F")
ORANGE = colors.HexColor("#EE6337")
ORANGE_DARK = colors.HexColor("#B94726")
TEAL = colors.HexColor("#17675D")
MINT = colors.HexColor("#E2F0EA")
LINE = colors.HexColor("#E7D8C0")
YELLOW = colors.HexColor("#FFF3CC")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
    pdfmetrics.registerFont(TTFont("MalgunBold", r"C:\Windows\Fonts\malgunbd.ttf"))
    pdfmetrics.registerFontFamily(
        "Malgun",
        normal="Malgun",
        bold="MalgunBold",
        italic="Malgun",
        boldItalic="MalgunBold",
    )


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("TitleKR", fontName="MalgunBold", fontSize=22, leading=30, textColor=INK, spaceAfter=5 * mm))
styles.add(ParagraphStyle("SubKR", fontName="MalgunBold", fontSize=13, leading=20, textColor=TEAL, spaceAfter=2 * mm))
styles.add(ParagraphStyle("BodyKR", fontName="Malgun", fontSize=9.2, leading=15.2, textColor=INK, wordWrap="CJK", spaceAfter=1.7 * mm))
styles.add(ParagraphStyle("SmallKR", fontName="Malgun", fontSize=7.8, leading=12, textColor=MUTED, wordWrap="CJK"))
styles.add(ParagraphStyle("BulletKR", fontName="Malgun", fontSize=9, leading=14.5, leftIndent=5 * mm, firstLineIndent=-3.8 * mm, textColor=INK, wordWrap="CJK", spaceAfter=1.1 * mm))
styles.add(ParagraphStyle("Caption", fontName="Malgun", fontSize=7.4, leading=10.5, textColor=MUTED, alignment=TA_CENTER, spaceBefore=1.5 * mm))
styles.add(ParagraphStyle("CellHead", fontName="MalgunBold", fontSize=8.4, leading=12, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle("CellKR", fontName="Malgun", fontSize=7.6, leading=11.5, textColor=INK, wordWrap="CJK"))
styles.add(ParagraphStyle("CalloutKR", fontName="MalgunBold", fontSize=9.2, leading=14, textColor=TEAL, wordWrap="CJK"))


def p(text: str, style: str = "BodyKR") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return p(f"• {text}", "BulletKR")


def page_title(no: str, title: str, lead: str):
    return [p(f"{no}. {title}", "TitleKR"), p(lead, "BodyKR"), Spacer(1, 3 * mm)]


def screenshot(name: str, width: float = 170 * mm, max_height: float | None = 118 * mm) -> Image:
    img = Image(str(ASSETS / name))
    ratio = img.imageHeight / img.imageWidth
    img.drawWidth = width
    img.drawHeight = width * ratio
    if max_height and img.drawHeight > max_height:
        img.drawHeight = max_height
        img.drawWidth = max_height / ratio
    return img


def callout(title: str, body: str, background=MINT, border=TEAL):
    table = Table([[p(title, "CalloutKR"), p(body, "SmallKR")]], colWidths=[43 * mm, 127 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.7, border),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ]
        )
    )
    return table


def simple_table(headers: list[str], rows: list[list[str]], widths: list[float]):
    data = [[p(head, "CellHead") for head in headers]]
    data.extend([[p(cell, "CellKR") for cell in row] for row in rows])
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def cover_page(c: canvas.Canvas, _doc) -> None:
    c.saveState()
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.setFillColor(colors.HexColor("#DDEFE8"))
    c.roundRect(0, PAGE_H - 112 * mm, PAGE_W, 112 * mm, 0, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#9FB77B"))
    path = c.beginPath()
    path.moveTo(-20 * mm, PAGE_H - 92 * mm)
    path.curveTo(20 * mm, PAGE_H - 78 * mm, 58 * mm, PAGE_H - 82 * mm, 92 * mm, PAGE_H - 61 * mm)
    path.curveTo(128 * mm, PAGE_H - 38 * mm, 143 * mm, PAGE_H - 58 * mm, PAGE_W + 18 * mm, PAGE_H - 48 * mm)
    path.lineTo(PAGE_W + 18 * mm, PAGE_H - 112 * mm)
    path.lineTo(-20 * mm, PAGE_H - 112 * mm)
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#6E8B68"))
    path = c.beginPath()
    path.moveTo(105 * mm, PAGE_H - 64 * mm)
    path.curveTo(124 * mm, PAGE_H - 44 * mm, 133 * mm, PAGE_H - 23 * mm, 150 * mm, PAGE_H - 23 * mm)
    path.curveTo(168 * mm, PAGE_H - 22 * mm, 177 * mm, PAGE_H - 54 * mm, PAGE_W + 10 * mm, PAGE_H - 58 * mm)
    path.lineTo(PAGE_W + 10 * mm, PAGE_H - 112 * mm)
    path.lineTo(99 * mm, PAGE_H - 112 * mm)
    path.close()
    c.drawPath(path, fill=1, stroke=0)

    c.setFillColor(ORANGE)
    c.circle(29 * mm, PAGE_H - 31 * mm, 6.5 * mm, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("MalgunBold", 14)
    c.drawString(40 * mm, PAGE_H - 33 * mm, "제주를 담다")
    c.setFont("Malgun", 7.6)
    c.setFillColor(MUTED)
    c.drawString(40 * mm, PAGE_H - 39 * mm, "근거 있는 제주 여행 준비")

    c.setFillColor(INK)
    c.setFont("MalgunBold", 34)
    c.drawString(24 * mm, PAGE_H - 139 * mm, "사용자 매뉴얼")
    c.setFont("Malgun", 13)
    c.setFillColor(colors.HexColor("#344340"))
    c.drawString(24 * mm, PAGE_H - 153 * mm, "지역과 순간을 고르고, 후보를 비교하고,")
    c.drawString(24 * mm, PAGE_H - 162 * mm, "나만의 제주 플랜으로 담는 방법")

    c.setFillColor(ORANGE)
    c.roundRect(24 * mm, 45 * mm, 55 * mm, 13 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("MalgunBold", 8.5)
    c.drawCentredString(51.5 * mm, 49.8 * mm, "USER GUIDE · v1.2")
    c.setFillColor(MUTED)
    c.setFont("Malgun", 7.5)
    c.drawString(24 * mm, 34 * mm, "웹 주소")
    c.setFillColor(ORANGE_DARK)
    c.setFont("MalgunBold", 8.5)
    c.drawString(43 * mm, 34 * mm, SERVICE_URL)
    c.linkURL(SERVICE_URL, (43 * mm, 32 * mm, 106 * mm, 38 * mm), relative=0)
    c.setFillColor(MUTED)
    c.setFont("Malgun", 7.5)
    c.drawRightString(PAGE_W - 24 * mm, 22 * mm, "2026-07-16")
    c.restoreState()


def normal_page(c: canvas.Canvas, doc) -> None:
    c.saveState()
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.line(20 * mm, PAGE_H - 15 * mm, PAGE_W - 20 * mm, PAGE_H - 15 * mm)
    c.setFillColor(ORANGE)
    c.circle(23 * mm, PAGE_H - 10 * mm, 2.2 * mm, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("MalgunBold", 7.5)
    c.drawString(28 * mm, PAGE_H - 12 * mm, "제주를 담다 · 사용자 매뉴얼")
    c.setFillColor(MUTED)
    c.setFont("Malgun", 7)
    c.drawString(20 * mm, 10 * mm, "화면 예시는 2026-07-16 배포 서비스 기준입니다.")
    c.drawRightString(PAGE_W - 20 * mm, 10 * mm, str(doc.page))
    c.restoreState()


def build_story():
    story = [Spacer(1, 1 * mm), PageBreak()]

    story += page_title("0", "빠른 시작", "처음 사용하는 분은 아래 흐름만 따라가면 제주팩을 만들 수 있습니다.")
    story.append(
        simple_table(
            ["단계", "해야 할 일", "확인할 것"],
            [
                ["1", "첫 화면에서 내 제주 여행 만들기를 누릅니다.", "서비스 주소는 PDF 표지의 링크를 사용합니다."],
                ["2", "지도에서 지역을 누르고 플랜 후보에 담습니다.", "선택 지역의 확인 후보와 부족한 근거를 같이 봅니다."],
                ["3", "날짜·동행·목적·특별 요청을 입력합니다.", "부모님, 아이, 비 오는 날처럼 실제 조건을 적습니다."],
                ["4", "오름·바다·카페처럼 담고 싶은 순간을 고릅니다.", "순간별 후보가 나뉘어 비교됩니다."],
                ["5", "장소 대표이미지, 출처, 확인 필요 표시를 함께 봅니다.", "지도 마커가 있는 후보와 주소만 있는 후보를 구분합니다."],
                ["6", "실제로 갈 곳만 플랜에 담고 저장·공유합니다.", "방문 뒤 피드백은 다음 데이터 품질 개선의 근거가 됩니다."],
            ],
            [15 * mm, 72 * mm, 83 * mm],
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(callout("핵심 원칙", "제주를 담다는 장소를 많이 뿌리는 서비스가 아니라, 어떤 근거로 선택했는지 보여주고 실제 여행 결과를 다시 신뢰 데이터로 되돌리는 서비스입니다."))
    story.append(PageBreak())

    story += page_title("1", "첫 화면에서 시작하기", "서비스 URL로 접속한 뒤 여행 만들기 버튼을 눌러 플래너 화면으로 들어갑니다.")
    story.append(screenshot("01_landing.png", max_height=122 * mm))
    story.append(p("그림 1. 최신 랜딩 화면", "Caption"))
    story.append(Spacer(1, 3 * mm))
    story.append(bullet("상단 또는 본문의 <b>내 제주 여행 만들기</b> 버튼을 누릅니다."))
    story.append(bullet("처음 화면은 서비스 소개용이고, 실제 사용은 지역·순간 선택 화면에서 시작됩니다."))
    story.append(bullet("브라우저 주소창에는 개인정보나 민감한 값이 표시되지 않도록 확인합니다."))
    story.append(PageBreak())

    story += page_title("2", "지역과 순간 고르기", "지도에서 지역을 선택하고, 오름·바다 산책처럼 원하는 경험을 담습니다.")
    story.append(screenshot("02_region_and_moment.png", max_height=126 * mm))
    story.append(p("그림 2. 애월 지역과 오름·바다 산책 순간을 고른 화면", "Caption"))
    story.append(Spacer(1, 2 * mm))
    story.append(bullet("지도 지역을 누르면 오른쪽에 공공데이터 확인 후보, 추천 가능한 순간, 미확인 항목이 열립니다."))
    story.append(bullet("지역은 <b>플랜 후보에 담기</b> 버튼으로 확정합니다."))
    story.append(bullet("순간을 1개 이상 고르면 제주팩을 받을 수 있습니다."))
    story.append(PageBreak())

    story += page_title("3", "후보 결과 화면 읽기", "왼쪽은 여행 요약과 지도, 오른쪽은 순간별 후보 비교 공간입니다.")
    story.append(screenshot("03_pack_overview.png", max_height=126 * mm))
    story.append(p("그림 3. 순간별 후보와 장소 대표이미지가 포함된 결과 화면", "Caption"))
    story.append(Spacer(1, 2 * mm))
    story.append(bullet("<b>순간별 후보</b>는 경험 단위로 나뉘며, 카드에는 장소 대표이미지와 확인 신호가 함께 표시됩니다."))
    story.append(bullet("후보 수, 공공데이터 확인 후보, 내 플랜 수를 상단에서 빠르게 확인합니다."))
    story.append(bullet("날씨 신호는 KMA 예보를 기반으로 하며 출발 전 다시 확인하는 용도입니다."))
    story.append(PageBreak())

    story += page_title("4", "신뢰 표시와 후보 카드", "장소명만 보지 말고 사진, 배지, 출처, 확인 필요 항목을 함께 봅니다.")
    story.append(
        simple_table(
            ["표시", "의미", "사용자 행동"],
            [
                ["신뢰 점수", "현재 데이터와 확인 신호가 얼마나 연결됐는지 보여주는 보조 지표입니다.", "점수만으로 결정하지 말고 출처와 확인 필요 항목을 함께 봅니다."],
                ["수정요청 이력", "이용자 또는 운영 데이터에서 변경 가능성이 감지된 항목입니다.", "주소·접근성·운영상태를 방문 직전에 다시 확인합니다."],
                ["기본 공공데이터", "공공데이터 원천에서 조회된 장소 후보입니다.", "최신 운영시간을 보장한다는 뜻은 아니므로 공식 출처를 확인합니다."],
                ["하루방 웹검색", "웹 조사로 찾은 후보입니다.", "공식·플랫폼·경험 출처가 어떤 주장을 뒷받침하는지 확인합니다."],
            ],
            [34 * mm, 69 * mm, 67 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(callout("장소 대표이미지", "대표이미지는 장소를 빠르게 구분하기 위한 시각 정보입니다. 실제 계절·운영 상태·혼잡도는 출처와 방문 시점에 따라 달라질 수 있습니다.", YELLOW, ORANGE_DARK))
    story.append(PageBreak())

    story += page_title("5", "다른 후보 더 보기", "처음 보이는 5곳만 대표 결과로 단정하지 않고, 필요한 만큼 더 확인합니다.")
    story.append(screenshot("04_more_candidates.png", max_height=126 * mm))
    story.append(p("그림 4. 다른 후보와 장소 대표이미지를 추가로 확인하는 화면", "Caption"))
    story.append(Spacer(1, 2 * mm))
    story.append(bullet("<b>전체 N곳 중 M곳</b> 표시로 현재 확인 범위를 볼 수 있습니다."))
    story.append(bullet("<b>다른 후보 5곳 보기</b>를 누르면 같은 순간 안에서 다음 후보를 이어서 봅니다."))
    story.append(bullet("후보가 늘어나도 플랜에는 실제로 갈 곳만 담는 것이 좋습니다."))
    story.append(PageBreak())

    story += page_title("6", "지도 마커와 내 플랜", "후보 중 실제로 담은 장소는 왼쪽 지도에서 한 번에 확인합니다.")
    story.append(screenshot("05_plan_map.png", max_height=126 * mm))
    story.append(p("그림 5. 내 플랜 장소와 지도 마커", "Caption"))
    story.append(Spacer(1, 2 * mm))
    story.append(bullet("<b>지도 마커</b>는 좌표가 확인된 플랜 장소만 표시합니다."))
    story.append(bullet("좌표가 없거나 직접 추가한 장소는 카드의 주소와 외부 지도를 함께 확인합니다."))
    story.append(bullet("<b>내 플랜 저장</b>은 플랜 요약을 PDF로 저장하고, <b>플랜 공유</b>는 요약 문구를 복사합니다."))
    story.append(PageBreak())

    story += page_title("7", "방문 피드백 남기기", "여행 뒤 실제 방문 결과를 남기면 다음 데이터 품질 개선의 근거가 됩니다.")
    story.append(
        simple_table(
            ["피드백", "기록 예시", "데이터 처리"],
            [
                ["방문함", "2026-07-24 오후 방문. 입구 안내가 맞았고 주차 가능.", "확인 신호로 저장"],
                ["정보 다름", "지도 주소와 실제 입구가 달랐음.", "검토 대상으로 분리"],
                ["변경됨", "공사 중이라 접근로가 바뀜.", "ModerationCase로 운영자 확인"],
                ["미방문", "비 때문에 대체 후보로 이동.", "선택·방문 차이를 플랜 피드백으로 보존"],
            ],
            [32 * mm, 74 * mm, 64 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(callout("중요", "피드백은 원본 공공데이터를 즉시 덮어쓰지 않습니다. 원본, 사용자 경험, 운영자 검토, 보정 후보를 분리해 신뢰 있는 데이터로 축적합니다."))
    story.append(PageBreak())

    story += page_title("8", "앱처럼 설치하기 (PWA)", "제주를 담다는 웹 주소로 접속하지만, 휴대폰과 PC에 앱처럼 설치해 사용할 수 있습니다.")
    story.append(
        simple_table(
            ["환경", "설치 방법", "사용 팁"],
            [
                ["Android · Chrome", "주소창 또는 메뉴의 앱 설치, 홈 화면에 추가를 선택합니다.", "아이콘으로 바로 열 수 있습니다."],
                ["iPhone · Safari", "공유 버튼을 누르고 홈 화면에 추가를 선택합니다.", "Safari에서 접속해야 메뉴가 보입니다."],
                ["PC · Chrome / Edge", "주소창 오른쪽 설치 아이콘 또는 브라우저 메뉴의 앱 설치를 선택합니다.", "작은 앱 창처럼 열어 여행 준비 중 계속 띄워둘 수 있습니다."],
            ],
            [35 * mm, 84 * mm, 51 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(bullet("PWA 설치 후에도 최신 후보, 하루방 웹검색, 지도, 날씨 확인에는 <b>인터넷 연결</b>이 필요합니다."))
    story.append(bullet("공용 PC에서는 설치 후 브라우저 기록과 다운로드 파일을 정리하세요."))
    story.append(PageBreak())

    story += page_title("9", "하루방 에이전트 사용하기", "하루방은 웹검색, 출처 확인, 공공데이터 교차확인을 함께 사용하는 여행 리서치 도우미입니다.")
    story.append(screenshot("06_haruban_research.png", max_height=124 * mm))
    story.append(p("그림 6. 하루방 에이전트와 플랜에 담기 흐름", "Caption"))
    story.append(Spacer(1, 2 * mm))
    story.append(bullet("<b>하루방 웹검색</b>은 공식·플랫폼·경험 출처를 나눠 보고, 근거가 약한 내용은 확인 필요로 남깁니다."))
    story.append(bullet("검색한 장소는 <b>플랜에 담기</b>로 내 여행플랜에 추가할 수 있습니다."))
    story.append(bullet("짧은 후속 질문도 직전 지역·동행·목적을 이어받지만, 조건이 바뀌면 바뀐 점을 직접 적어주세요."))
    story.append(PageBreak())

    story += page_title("10", "현재 매뉴얼 반영 확인", "이번 제출용 매뉴얼은 최신 UI와 제출 요구사항을 기준으로 다시 정리했습니다.")
    story.append(
        simple_table(
            ["확인 항목", "반영 내용"],
            [
                ["표지", "뒤쪽 흐릿한 대형 배경 글자 없이 새 표지로 제작했습니다."],
                ["지도", "초기 버전 지도 이미지 대신 현재 배포 UI의 제주 지도 화면으로 교체했습니다."],
                ["순간 장소", "오름·바다 산책 후보 카드의 장소 대표이미지를 포함했습니다."],
                ["하루방", "현재 하루방 에이전트 패널, 하루방 웹검색, 플랜에 담기 흐름을 반영했습니다."],
                ["PWA", "Android, iPhone, PC 설치 방법과 인터넷 연결 필요 조건을 포함했습니다."],
            ],
            [45 * mm, 125 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(callout("제출 전 확인", "PDF 안에는 개발 저장소 주소, 민감한 키, 내부 운영 주소를 넣지 않았습니다. 서비스 접속 주소만 표지의 링크로 제공합니다.", YELLOW, ORANGE_DARK))
    story.append(Spacer(1, 5 * mm))
    story.append(p("출발 전 체크", "SubKR"))
    for text in [
        "운영시간·휴무·예약 필요 여부를 공식 출처에서 확인",
        "날씨와 바람에 맞는 대체 후보 준비",
        "지도 마커가 없는 장소는 주소를 별도로 확인",
        "방문 후 변경 정보와 실제 경험을 피드백으로 기록",
    ]:
        story.append(bullet(f"□ {text}"))
    story.append(callout("한 문장으로 기억하기", "후보를 많이 모으는 것보다, 근거를 확인하고 실제로 갈 곳만 내 플랜에 담으세요.", MINT, TEAL))
    story.append(Spacer(1, 6 * mm))
    story.append(p(f'<link href="{SERVICE_URL}" color="#B94726"><b>{SERVICE_URL}</b></link>', "BodyKR"))
    return story


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="제주를 담다 사용자 매뉴얼 v1.2",
        author="제주를 담다",
        subject="제주를 담다 웹앱 사용자 안내서",
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=normal_page)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
