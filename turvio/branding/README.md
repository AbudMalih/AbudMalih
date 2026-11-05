# TURVIO brand assets

`source/` holds the **official logo files exactly as supplied** (raster WebP, solid backgrounds). Do not edit them.

| Source file | Content | Use |
|---|---|---|
| `turvio-lockup-on-light.webp` | blue T symbol + navy wordmark on white | light surfaces |
| `turvio-lockup-on-dark.webp` | blue T symbol + white wordmark on black | dark surfaces |
| `turvio-mark-on-light.webp` | T symbol (blue gradient) on white | icons on light |
| `turvio-mark-on-dark.webp` | T symbol (flat blue) on black | icons on dark |

`python3 turvio/branding/build_assets.py` regenerates `dist/` and copies the results into the apps:

* transparent PNGs via an exact colour-to-alpha transform against the known background (composited on that background they reproduce the source pixels),
* empty margins trimmed (the artwork itself is never cropped), proportional scaling only,
* favicons (`favicon.ico` 16/32/48, `icon.png`, `apple-icon.png`) for Admin and Dispatch, `public/brand/*` for the in-app logo,
* Expo icons for TURVIO Driver (`icon.png`, Android adaptive foreground/background/monochrome, splash, web favicon).

**No vector version exists yet.** The supplied files are raster images; an SVG would have to be redrawn and is therefore not created without approval. Ask the designer for the original SVG/AI/PDF export – that is the preferred source for print and very large sizes.

Logo blue in the files is about `#004BFF` (light lockup) / `#0F61FB` (dark mark). The UI accent colour (`#2563EB`) is a separate design token and is not used to recolour the logo.
