from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs/competition/2026-jeju-public-data-ai/assets"
BACKGROUND = ASSET_DIR / "representative-image-background.png"
OUTPUT = ROOT / "docs/competition/2026-jeju-public-data-ai/06_제주를담다_대표이미지_494x375.png"

W, H = 494, 375
TEAL = "#145C55"
TEAL_2 = "#2E756C"
ORANGE = "#F06435"
CREAM = "#F7FBF9"
INK = "#18302C"
PALE = "#DDEFEA"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"),
        Path("C:/Windows/Fonts/NotoSansKR-Bold.ttf" if bold else "C:/Windows/Fonts/NotoSansKR-Regular.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def fit_background() -> Image.Image:
    if BACKGROUND.exists():
        source = Image.open(BACKGROUND).convert("RGB")
        image = ImageOps.fit(source, (W, H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        image = ImageEnhance.Color(image).enhance(0.72)
        image = ImageEnhance.Contrast(image).enhance(0.75)
        image = image.filter(ImageFilter.GaussianBlur(0.45))
    else:
        image = Image.new("RGB", (W, H), CREAM)
    wash = Image.new("RGBA", (W, H), (247, 251, 249, 222))
    return Image.alpha_composite(image.convert("RGBA"), wash)


def center_text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, text_font: ImageFont.ImageFont,
                fill: str, anchor: str = "mm", spacing: int = 2) -> None:
    draw.multiline_text(xy, text, font=text_font, fill=fill, anchor=anchor, align="center", spacing=spacing)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[float, float], end: tuple[float, float]) -> None:
    sx, sy = start
    ex, ey = end
    angle = math.atan2(ey - sy, ex - sx)
    shorten = 23
    ax = sx + math.cos(angle) * shorten
    ay = sy + math.sin(angle) * shorten
    bx = ex - math.cos(angle) * shorten
    by = ey - math.sin(angle) * shorten
    draw.line((ax, ay, bx, by), fill=TEAL_2, width=3)
    head = 7
    left = (bx - math.cos(angle - 0.65) * head, by - math.sin(angle - 0.65) * head)
    right = (bx - math.cos(angle + 0.65) * head, by - math.sin(angle + 0.65) * head)
    draw.polygon([(bx, by), left, right], fill=TEAL_2)


def icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], kind: str) -> None:
    x, y = center
    color = WHITE
    if kind == "database":
        draw.ellipse((x - 10, y - 8, x + 10, y - 2), outline=color, width=2)
        draw.line((x - 10, y - 5, x - 10, y + 8), fill=color, width=2)
        draw.line((x + 10, y - 5, x + 10, y + 8), fill=color, width=2)
        draw.arc((x - 10, y + 2, x + 10, y + 10), 0, 180, fill=color, width=2)
    elif kind == "chat":
        draw.rounded_rectangle((x - 11, y - 8, x + 11, y + 7), radius=4, outline=color, width=2)
        draw.polygon([(x - 5, y + 7), (x - 8, y + 12), (x + 1, y + 7)], fill=color)
        draw.ellipse((x - 6, y - 1, x - 3, y + 2), fill=color)
        draw.ellipse((x - 1, y - 1, x + 2, y + 2), fill=color)
        draw.ellipse((x + 4, y - 1, x + 7, y + 2), fill=color)
    elif kind == "user":
        draw.ellipse((x - 5, y - 10, x + 5, y), outline=color, width=2)
        draw.arc((x - 11, y - 1, x + 11, y + 14), 180, 360, fill=color, width=2)
    elif kind == "shield":
        draw.polygon([(x, y - 12), (x + 11, y - 7), (x + 8, y + 7), (x, y + 13), (x - 8, y + 7), (x - 11, y - 7)], outline=color)
        draw.line((x - 5, y, x - 1, y + 5, x + 7, y - 5), fill=color, width=2)
    elif kind == "pin":
        draw.ellipse((x - 8, y - 11, x + 8, y + 5), outline=color, width=2)
        draw.polygon([(x - 5, y + 2), (x, y + 13), (x + 5, y + 2)], outline=color)
        draw.ellipse((x - 2, y - 5, x + 2, y - 1), fill=color)
    elif kind == "feedback":
        draw.rounded_rectangle((x - 11, y - 9, x + 11, y + 7), radius=3, outline=color, width=2)
        draw.line((x - 6, y - 4, x + 6, y - 4), fill=color, width=2)
        draw.line((x - 6, y + 1, x + 3, y + 1), fill=color, width=2)
        draw.polygon([(x + 3, y + 7), (x + 8, y + 12), (x + 8, y + 7)], fill=color)
    else:
        draw.rounded_rectangle((x - 10, y - 10, x + 10, y + 10), radius=3, outline=color, width=2)
        draw.line((x - 5, y - 4, x + 5, y - 4), fill=color, width=2)
        draw.line((x - 5, y + 1, x + 5, y + 1), fill=color, width=2)
        draw.line((x - 5, y + 6, x + 2, y + 6), fill=color, width=2)


def main() -> None:
    image = fit_background()
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((12, 10, W - 12, 72), radius=14, fill=TEAL)
    center_text(draw, (W / 2, 40), "공공데이터·RAG·Trust Engine으로 만드는\n제주 여행 신뢰 라이프사이클",
                font(18, bold=True), WHITE, spacing=3)

    center = (247, 205)
    rx, ry = 182, 96
    stages = [
        ("공공데이터", "database"),
        ("하루방 RAG", "chat"),
        ("사용자 입력", "user"),
        ("신뢰 판정", "shield"),
        ("실제 여행", "pin"),
        ("피드백", "feedback"),
        ("근거 데이터", "evidence"),
    ]
    angles = [-155, -105, -55, -5, 45, 95, 145]
    points = [
        (center[0] + math.cos(math.radians(angle)) * rx, center[1] + math.sin(math.radians(angle)) * ry)
        for angle in angles
    ]

    for index, point in enumerate(points):
        arrow(draw, point, points[(index + 1) % len(points)])

    draw.ellipse((center[0] - 59, center[1] - 46, center[0] + 59, center[1] + 46), fill=(255, 255, 255, 245), outline=TEAL, width=3)
    center_text(draw, (center[0], center[1] - 7), "제주를 담다", font(20, bold=True), TEAL)
    center_text(draw, (center[0], center[1] + 20), "Pack Your Jeju", font(10, bold=False), ORANGE)

    label_font = font(11, bold=True)
    for index, ((label, kind), point) in enumerate(zip(stages, points)):
        x, y = int(point[0]), int(point[1])
        fill = ORANGE if index in {1, 4, 5} else TEAL_2
        draw.ellipse((x - 22, y - 22, x + 22, y + 22), fill=fill, outline=WHITE, width=2)
        icon(draw, (x, y), kind)
        label_y = y - 31 if y > center[1] else y + 31
        center_text(draw, (x, label_y), label, label_font, INK)

    draw.rounded_rectangle((20, 335, W - 20, 365), radius=14, fill=ORANGE)
    center_text(draw, (W / 2, 350), "여행으로 검증하고, 데이터로 다시 강화합니다", font(14, bold=True), WHITE)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
