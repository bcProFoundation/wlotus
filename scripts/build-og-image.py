#!/usr/bin/env python3
"""Compose W Lotus Open Graph cards (1200×630) for vi / en / zh.

Layout matches danaverse.org/og.png: rosewood field, cream brand mark on
the left, serif wordmark + gold tagline + rule + remembrance line.

The lotus is scaled so its ink matches the text stack: top of the flower
aligns with the top of “W Lotus”, bottom with the last line.

Outputs (product default is Vietnamese):
  apps/web/public/og.png      vi
  apps/web/public/og-en.png   en
  apps/web/public/og-zh.png   zh

Requires: pip install pillow
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/web/public"
IMAGES = PUBLIC / "images"
SOURCE = IMAGES / "W-bold.png"
FONT_CACHE = Path("/tmp/og-fonts")

BG = (29, 19, 12)
CREAM = (243, 230, 212)
GOLD = (212, 168, 75)

WIDTH, HEIGHT = 1200, 630

FONT_URLS = {
    "cormorant": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/"
        "cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
    ),
    "cormorant-italic": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/"
        "cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf"
    ),
    "noto-sc-600": (
        "https://cdn.jsdelivr.net/fontsource/fonts/noto-serif-sc@5.2.5/"
        "chinese-simplified-600-normal.ttf"
    ),
    "noto-sc-500": (
        "https://cdn.jsdelivr.net/fontsource/fonts/noto-serif-sc@5.2.5/"
        "chinese-simplified-500-normal.ttf"
    ),
}

CARDS = (
    {
        "locale": "vi",
        "file": "og.png",
        "tag": "Đoá sen vĩnh hằng",
        "body": "Bông hoa của sự tưởng nhớ vĩnh hằng.",
        "cjk": False,
    },
    {
        "locale": "en",
        "file": "og-en.png",
        "tag": "Eternal lotus",
        "body": "A flower of eternal remembrance.",
        "cjk": False,
    },
    {
        "locale": "zh",
        "file": "og-zh.png",
        "tag": "永恒莲花",
        "body": "永恒追思之花。",
        "cjk": True,
    },
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


def ensure_font(key: str) -> Path:
    FONT_CACHE.mkdir(parents=True, exist_ok=True)
    dest = FONT_CACHE / f"{key}.ttf"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    urllib.request.urlretrieve(FONT_URLS[key], dest)
    return dest


def load_cormorant(size: int, *, italic: bool, weight: int) -> ImageFont.FreeTypeFont:
    path = ensure_font("cormorant-italic" if italic else "cormorant")
    font = ImageFont.truetype(str(path), size=size)
    font.set_variation_by_axes([float(weight)])
    return font


def load_noto_sc(size: int, weight: int) -> ImageFont.FreeTypeFont:
    key = "noto-sc-600" if weight >= 600 else "noto-sc-500"
    return ImageFont.truetype(str(ensure_font(key)), size=size)


def line_h(font: ImageFont.FreeTypeFont) -> int:
    ascent, descent = font.getmetrics()
    return ascent + descent


def compose(card: dict, glyph_src: Image.Image) -> None:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_cormorant(110, italic=False, weight=600)
    if card["cjk"]:
        tag_font = load_noto_sc(50, 600)
        body_font = load_noto_sc(38, 500)
    else:
        tag_font = load_cormorant(50, italic=True, weight=600)
        body_font = load_cormorant(38, italic=False, weight=500)

    title = "W Lotus"
    tag = card["tag"]
    body = card["body"]
    text_x = 560

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
    # Keep long Vietnamese on-canvas.
    if body_ink[2] > WIDTH - 40:
        raise SystemExit(
            f"{card['locale']} body overflows x={body_ink[2]}: {body!r}"
        )

    flower_top = title_ink[1]
    flower_bottom = body_ink[3]
    flower_h = max(1, flower_bottom - flower_top)
    scale = flower_h / glyph_src.height
    flower_w = max(1, round(glyph_src.width * scale))
    glyph = glyph_src.resize((flower_w, flower_h), Image.Resampling.LANCZOS)
    gx = max(48, text_x - 56 - glyph.width)
    canvas.paste(glyph, (gx, flower_top), glyph)

    out = PUBLIC / card["file"]
    canvas.save(out, format="PNG", optimize=True)
    print(
        f"wrote {out.relative_to(ROOT)} ({out.stat().st_size} bytes) "
        f"locale={card['locale']} body_right={body_ink[2]}"
    )


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"missing glyph {SOURCE}")
    glyph_src = extract_cream_glyph(Image.open(SOURCE))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for card in CARDS:
        compose(card, glyph_src)


if __name__ == "__main__":
    main()
