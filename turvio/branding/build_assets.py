#!/usr/bin/env python3
"""Build TURVIO brand derivatives from the official raster sources.

The official logo was supplied as raster WebP images with solid backgrounds
(branding/source/). This script does NOT redraw or vectorise the logo. It only:

* removes the solid background with an exact colour-to-alpha transform
  (the result composited on the original background colour reproduces the
  source pixels),
* trims empty margin around the artwork (the artwork itself is never cropped),
* scales proportionally (never stretched),
* places the mark on square canvases for favicons and app icons.

Run from anywhere:  python3 turvio/branding/build_assets.py
Requires Pillow.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
DIST = ROOT / "dist"
REPO = ROOT.parent

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)


def color_to_alpha(img: Image.Image, bg: tuple[int, int, int], noise: float = 0.035) -> Image.Image:
    """Remove a solid background colour (white or black) and un-mix edge pixels."""
    rgb = img.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    src = rgb.load()
    dst = out.load()
    w, h = rgb.size
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if bg == WHITE:
                a = max((255 - v) / 255 for v in c)
            else:
                a = max(v / 255 for v in c)
            # Compression noise in the background -> fully transparent.
            a = 0.0 if a <= noise else min(1.0, (a - noise) / (1 - noise))
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            col = tuple(max(0, min(255, round((v - (1 - a) * b) / a))) for v, b in zip(c, bg))
            dst[x, y] = (*col, round(a * 255))
    return out


def trim(img: Image.Image, pad_ratio: float = 0.0) -> Image.Image:
    # Threshold only decides where empty margin ends; faint compression specks are ignored.
    bbox = img.getchannel("A").point(lambda v: 255 if v > 48 else 0).getbbox()
    assert bbox, "empty image"
    cropped = img.crop(bbox)
    if pad_ratio:
        pad = round(max(cropped.size) * pad_ratio)
        canvas = Image.new("RGBA", (cropped.width + 2 * pad, cropped.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(cropped, (pad, pad))
        return canvas
    return cropped


def fit(img: Image.Image, width: int | None = None, height: int | None = None) -> Image.Image:
    if width:
        height = round(img.height * width / img.width)
    elif height:
        width = round(img.width * height / img.height)
    return img.resize((width, height), Image.Resampling.LANCZOS)


def square(mark: Image.Image, size: int, scale: float, background: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    """Centre the mark on a square canvas; its longest side = size * scale."""
    target = round(size * scale)
    m = fit(mark, width=target) if mark.width >= mark.height else fit(mark, height=target)
    canvas = Image.new("RGBA", (size, size), background)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f"  {path.relative_to(REPO)}  {img.width}x{img.height}")


def main() -> None:
    DIST.mkdir(exist_ok=True)
    print("Building TURVIO brand assets")
    lockup_light = trim(color_to_alpha(Image.open(SRC / "turvio-lockup-on-light.webp"), WHITE))
    lockup_dark = trim(color_to_alpha(Image.open(SRC / "turvio-lockup-on-dark.webp"), BLACK))
    mark_light = trim(color_to_alpha(Image.open(SRC / "turvio-mark-on-light.webp"), WHITE))
    mark_dark = trim(color_to_alpha(Image.open(SRC / "turvio-mark-on-dark.webp"), BLACK))

    # Web derivatives (2x/3x-ready sizes)
    save(fit(lockup_light, width=720), DIST / "turvio-lockup-light.png")
    save(fit(lockup_dark, width=720), DIST / "turvio-lockup-dark.png")
    save(fit(mark_light, height=256), DIST / "turvio-mark-light.png")
    save(fit(mark_dark, height=256), DIST / "turvio-mark-dark.png")

    # Favicons / web app icons (light mark on transparent / white)
    save(square(mark_light, 512, 0.86), DIST / "icon-512.png")
    save(square(mark_light, 192, 0.86), DIST / "icon-192.png")
    save(square(mark_light, 180, 0.66, (255, 255, 255, 255)), DIST / "apple-icon.png")
    ico = square(mark_light, 256, 0.92)
    ico.save(DIST / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {(DIST / 'favicon.ico').relative_to(REPO)}  16/32/48")

    # Mobile app icons (Expo)
    save(square(mark_light, 1024, 0.62, (255, 255, 255, 255)), DIST / "app" / "icon.png")
    # Android adaptive icon: keep the mark inside the 66% safe zone.
    save(square(mark_light, 1024, 0.50), DIST / "app" / "android-icon-foreground.png")
    save(Image.new("RGBA", (1024, 1024), (255, 255, 255, 255)), DIST / "app" / "android-icon-background.png")
    mono = square(mark_light, 1024, 0.50)
    mono = Image.merge("RGBA", (*Image.new("RGB", mono.size, (0, 0, 0)).split(), mono.getchannel("A")))
    save(mono, DIST / "app" / "android-icon-monochrome.png")
    save(square(mark_light, 1024, 0.86), DIST / "app" / "splash-icon.png")
    save(square(mark_light, 48, 0.9), DIST / "app" / "favicon.png")

    # Distribute to the apps
    for app in ("admin", "dispatch"):
        public = REPO / "apps" / app / "public" / "brand"
        public.mkdir(parents=True, exist_ok=True)
        for name in ("turvio-lockup-light.png", "turvio-lockup-dark.png", "turvio-mark-light.png", "turvio-mark-dark.png"):
            shutil.copy2(DIST / name, public / name)
        appdir = REPO / "apps" / app / "app"
        shutil.copy2(DIST / "icon-512.png", appdir / "icon.png")
        shutil.copy2(DIST / "apple-icon.png", appdir / "apple-icon.png")
        shutil.copy2(DIST / "favicon.ico", appdir / "favicon.ico")
    driver_assets = REPO / "apps" / "driver" / "assets"
    for f in (DIST / "app").iterdir():
        shutil.copy2(f, driver_assets / f.name)
    print("Copied to apps/admin, apps/dispatch and apps/driver")


if __name__ == "__main__":
    main()
