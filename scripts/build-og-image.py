#!/usr/bin/env python3
"""Compose the W Lotus Open Graph card (1200×630).

Layout matches danaverse.org/og.png: rosewood field, cream brand mark on
the left, serif wordmark + gold italic tagline + rule + remembrance line.

The lotus is scaled so its ink matches the text stack: top of the flower
aligns with the top of “W Lotus”, bottom with the last line.

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


def line_h(font: ImageFont.FreeTypeFont) -> int:
    ascent, descent = font.getmetrics()
    return ascent + descent


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"missing glyph {SOURCE}")

    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font("latin-600-normal", 110)
    tag_font = load_font("latin-600-italic", 50)
    body_font = load_font("latin-500-normal", 38)
    text_x = 560
    title = "W Lotus"
    tag = "Eternal lotus"
    body = "A flower of eternal remembrance."

    gap_title_tag = 14
    gap_tag_line = 20
    gap_line_body = 20
    line_w = 380
    stack_h = (
        line_h(title_font)
        + gap_title_tag
        + line_h(tag_font)
        + gap_tag_line
        + 2
        + gap_line_body
        + line_h(body_font)
    )
    title_y = (HEIGHT - stack_h) // 2
    tag_y = title_y + line_h(title_font) + gap_title_tag
    line_y = tag_y + line_h(tag_font) + gap_tag_line
    body_y = line_y + gap_line_body

    draw.text((text_x, title_y), title, font=title_font, fill=CREAM, anchor="lt")
    draw.text((text_x, tag_y), tag, font=tag_font, fill=GOLD, anchor="lt")
    draw.line((text_x, line_y, text_x + line_w, line_y), fill=GOLD, width=2)
    draw.text((text_x, body_y), body, font=body_font, fill=CREAM, anchor="lt")

    title_ink = draw.textbbox(
        (text_x, title_y), title, font=title_font, anchor="lt"
    )
    body_ink = draw.textbbox(
        (text_x, body_y), body, font=body_font, anchor="lt"
    )
    flower_top = title_ink[1]
    flower_bottom = body_ink[3]
    flower_h = max(1, flower_bottom - flower_top)

    raw = extract_cream_glyph(Image.open(SOURCE))
    scale = flower_h / raw.height
    flower_w = max(1, round(raw.width * scale))
    glyph = raw.resize((flower_w, flower_h), Image.Resampling.LANCZOS)
    gap_flower_text = 56
    gx = max(48, text_x - gap_flower_text - glyph.width)
    canvas.paste(glyph, (gx, flower_top), glyph)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(
        f"wrote {OUT.relative_to(ROOT)} ({WIDTH}x{HEIGHT}, {OUT.stat().st_size} bytes) "
        f"flower {glyph.width}x{glyph.height} y={flower_top}..{flower_bottom}"
    )


if __name__ == "__main__":
    main()
