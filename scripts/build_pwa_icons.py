"""PWA 아이콘 세트 생성.

- Citrus 오렌지 배경 + 흰색 감귤 원 + 큰 흰색 P 이니셜.
- 4개 파일: apps/web/public/icons/{icon-192, icon-512, icon-180, icon-maskable-512}.png

any(purpose)와 maskable(purpose)의 차이:
- any: 아이콘 전체가 보인다는 가정. 여백 없이 꽉 채우면 잘림 위험.
- maskable: OS/브라우저가 임의 마스크로 잘라내므로 안전 영역(safe zone) 안에
  실 콘텐츠를 배치해야 한다. 우리는 중앙 80%만 사용.
"""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CITRUS = (0xE6, 0x7A, 0x34)
CITRUS_2 = (0xC5, 0x5A, 0x18)
WHITE = (0xFF, 0xFF, 0xFF)
IVORY = (0xFD, 0xF6, 0xEA)
LEAF = (0x3C, 0x8D, 0x6F)

OUT = Path("apps/web/public/icons")
OUT.mkdir(parents=True, exist_ok=True)


def _load_font(size: int):
    for name in ("malgunbd.ttf", "malgun.ttf", "arialbd.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(fr"C:\Windows\Fonts\{name}", size)
        except Exception:
            continue
    return ImageFont.load_default()


def _draw_content(img: Image.Image, safe_ratio: float = 1.0):
    """중앙에 감귤 원 + P 이니셜.

    safe_ratio: 콘텐츠 크기를 이 비율만큼 축소 (maskable 안전 영역용).
    """
    w, h = img.size
    d = ImageDraw.Draw(img)

    # 배경 그라데이션 대신 단색 (파일 크기·심플함).
    d.rectangle([0, 0, w, h], fill=CITRUS)

    # 중앙 원 (감귤 얼굴)
    cx, cy = w // 2, h // 2
    radius = int(min(w, h) * 0.36 * safe_ratio)
    circle_bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    d.ellipse(circle_bbox, fill=IVORY)

    # 잎 (작은 초록 타원, 우측 상단)
    leaf_r = int(radius * 0.35)
    leaf_x = cx + int(radius * 0.55)
    leaf_y = cy - int(radius * 0.85)
    d.ellipse(
        [leaf_x - leaf_r, leaf_y - leaf_r // 2,
         leaf_x + leaf_r, leaf_y + leaf_r // 2],
        fill=LEAF,
    )

    # P 이니셜 (중앙)
    font_size = int(radius * 1.5)
    font = _load_font(font_size)
    # 텍스트 크기 재조정으로 시각적 균형
    tbbox = d.textbbox((0, 0), "P", font=font)
    tw = tbbox[2] - tbbox[0]
    th = tbbox[3] - tbbox[1]
    tx = cx - tw // 2 - tbbox[0]
    ty = cy - th // 2 - tbbox[1]
    d.text((tx, ty), "P", fill=CITRUS_2, font=font)


def make(size: int, filename: str, maskable: bool = False):
    img = Image.new("RGB", (size, size), CITRUS)
    _draw_content(img, safe_ratio=0.78 if maskable else 1.0)
    out = OUT / filename
    img.save(out, format="PNG", optimize=True)
    print(f"  {filename}  {out.stat().st_size:,} bytes")
    return out


if __name__ == "__main__":
    print(f"writing icons to {OUT.resolve()}")
    make(192, "icon-192.png")
    make(512, "icon-512.png")
    make(180, "icon-180.png")  # iOS apple-touch-icon 표준 크기
    make(512, "icon-maskable-512.png", maskable=True)
    print("done")
