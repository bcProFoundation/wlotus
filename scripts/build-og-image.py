#!/usr/bin/env python3
"""Compose the W Lotus Open Graph card (1200×630).

Layout matches danaverse.org/og.png: rosewood field, large cream brand mark
on the left, serif wordmark + gold italic tagline + rule + remembrance line.

Source glyph: apps/web/public/images/W-bold.png
Output:       apps/web/public/og.png

Requires: pip install pillow
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "apps/web/public/images"
OUT = ROOT / "apps/web/public/og.png"
SOURCE = IMAGES / "W-bold.png"
FONT_CACHE = Path("/tmp/og-fonts")

# Wood theme (apps/web/src/styles.css [data-theme='wood'])
BG = (29, 19, 12)  # danaverse / rosewood #1d130c
CREAM = (243, 230, 212)  # --ink #f3e6d4
GOLD = (212, 168, 75)  # --accent #d4a84b

WIDTH, HEIGHT = 1200, 630
FONT_BASE = (
    "https://cdn.jsdelivr.net/fontsource/fonts/cormorant-garamond@5.2.5"
)


def extract_cream_glyph(src: Image.Image) -> Image.Image:
    src = src.convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sp = src.load()
    op = out.load()
    assert sp is not None and op is not None
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if a < 8:
                continue
            op[x, y] = (*CREAM, a)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def fit_glyph(glyph: Image.Image, box_w: int, box_h: int) -> Image.Image:
    g = glyph.copy()
    g.thumbnail((box_w, box_h), Image.Resampling.LANCZOS)
    return g


def font_path(spec: str) -> Path:
    FONT_CACHE.mkdir(parents=True, exist_ok=True)
    dest = FONT_CACHE / f"{spec}.ttf"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    url = f"{FONT_BASE}/{spec}.ttf"
    urllib.request.urlretrieve(url, dest)
    return dest


def load_font(spec: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(font_path(spec)), size=size)


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"missing glyph {SOURCE}")

    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    # Filled lotus reads heavier than Danaverse's outline leaf. Keep it
    # clearly smaller than the type stack and centered in the left slot.
    slot_x, slot_y, slot_w, slot_h = 80, 140, 430, 344
    glyph = fit_glyph(extract_cream_glyph(Image.open(SOURCE)), 270, 210)
    gx = slot_x + (slot_w - glyph.width) // 2
    gy = slot_y + (slot_h - glyph.height) // 2
    canvas.paste(glyph, (gx, gy), glyph)

    draw = ImageDraw.Draw(canvas)
    title_font = load_font("latin-600-normal", 78)
    tag_font = load_font("latin-600-italic", 36)
    body_font = load_font("latin-500-normal", 28)
    text_x = 560

    draw.text((text_x, 198), "W Lotus", font=title_font, fill=CREAM)
    draw.text((text_x, 298), "Eternal lotus", font=tag_font, fill=GOLD)
    draw.line((text_x, 367, text_x + 300, 367), fill=GOLD, width=2)
    draw.text(
        (text_x, 400),
        "A flower of eternal remembrance.",
        font=body_font,
        fill=CREAM,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({WIDTH}x{HEIGHT}, {OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
