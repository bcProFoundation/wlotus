#!/usr/bin/env python3
"""Regenerate W Lotus favicons, apple-touch, and Android maskable icons.

Source: apps/web/public/images/W-bold.png (white glyph, already transparent).

Outputs:
  W-white.png                  cropped white glyph, transparent background
  wlotus-icon-{16,32,192,512}  rounded black square, transparent corners (any)
  wlotus-icon-180.png          full-bleed black (iOS apple-touch; OS applies mask)
  apple-touch-icon.png         same as 180
  wlotus-icon-maskable-512.png full-bleed black, glyph in the 80% safe zone
  favicon.ico                  16/32/48 rounded

Requires: pip install pillow
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "apps/web/public/images"
SOURCE = IMAGES / "W-bold.png"

# iOS-like rounded square (~22% of edge). Corners are transparent so browser
# chrome does not paint a sharp black box.
RADIUS_RATIO = 0.22
# Padding inside the rounded plate so petal tips clear the corner arcs.
ANY_PAD_RATIO = 0.16
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
    plate = Image.new("RGBA", (s, s), (0, 0, 0, 255))
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    img.paste(plate, (0, 0), mask)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def compose_any_icon(glyph: Image.Image, size: int) -> Image.Image:
    """White W on a rounded black square; corners stay transparent."""
    plate = rounded_plate(size, RADIUS_RATIO)
    inner = max(1, int(size * (1 - 2 * ANY_PAD_RATIO)))
    paste_centered(plate, fit_glyph(glyph, inner))
    return plate


def compose_full_bleed(glyph: Image.Image, size: int, pad_ratio: float) -> Image.Image:
    """Opaque black square (iOS apple-touch / Android maskable)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    inner = max(1, int(size * (1 - 2 * pad_ratio)))
    paste_centered(img, fit_glyph(glyph, inner))
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def main() -> None:
    glyph = extract_white_glyph(Image.open(SOURCE))
    save_png(glyph, IMAGES / "W-white.png")

    for size in (16, 32, 192, 512):
        save_png(compose_any_icon(glyph, size), IMAGES / f"wlotus-icon-{size}.png")

    apple = compose_full_bleed(glyph, 180, ANY_PAD_RATIO)
    save_png(apple, IMAGES / "wlotus-icon-180.png")
    save_png(apple, IMAGES / "apple-touch-icon.png")

    save_png(
        compose_full_bleed(glyph, 512, MASKABLE_PAD_RATIO),
        IMAGES / "wlotus-icon-maskable-512.png",
    )

    ico = compose_any_icon(glyph, 48)
    ico_path = IMAGES / "favicon.ico"
    ico.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
