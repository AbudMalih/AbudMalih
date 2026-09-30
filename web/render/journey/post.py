"""Photographic finishing for rendered frames: lens bloom around light
sources, soft vignette, subtle chromatic aberration, film grain and a
light grade. Deterministic (seeded per frame) so re-runs are identical.

    /opt/bl/bin/python post.py in_dir out_dir
"""

import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def process(src, dst, seed, grain=True):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = max(w, h) / 1600.0
    a = np.asarray(im).astype(np.float32) / 255.0

    # bloom from the brightest areas, three radii
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = np.clip((lum - 0.72) / 0.28, 0, 1)[..., None]
    hi = Image.fromarray((np.clip(a * mask, 0, 1) * 255).astype(np.uint8))
    bloom = np.zeros_like(a)
    for r, wgt in ((4, 0.35), (16, 0.3), (48, 0.22)):
        bloom += np.asarray(hi.filter(ImageFilter.GaussianBlur(r * s))).astype(np.float32) / 255.0 * wgt
    a = 1 - (1 - a) * (1 - np.clip(bloom, 0, 1))  # screen blend

    # chromatic aberration: tiny radial offset of red/blue towards the edges
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)
    r2 = nx * nx + ny * ny
    shift = 0.9 * s
    for ch, k in ((0, 1), (2, -1)):
        sx = np.clip(xx + nx * shift * k, 0, w - 1).astype(np.int32)
        sy = np.clip(yy + ny * shift * k, 0, h - 1).astype(np.int32)
        a[..., ch] = a[sy, sx, ch]

    # grade: cool shadows, neutral mids, gentle contrast
    a = a + (1 - a) ** 3 * np.array([-0.004, 0.002, 0.012], dtype=np.float32)
    a = np.clip(a, 0, 1)
    a = a * a * (3 - 2 * a) * 0.18 + a * 0.82

    # vignette
    a *= (1 - 0.22 * np.clip(r2 * 0.6, 0, 1.4))[..., None]

    if not grain:  # the website adds animated grain as an overlay
        Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst, optimize=False)
        return
    # film grain (luminance weighted towards the mids)
    rng = np.random.default_rng(seed)
    g = rng.normal(0, 1, (h, w)).astype(np.float32)
    g = np.asarray(Image.fromarray(((g * 0.25 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.55 * s))).astype(np.float32) / 255 - 0.5
    lum = a.mean(axis=2, keepdims=True)
    a += g[..., None] * 0.055 * (0.35 + lum * (1 - lum) * 2.2)

    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst, optimize=False)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src, "f*.png"))):
        n = os.path.basename(f)
        out = os.path.join(dst, n)
        if "--skip-existing" in sys.argv and os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(f):
            continue
        process(f, out, int(n[1:4]), grain="--no-grain" not in sys.argv)


if __name__ == "__main__":
    main()
