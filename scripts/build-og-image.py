#!/usr/bin/env python3
"""Compose W Lotus Open Graph cards (1200×630) for vi / en / zh.

Layout matches danaverse.org/og.png: rosewood field, cream brand mark on
the left, serif wordmark + gold tagline + rule + remembrance line.

The lotus body (outer petal tips → base) matches the type stack: those
tips align with the top of “W Lotus”, the base with the last line. The
center spike sits a little above the wordmark.

Outputs (product default is Vietnamese). Canonical path is `/images/`
so messengers never reuse a poisoned `/og.png` cache from when nginx
served the SPA HTML at that URL:
  apps/web/public/images/og.png      vi
  apps/web/public/images/og-en.png   en
  apps/web/public/images/og-zh.png   zh
Root copies (`apps/web/public/og*.png`) stay as a fallback for old links.

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

BG = (20, 12, 8)
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
        "tag": "Kết nối các thế hệ",
        "body": "Bông sen của sự tưởng nhớ.",
        "cjk": False,
    },
    {
        "locale": "en",
        "file": "og-en.png",
        "tag": "Connecting generations",
        "body": "A flower of remembrance.",
        "cjk": False,
    },
    {
        "locale": "zh",
        "file": "og-zh.png",
        "tag": "连接世代",
        "body": "追思之花。",
        "cjk": True,
    },
)


def outer_petal_tip_y(glyph: Image.Image) -> int:
    """Y of the outer petal tips — the pointed left/right rim, not the center spike.

    After bbox-crop the arms reach the left and right edges; their highest
    ink in the outer fifth of the glyph is the edge the type should meet.
    """
    w, h = glyph.size
    px = glyph.load()
    assert px is not None
    band = max(1, w // 5)

    def min_top(x0: int, x1: int) -> int:
        best = h
        for x in range(x0, x1):
            for y in range(h):
                if px[x, y][3] >= 8:
                    if y < best:
                        best = y
                    break
        return best

    left = min_top(0, band)
    right = min_top(w - band, w)
    tip = min(left, right)
    if tip >= h:
        raise SystemExit("could not find outer petal tips on glyph")
    return tip


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


def visual_ink_bottom(text: str, font: ImageFont.FreeTypeFont, x: int, y: int) -> int:
    """Lowest y of the letterforms, skipping thin descender tails (g, y, …)."""
    tmp = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(tmp).text((x, y), text, font=font, anchor="lt", fill=255)
    bbox = tmp.getbbox()
    if not bbox:
        return y
    left, top, right, bottom = bbox
    px = tmp.load()
    assert px is not None
    rows: list[tuple[int, int]] = []
    peak = 0
    for row in range(top, bottom):
        n = 0
        for col in range(left, right):
            if px[col, row] > 128:
                n += 1
        rows.append((row, n))
        if n > peak:
            peak = n
    thresh = max(24, peak // 5)
    for row, n in reversed(rows):
        if n >= thresh:
            return row
    return bottom - 1


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

    title_ink = draw.textbbox((0, title_y), title, font=title_font, anchor="lt")
    tag_ink = draw.textbbox((0, tag_y), tag, font=tag_font, anchor="lt")
    body_ink = draw.textbbox((0, body_y), body, font=body_font, anchor="lt")
    title_top = title_ink[1]
    body_vis = visual_ink_bottom(body, body_font, 0, body_y)
    stack_ink_h = max(1, body_vis - title_top)

    # Scale so outer-petal-tips → base equals the type stack; spike is extra.
    tip_src = outer_petal_tip_y(glyph_src)
    scale = stack_ink_h / max(1, glyph_src.height - tip_src)
    flower_h = max(1, round(glyph_src.height * scale))
    flower_w = max(1, round(glyph_src.width * scale))
    glyph = glyph_src.resize((flower_w, flower_h), Image.Resampling.LANCZOS)
    tip = outer_petal_tip_y(glyph)

    # Flower grows with the type stack; sit it on the left and keep a
    # shared wordmark x so vi/en/zh cards match.
    gx = 22
    text_x = gx + glyph.width + 20
    text_right = text_x + max(
        title_ink[2] - title_ink[0],
        tag_ink[2] - tag_ink[0],
        body_ink[2] - body_ink[0],
    )
    if gx < 0 or text_right > WIDTH - 36:
        raise SystemExit(
            f"{card['locale']} overflows: gx={gx} flower_w={glyph.width} "
            f"text_x={text_x} text_right={text_right}"
        )

    gy = title_top - tip
    draw.text((text_x, title_y), title, font=title_font, fill=CREAM, anchor="lt")
    draw.text((text_x, tag_y), tag, font=tag_font, fill=GOLD, anchor="lt")
    draw.line((text_x, line_y, text_x + line_w, line_y), fill=GOLD, width=2)
    draw.text((text_x, body_y), body, font=body_font, fill=CREAM, anchor="lt")
    canvas.paste(glyph, (gx, gy), glyph)

    canonical = IMAGES / card["file"]
    canvas.save(canonical, format="PNG", optimize=True)
    fallback = PUBLIC / card["file"]
    canvas.save(fallback, format="PNG", optimize=True)
    print(
        f"wrote {canonical.relative_to(ROOT)} "
        f"({canonical.stat().st_size} bytes) "
        f"locale={card['locale']} text_x={text_x} "
        f"body_right={text_x + (body_ink[2] - body_ink[0])}"
    )


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"missing glyph {SOURCE}")
    glyph_src = extract_cream_glyph(Image.open(SOURCE))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    for card in CARDS:
        compose(card, glyph_src)


if __name__ == "__main__":
    main()
