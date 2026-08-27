#!/usr/bin/env python3
"""Regenerate W Lotus favicons, apple-touch, and Android maskable icons.

Source: apps/web/public/images/W-bold.png (white glyph, already transparent).

Outputs:
  W-white.png                  white glyph, transparent background, optically centered
  wlotus-icon-{16,32}          browser favicons — W close to the rounded edge
  wlotus-icon-{192,512}        PWA any-purpose rounded rosewood square
  wlotus-icon-180.png          full-bleed rosewood (iOS apple-touch; OS applies mask)
  apple-touch-icon.png         same as 180
  wlotus-icon-maskable-512.png full-bleed rosewood, glyph in the 80% safe zone
  favicon.ico                  16/32/48 rounded

`--white-only` rewrites W-white.png and leaves the boxed plates alone.

Requires: pip install pillow
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "apps/web/public/images"
SOURCE = IMAGES / "W-bold.png"

# OG card field is #1d130c — correct on a 1200×630 card, black as a 32px
# tile on cream (and darker than light-theme --brand-ink #2a2118). Same hue,
# lightness ~25% so the plate reads rosewood. Corners stay transparent;
# W-white.png stays a transparent glyph for English black.
PLATE = (92, 59, 36, 255)  # #5c3b24

# iOS-like rounded square (~22% of edge). Corners are transparent so browser
# chrome does not paint a sharp black box.
RADIUS_RATIO = 0.22
# Padding inside PWA / apple-touch plates so petal tips clear the corner arcs.
ANY_PAD_RATIO = 0.16
# Browser tab favicons (16/32/ico) — W sits close to the rounded edge.
FAVICON_PAD_RATIO = 0.05
# Maskable: key graphics inside the center 80% circle (Web App Manifest).
# 22% inset keeps the landscape W inside that circle with room for OS masks.
MASKABLE_PAD_RATIO = 0.22


def extract_white_glyph(src: Image.Image) -> Image.Image:
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
            op[x, y] = (255, 255, 255, a)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def alpha_centroid(img: Image.Image) -> tuple[float, float]:
    """Return the alpha-weighted center of mass in pixel coordinates."""
    img = img.convert("RGBA")
    px = img.load()
    assert px is not None
    w, h = img.size
    mass = 0.0
    mx = 0.0
    my = 0.0
    for y in range(h):
        for x in range(w):
            a = px[x, y][3]
            if not a:
                continue
            mass += a
            mx += a * (x + 0.5)
            my += a * (y + 0.5)
    if mass <= 0:
        return w / 2, h / 2
    return mx / mass, my / mass


def pad_to_optical_center(glyph: Image.Image) -> Image.Image:
    """Pad so the alpha-weighted centroid sits at the canvas midpoint.

    The lotus-W is bottom-heavy (bowl + lower petals). A tight bbox crop puts
    that mass below geometric center, so CSS `object-fit: contain` still looks
    low in the header. Boxed square plates keep using the tight glyph.
    """
    cx, cy = alpha_centroid(glyph)
    w, h = glyph.size
    # Positive pad_left / pad_top when the centroid is left / above center.
    dx = round(w - 2 * cx)
    dy = round(h - 2 * cy)
    pad_left = max(0, dx)
    pad_right = max(0, -dx)
    pad_top = max(0, dy)
    pad_bottom = max(0, -dy)
    if pad_left == pad_right == pad_top == pad_bottom == 0:
        return glyph
    canvas = Image.new(
        "RGBA",
        (w + pad_left + pad_right, h + pad_top + pad_bottom),
        (0, 0, 0, 0),
    )
    canvas.paste(glyph, (pad_left, pad_top), glyph)
    return canvas


def fit_glyph(glyph: Image.Image, box: int) -> Image.Image:
    g = glyph.copy()
    g.thumbnail((box, box), Image.Resampling.LANCZOS)
    return g


def paste_centered(dst: Image.Image, glyph: Image.Image) -> None:
    gx = (dst.width - glyph.width) // 2
    gy = (dst.height - glyph.height) // 2
    dst.paste(glyph, (gx, gy), glyph)


def rounded_plate(size: int, radius_ratio: float, supersample: int = 4) -> Image.Image:
    s = size * supersample
    radius = max(1, int(s * radius_ratio))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=255)
    plate = Image.new("RGBA", (s, s), PLATE)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    img.paste(plate, (0, 0), mask)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def compose_any_icon(
    glyph: Image.Image, size: int, pad_ratio: float = ANY_PAD_RATIO
) -> Image.Image:
    """White W on a rounded rosewood square; corners stay transparent."""
    plate = rounded_plate(size, RADIUS_RATIO)
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    paste_centered(plate, fit_glyph(glyph, inner))
    return plate


def compose_full_bleed(glyph: Image.Image, size: int, pad_ratio: float) -> Image.Image:
    """Opaque rosewood square (iOS apple-touch / Android maskable)."""
    img = Image.new("RGBA", (size, size), PLATE)
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    paste_centered(img, fit_glyph(glyph, inner))
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--white-only",
        action="store_true",
        help="Rewrite W-white.png only; do not touch boxed favicons / PWA plates",
    )
    args = parser.parse_args()

    tight = extract_white_glyph(Image.open(SOURCE))
    save_png(pad_to_optical_center(tight), IMAGES / "W-white.png")
    if args.white_only:
        return

    glyph = tight

    for size in (16, 32):
        save_png(
            compose_any_icon(glyph, size, FAVICON_PAD_RATIO),
            IMAGES / f"wlotus-icon-{size}.png",
        )
    for size in (192, 512):
        save_png(compose_any_icon(glyph, size), IMAGES / f"wlotus-icon-{size}.png")

    apple = compose_full_bleed(glyph, 180, ANY_PAD_RATIO)
    save_png(apple, IMAGES / "wlotus-icon-180.png")
    save_png(apple, IMAGES / "apple-touch-icon.png")

    save_png(
        compose_full_bleed(glyph, 512, MASKABLE_PAD_RATIO),
        IMAGES / "wlotus-icon-maskable-512.png",
    )

    ico = compose_any_icon(glyph, 48, FAVICON_PAD_RATIO)
    ico_path = IMAGES / "favicon.ico"
    ico.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
