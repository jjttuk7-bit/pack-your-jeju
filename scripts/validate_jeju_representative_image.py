from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


IMAGE = Path(
    "docs/competition/2026-jeju-public-data-ai/"
    "06_제주를담다_대표이미지_494x375.png"
)


def main() -> int:
    assert IMAGE.exists(), f"image not found: {IMAGE}"
    with Image.open(IMAGE) as image:
        assert image.format == "PNG", f"expected PNG, got {image.format}"
        assert image.size == (494, 375), f"expected 494x375, got {image.size}"
        assert image.mode in {"RGB", "RGBA"}, f"unexpected mode: {image.mode}"
        rgb = image.convert("RGB")
        colors = rgb.getcolors(maxcolors=494 * 375)
        assert colors is None or len(colors) >= 32, "image has insufficient color variation"
        corners = [rgb.getpixel((0, 0)), rgb.getpixel((493, 0)), rgb.getpixel((0, 374)), rgb.getpixel((493, 374))]
        assert all(sum(pixel) > 90 for pixel in corners), f"dark clipped corner detected: {corners}"

    print(f"IMAGE={IMAGE.resolve()}")
    print("size=494x375 format=PNG PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"VALIDATION FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
