# Luna Trading · Phase 2.1: Art direction, pacing, E-Commerce chapter

## The film, as it now runs
| # | Chapter | Tone |
|---|---|---|
| 00 | Hero: Handel ohne Grenzen | deep black |
| 01–02 | Terminal → truck → road | near-black → graphite |
| 03 | Warehouse | **industrial metallic** (lighter background, brighter lines) |
| 04 | Wir bauen Marken | graphite |
| 05 | The chain (six steps) | graphite, lit from above |
| **06** | **E-Commerce: Vom Produkt zur Plattform** | **light: warm off-white / silver** |
| 07 | LUVISCENT® | deep refined forest, ivory, champagne, warm light |
| 08 | Ecosystem | dark Luna |
| 09 | Closing | **brighter, calm** (silver dawn) → paper footer |

The tones are one continuous set of values in `components/chrome/Atmosphere.tsx` and `TONES` in `lib/world/createWorld.ts`. They are never a theme switch. While the light chapter dominates, `<html data-tone="light">` switches the navigation to ink and the master wordmark, and adjusts the progress rail.

## New chapter 06 · E-Commerce (`components/sections/Commerce.tsx`)
1. Light spreads outward from the product (a soft radial reveal), so there is no grey crossfade.
2. The red route from the chain retracts and arrives at one product.
3. Product → platform layers → four destinations: Onlineshop, Marktplatz, Kunde, Europäischer Markt. Three waves of order signals travel outward with the scroll.
4. A typographic platform band moves with the scroll: Shopify · WooCommerce · Marktplätze · D2C. These are technologies and channels only. There is no partner or certification wording and no third-party logos.
5. The network converges on one owned-brand node (LUVISCENT®), which opens into the champagne horizon where chapter 07 begins.

| | Headline | Second line |
|---|---|---|
| DE | Vom Produkt / zur Plattform. | **Grenzenlos verkaufen.** |
| EN | From product / to platform. | Commerce without borders. |
| AR | من المنتج / إلى المنصة. | تجارة رقمية بلا حدود. |

## Ecosystem (chapter 08)
- The Luna "+" sits at the centre. The six capabilities are placed clockwise in operating order on one ring.
- **One red arc** runs through all six: Luna connects the entire commercial chain. The gap at the bottom carries the owned-brand line down to LUVISCENT®. A signal travels the chain during the hold.
- **No native tooltip.** The SVG `<title>` is removed, and the accessible name comes from `aria-labelledby` and `aria-describedby` on HTML text.
- **Direction-independent.** The SVG instrument is a pure function of timeline time (one `render(p)`), not a set of attribute tweens. Forward, reverse and aggressive scrolling were verified pixel-identical.

## Pacing
- Chapter lengths were rebalanced in `content/chapters.ts`.
- The chain no longer carries the commerce moment and runs to its last frame.
- LUVISCENT, ecosystem and closing timelines were compressed, so the incoming chapter animates from its first scroll position.
- The closing globe now arrives as the ecosystem converges.

## LUVISCENT
- **Palette:** `--lv-forest-950 #05110d`, `--lv-emerald-700 #17372d` (desaturated), ivory `#f1ece2`, champagne `#d4c19b`. The olive and khaki are gone.
- **Slogan:** Inter Tight 300, tracked 0.08em, the same system as the wordmark. The italic serif is removed.
- **Bottom statements:** removed, and the composition rebalanced.

## Platforms & channels (addendum)
Chapter 06 reads **Product → Digital commerce → Platforms → Marketplaces → Customers / Markets**.

- **Store technology:** Shopify, WooCommerce. These connect to *Endkunden · D2C*.
- **Marketplaces:** Amazon, eBay, OTTO. These connect to *Europäische Märkte*.
- **Captions:** neutral only: "Plattformen & Vertriebskanäle" / "Commerce platforms & channels" / "منصات وقنوات التجارة الإلكترونية". There is no partner, endorsement or "powered by" wording anywhere.
- **Registry:** `content/platforms.ts` holds, for each platform, the mark (Simple Icons data, shape unmodified, monochrome ink), its source and its guideline note.
- **`useMark` switch:** all five marks are now enabled (`true`) at the client's instruction.
  - **Shopify** and **WooCommerce** publish brand / trademark guidance that permits reference use.
  - **Amazon**, **eBay** and **OTTO** restrict logo use (permission, or licensed to programme participants). Clearance for these rests with Luna Trading. Setting `useMark: false` falls back to the typographic identity.
  - Amazon's mark is a square glyph, so it is sized like Shopify's glyph rather than like the flat wordmarks.

## Favicon (LT micro-mark)
- **Design:** graphite tile `#141518`. "L" in the wordmark's luna grey, "T" in its trading light, and a small Luna-red "+" as a secondary accent. Checked at 16 / 32 / 48 px.
- **Files:** `favicon.ico` (16/32/48), `favicon-lt.svg`, `apple-touch-icon.png` + `apple-touch-icon-lt.png`, and `icon-lt-192.png`, `icon-lt-512.png`, `icon-lt-maskable-512.png` (in `site.webmanifest`).
- **Cache busting:** metadata links are versioned (`?v=lt1`, `ICON_V` in `app/[lang]/layout.tsx`), and icon files are served with `must-revalidate`.
- **Old icons removed:** the old `icon.svg` / `icon-*.png` files (the Phase 1 "+" and the Phase 2.1 "t+") are deleted, so `/icon.svg` now returns 404.

## Hero micro-refinement
- **Red period.** Only the period after GRENZEN / BORDERS / حدود is Luna red. TRADE and BORDERS stay white, WITHOUT stays graphite.
- **The period is the route's origin** (`components/sections/HeroSignal.tsx`). It is a pure function of hero progress, so forward and reverse scrolling are identical:
  - `.004–.07`: the period locks as a coordinate. A hairline graphite crosshair frames it, one red ring opens, and a subtle red pulse runs while it is active.
  - `.035–.20`: a thin red route draws from the period to the globe's route origin (East Asia).
  - `.195–.27`: the glyph hands over to a red point, which contracts from the glyph's size.
  - `.23–.32`: the point travels the route and the line retracts behind it. The crosshair tightens and settles on the origin.
  - `.31–.345`: the globe's own red route and red + take over.
- **Globe anchor.** `lib/globe/shared.ts` publishes the globe's projected origin each render, so the hand-over is exact at any viewport size and in RTL.
- **The white "+".** No static "+" exists in the hero. The floating plus was the custom cursor, left at rest while the page scrolled under a still mouse. It is now a pointer only: it fades on wheel scrolling and after 1.4 s without movement, and returns on movement. The crosshair role in the story now belongs to the route's coordinate lock.
- **Globe:** ocean and land specular, fresnel rim and halo are each about 12 % stronger. The globe stays dark.
- **Unchanged:** the right progress rail and its red marker. Static and reduced-motion modes show the red period without animation.
