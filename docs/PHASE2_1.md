# Luna Trading · Phase 2.1: Art direction, pacing, E-Commerce chapter

## The film, as it now runs
| # | Chapter | Tone |
|---|---|---|
| 00 | Hero: Handel ohne Grenzen | deep black |
| 01–02 | Terminal → truck → road | near-black → graphite |
| 03 | Warehouse | **industrial metallic** (lighter background, brighter lines) |
| **04** | **Wir bauen Marken** | **first light moment:** metallic grey → silver → warm ivory |
| 05 | The chain (six steps) | warm ivory, tactile, ink type |
| 06 | E-Commerce: Vom Produkt zur Plattform | cooler, cleaner off-white / silver, fine digital grid |
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

## Final addendum: brand light and the LUVISCENT transition

### Colour rhythm
Black hero → dark trade → dark / metallic logistics → **light brand development** → **light digital commerce** → deep emerald / ivory LUVISCENT → dark Luna ecosystem → calmer closing. The hero stays dark.

### 04 · "Wir bauen Marken": the first light moment
- **The world brightens.** While the camera isolates the carton, the line-world brightens from metallic grey through silver to warm ivory. Background, fog and occluders share one tone table (`lib/world/tones.ts`), so there is no cut. The hall's lines dissolve into the light, and the carton is drawn in ink: it becomes isolated and intentional.
- **Atmosphere.** Behind the world, the atmosphere uses the same tone, so the world can fade out without a seam. The light is tactile, not a flat page: daylight from the upper left, a soft plane of window light that travels slowly with the scroll, and a fine paper / plaster grain.
- **Packaging net.** The carton's outline opens into an editorial frame with graphite crop marks. Behind the statement, the carton unfolds into its packaging net (panels, flaps, dashed fold lines). It suggests product development, packaging and brand construction without cards or diagrams.
- **Type.** The statement is ink on warm ivory. The only red is the period.
- **Into the chain.** The frame collapses into the red line of the chain. The chain (05) stays in the warm ivory light, with ink type.

### 06 · E-Commerce: digital, cooler and more precise
- **Reveal.** The cooler off-white / silver environment spreads outward from the product over the warm ivory, carrying a barely visible digital grid. Brand reads as warm, tactile and physical; commerce reads as cool, precise and networked.
- **The network simplifies.**
  - The channel caption, group labels and destinations leave first.
  - Then each platform leaves one by one, each taking its own two routes with it.
  - Finally the layers collapse.
- **The node.** The red connection runs from the product to the one remaining node, LUVISCENT (ink ring, red point).

### 06 → 07 · Digital commerce becomes atmosphere
All of this runs in `components/chrome/Atmosphere.tsx` and is a pure function of `0.58 × commerce(0.8–1) + 0.42 × luviscent(0–0.22)`. It spans the chapter boundary, so there is no dead scroll.
1. The red line opens across the viewport and stops being rigid. It becomes an organic, slowly moving strand, pinned at the node.
2. The red warms to champagne.
3. Translucent, softly diffused light strands appear. These are blurred light, not particles, smoke or sparkles.
4. The digital grid disappears first, and the silver warms to ivory.
5. A warm ivory wave front opens from the node. Deep emerald emerges behind it as a wide, soft band along the air (a dusk, not a disc), closing to full cover before the light layers are removed.
6. The main strand flattens into the champagne horizon of LUVISCENT. In LUVISCENT, faint, very slow air remains.

### 07 · LUVISCENT
- **The room emerges first.** A plastered emerald wall, washed from above, with a mineral tooth, and one arched niche. The niche has:
  - a warm evening downlight from the crown
  - the niche's depth (crown and jamb shadows, a lit edge)
  - a stone ledge with pooled light
  - a single olive sprig seen only as a soft cast shadow (nearly still)
  - a champagne hairline on the lit edge
- **Ready for the real product.** No product is invented. `BrandMediaSlot` takes `media`: an image stands on the ledge (contain, bottom centre, with a contact shadow), and a video fills the niche. Light, ledge and shadow stay, so the scene needs no redesign.
- **The mark.** The official mark is revealed by a soft wipe of light that travels with the air (mirrored in RTL). Only its visibility changes. The image is never redrawn or restyled.
- **The slogan.** "Eleganz liegt in der Luft." follows with the same, slower wipe. Modern sans, no blur, no per-character animation.
- **Motion is calm.** Once established, the room and the words drift apart by a few pixels, the downlight swells very slightly, and the air moves slowly. There is no network-style motion.

### Reverse and continuity
- **Pure functions.** Every value is a function of scroll progress. The verification script compares forward, reverse, fast, rapidly reversed and partial-then-reverse captures from warehouse 0.8 to LUVISCENT 0.7. The frames match. The only residual differences are sub-pixel text anti-aliasing after smooth-scroll landings.
- **Visibility fix.** A chapter stage left visible when scrolling up from exactly its first frame (its progress does not change, so no update fired) is fixed in `components/stage/Chapter.tsx`: visibility is re-checked on every scroll.
- **No dead scroll.** Consecutive forward frames change throughout. Quiet holds still progress through the moving window light (chain) and the LUVISCENT depth drift.
- **Unchanged:** hero, trade, truck, warehouse, ecosystem, navigation, footer and the language system. A small fix: on 768–1199 px laptops the commerce channel caption now sits on its own line.
