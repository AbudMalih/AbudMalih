# TURVIO NEXT – approved design prototypes (reference, do not edit)

These are the original sources of the three interactive prototypes approved on 2026-11-11.
They are the visual reference for the real apps. They are **not** part of any app build.

| App | Approved prototype | Folder |
|---|---|---|
| Platform Admin | https://claude.ai/artifact/SaFpTi62sQaDk4Hj3uLiaS | `admin/` |
| Dispatch | https://claude.ai/artifact/EE6GFSJYaGVhU6PtYeSmFz | `dispatch/` |
| Driver (mobile) | https://claude.ai/artifact/KK4N7Xerdiez8sRZbXmfRv | `driver/` |

State: final approved versions, including the refined maps and the official TURVIO logo
(last published 2026-11-11 19:38 UTC).

- `*/index.html` – the approved, self-contained page (as published).
- `*/preview.html` – the same page wrapped in a document, for opening locally in a browser.
- `*/build.sh` – rebuilds `index.html` from the sources in its folder and `../brand/`
  (run inside the folder: `bash build.sh`). The rebuild is byte-identical to the approved page.
- `brand/` – the official TURVIO logo, icon and favicon assets as embedded in the prototypes.
- `admin/ne.js`, `admin/ne_region.json` – Natural Earth region outlines for the Admin map
  (public domain); `admin/clip_ne.py` clipped them.

Data in the prototypes is fictional demo data. Fonts: Plus Jakarta Sans and IBM Plex Sans Arabic
(Google Fonts, SIL Open Font License).
