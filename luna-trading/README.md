# Luna Trading GmbH — Website (Phase 1)

A cinematic, scroll-driven corporate homepage for Luna Trading GmbH, Cologne.
Design system and architecture: **[docs/PHASE1.md](docs/PHASE1.md)**.

## Run

```bash
cd luna-trading
npm install
npm run dev        # http://localhost:3100
npm run build && npm start
npm run type-check
npm run lint
```

`NEXT_PUBLIC_SITE_URL` sets the canonical origin for metadata, sitemap and robots.

## Review modes

| URL | Purpose |
|---|---|
| `/` | Cinematic experience (WebGL + scroll choreography) |
| `/?static` | Accessible static presentation. The same presentation is served automatically for `prefers-reduced-motion` or when WebGL is unavailable |
| `/?debug` | Exposes `window.__luna` (Lenis, stage store, ScrollTrigger) for automated capture |

The intro plays once per session. Clear `sessionStorage` key `luna:intro` to see it again.

## Where things live

| Change… | Edit |
|---|---|
| Copy, company facts, nav | `content/site.ts`, section components |
| Chapter order / scroll lengths | `content/chapters.ts` |
| Capabilities, owned brands, value chain | `content/ecosystem.ts` (the dial re-lays itself out) |
| Production image sequences | `content/sequences.ts` + `public/sequences/` |
| Colours, type scale, spacing, eases | `styles/tokens.css` |
| Globe look | `lib/globe/createGlobe.ts` (shader), `lib/globe/state.ts` (camera choreography) |
| Line-world scenes / camera rail | `lib/world/models.ts`, `lib/world/createWorld.ts` (`KEYS`, `FOG`) |
| Globe land texture | `node scripts/build-globe-texture.mjs` (needs ImageMagick) |

## Open items for the client

- An approved reverse (dark-ground) version of the Luna Trading logo, if one exists. Until then the logo sits on a paper plate on dark grounds.
- Impressum data (address, register, VAT ID, managing directors), contact details, privacy policy text.
- The LUVISCENT external URL, and product photography or film for the arch media slot.
- Production renders for the terminal / transport / warehouse / product sequences.
