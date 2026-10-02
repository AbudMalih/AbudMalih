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

## Favicon
`public/icon.svg`, `favicon.ico` (16/32/48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `site.webmanifest`.

The monogram is the "t" of the wordmark with the Luna "+" as its crossbar, traced from the official logo geometry: an ivory "t" body with a red "+" on near-black. It reads as a letterform, not a medical cross. The full logo is unchanged.
