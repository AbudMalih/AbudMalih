# Luna Trading — Phase 1: System & Architecture

This is the reference for the Phase 1 homepage. Each section matches one item from the brief.

---

## 1 · Visual design system

**Idea.** The whole visual language comes from the logo itself:

| Logo element | System role |
|---|---|
| `luna` in graphite / `trading` in ink | **Two-tone typography.** Headlines alternate paper and graphite lines (TRADE / *WITHOUT* / BORDERS.) |
| The red `+` | **The only signal.** Route, origin, cursor, markers, progress. Nothing else is red. |
| Heavy, tightly set grotesk | **Architectural display type**, very tight tracking, uppercase |

**Surfaces.** Near-black (#060607) for most screens. Graphite line-work for technical scenes. Paper (#F2F2F0) for one surface only, the footer. That is where the official logo sits on its native light ground.

**Rules.**
- Red is under 1% of pixels on any screen. If a frame looks red, it is wrong.
- No gradients on text, no glow, no glassmorphism, no pills, no card grids.
- Stillness counts as a state. Nothing moves unless scroll or a pointer moves it, apart from one scroll cue.

**Logo handling.** Both logos are used exactly as supplied (`public/brand/`). The only change is that `luna-trading-logo-trim.webp` is the original with its transparent padding cropped; the artwork is pixel-identical. The Luna logo was drawn for light grounds (black "trading"), so on dark grounds it always sits on a paper plate. It is **never recoloured**. If an approved reverse version exists, drop it into `components/brand/Logos.tsx`.

## 2 · Typography system

| Role | Family | Use |
|---|---|---|
| Display | Inter Tight Variable (≈720 wght) | `t-mega`, `t-display`, `t-headline`. Uppercase, −0.035 to −0.055em tracking, 0.8–0.92 leading |
| Text | Inter Tight | lead / body |
| Data | IBM Plex Mono 400 | `t-label`: chapter indices, coordinates, tags (0.2em tracking) |
| LUVISCENT only | Instrument Serif Italic | "Eleganz liegt in der Luft." Used only inside the brand world |

All fonts are **self-hosted** (`@fontsource`): no Google requests, which matters for GDPR in Germany. The scale is fluid (`clamp`) and is defined in `styles/tokens.css`. Mobile has its own scale.

## 3 · Colour tokens (sampled from the logo files)

```
--luna-red      #C90216   rgb(201,2,22)   logo "+"
--luna-graphite #6B6C71   rgb(107,108,113) logo "luna"
--luna-ink      #000000   logo "trading"
--lv-mist       #F2F2F2   LUVISCENT logo
```
Neutral axis: `--ink-950 … --paper`. LUVISCENT world: `--lv-forest-*`, `--lv-emerald-*`, `--lv-gold`. These never appear in Luna surfaces, and Luna red never appears inside the LUVISCENT world.

## 4 · Spacing & grid

- 8pt base (`--s-1 … --s-11`).
- 12 columns desktop / 4 mobile. Gutter `clamp(16px,1.6vw,28px)`, margin `clamp(20px,4.2vw,72px)`, max 1760px.
- The composition is editorial: left-aligned statements anchored to the bottom-left, metadata in the corners, generous negative space. Text is centred only once, at "WE BUILD BRANDS."

## 5 · Motion principles

1. **Scroll is the timeline.** Every cinematic value is a pure function of chapter progress. Scrolling backwards reverses it exactly, and stopping the scroll stops it.
2. **One thread.** The red route runs Asia → Europe on the globe. It then becomes the line on the quay, the road guidance line, the warehouse floor line, the collapsed frame, the chain, the gold horizon (LUVISCENT), the instrument's origin, and finally the route on the globe again.
3. **Continuity over cuts.** Transitions are object hand-offs, never fade → section → fade.
4. **Eases:** `expo.out` for arrivals, `power3.inOut` for transforms, `power3.in` for departures. Scroll scrubs are linear and smoothed by Lenis plus frame-rate-independent damping.
5. **Restraint.** About three major sequences. Microinteractions only where the hand is: cursor, CTAs, nav, dial.

## 6 · Homepage scene architecture

```
00 HERO        Globe emerges · TRADE / WITHOUT / BORDERS. part · route Asia→Europe draws
01 SOURCE      ── SEQUENCE 01 ── globe dives into Cologne → top-down line-world → camera pitches to the terminal
02 TRANSPORT   ── SEQUENCE 02 ── container lowered onto a 16.5 m semi-trailer combination → road → facility
03 WAREHOUSE   door rises · hall · labels anchored in 3D (Germany / EU distribution / E-commerce / B2B)
04 BRANDS      ── SEQUENCE 03 ── one carton isolated in fog → its outline becomes the frame → WE BUILD BRANDS.
05 CHAIN       frame collapses into the red line · 7 disciplines travel it
06 LUVISCENT   red line → gold horizon · forest/gold atmosphere · arch media slot · logo
07 ECOSYSTEM   the Luna instrument: "+" origin, capability ring, owned-brand arc
08 CLOSING     instrument converges into the "+" → the Earth returns · LET'S DO BUSINESS +
   FOOTER      paper surface, official logo on its native ground
```

## 7 · Transition architecture

| Hand-off | Mechanism |
|---|---|
| Globe → line-world | Globe camera dives to Cologne while the line-world opens top-down on the red line (both looking down), then crossfade |
| Container → truck | The same container object is lowered and parented to the truck transform |
| Road → warehouse | The route continues as the floor line through the door |
| Carton → brand frame | `worldShared.carton` publishes the carton's projected screen rectangle every frame. A DOM frame starts there and opens to the editorial frame |
| Frame → chain | The frame collapses to height 0 at the chain's line position, and its bottom edge turns red |
| Chain → LUVISCENT | Same line, same position: red cross-fades to gold, then drops to become the horizon |
| Ecosystem → closing | Dial converges (scale → 0) into the "+", which hands over to Cologne on the globe |

## 8 · Technical architecture

```
app/                    Next.js 15 App Router (+ /what-we-do /brands /company /contact /impressum /datenschutz)
content/                chapters, copy, ecosystem data, sequence manifests (single source of truth)
lib/stage/store.ts      progress store — chapters WRITE their progress, layers READ & derive (pure functions)
lib/motion/             Lenis ↔ GSAP ticker bridge, pre-paint environment script
components/stage/       Chapter (scroll spacer + fixed stage, one ScrollTrigger each), GlobeLayer, WorldLayer
lib/globe/              Earth: custom shader, relief from baked height channel, Line2 route, DOM markers
lib/world/              line-world: procedural metric models, hidden-line occluders, Catmull-Rom camera rail
lib/sequence/           FrameSequence — scroll-scrubbed image sequence player
components/sections/    the nine chapters (DOM typography + scrubbed GSAP timelines)
components/chrome/      loader, navigation, cursor, progress rail, atmosphere, footer
```

**Layering.** The DOM carries all text (crisp and accessible). WebGL is used only where it adds something: one canvas for the Earth and one for the line-world. Both are fixed, render on demand (only when their derived state changes), stop while invisible, and are code-split (`three` loads async, after first paint). The line-world chunk builds during the hero, well before it is needed.

**Single trigger per chapter.** Each `<Chapter>` owns exactly one ScrollTrigger. It writes progress to the store, drives every timeline registered in that chapter, and toggles visibility with half-open intervals, so exactly one chapter stage is visible at a time.

## 9 · Asset strategy

| Scene | Phase 1 | Production |
|---|---|---|
| Earth | Real-time shader + baked land texture (`scripts/build-globe-texture.mjs`, Natural Earth via `world-atlas`) | Keep. Optionally add a baked normal map or night-side detail |
| Terminal / truck / warehouse / product | **Procedural line-world.** A deliberate technical-drawing aesthetic, not fake photorealism | Scroll-scrubbed image sequences (Blender / CGI), per segment |
| LUVISCENT | Arch media slot holding a light study. **No invented products** | `BrandMediaSlot media={…}`: photo, film or render |

**Replacing a scene with a cinematic sequence:**
1. Render frames per tier: `public/sequences/<id>/{desktop,laptop,mobile}/<id>_0001.avif` (+ `.webp`).
2. Fill the manifest in `content/sequences.ts`.

That is all that is needed. `WorldLayer` hands that segment to `FrameSequence`, which maps progress to a frame (0 → frame 1, 1 → frame N), draws the nearest loaded frame (it never shows a blank), loads keyframes first (every 16th → 8th → … → all), decodes with `createImageBitmap`, and disposes cleanly. This was verified in Phase 1 with a 40-frame test sequence: forward, backward and stop all behave correctly.

**Budgets:** desktop ≤ 300 frames per segment at AVIF q≈55 (~60–120 KB per frame), mobile ≤ 150 frames in portrait crops. Sequence preloading starts only after the hero is half-scrolled.

## 10 · Desktop / mobile behaviour

| | Desktop | Mobile (≤767px) |
|---|---|---|
| Scroll | Lenis smooth wheel | Native touch momentum (Lenis `syncTouch: false`) |
| Chapter lengths | `len` | shorter `lenM` (≈ −20%) |
| Globe | 4096² texture, 160×120 sphere, offset composition | 2048² texture, 96×72 sphere, centred, further away |
| Line-world | DPR ≤ 2, full rack field | DPR ≤ 1.5, reduced tiers (`low` drops turbines, ship detail, racks) |
| Camera | authored FOV | horizontal-FOV-preserving widening for portrait |
| Navigation | text links → "+" control after 60vh | the "+" control from the start; full-screen index |
| Cursor | "+" cursor (fine pointers only) | none |
| Ecosystem | labelled dial | numbered dial + legend list |

**Device tiers** (`detectTier`) use cores and memory to scale geometry and DPR.

## Accessibility

- `prefers-reduced-motion`, no WebGL, or `?static`: the pre-paint script picks the **static presentation**. Chapters flow as normal sections, the globe renders as one still frame, and there is no line-world, no pinning and no smooth scroll. All copy is present.
- Semantic landmarks, a skip link, `aria-label`led chapters. Every visual-only device (route index, chain stage, warehouse labels, dial) has a text equivalent in the DOM.
- Inactive chapter stages are `inert` + `aria-hidden`.
- The menu is a modal dialog with a focus trap and Esc to close. Rail ticks and dial nodes are keyboard-operable.

## No invented claims

There are no statistics, partners, locations, certifications, volumes or years. Facts used: company name, Cologne, the coordinates of Cologne, the brand names and the brand claim. Every unknown legal or contact field in `content/site.ts` is `null` and is not rendered (the Impressum shows "wird ergänzt"). The globe route is an indicative geographic sea route, not a claim about the company's lanes.
