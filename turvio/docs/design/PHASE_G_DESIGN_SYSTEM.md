# TURVIO Phase G – Enterprise design system (proposal, step 1)

Status: **Steps 1–2 approved. Step 3: Admin Web on the same system – awaiting approval.**
Scope of step 1: design system for Dispatch Web and Admin Web; only Dispatch Overview (and the
shared shell it sits in) is redesigned. Driver app: unchanged. Backend, data, permissions: unchanged.

## 1. Audit of the current (NEXT) visual system

| Area | Today | Problem for an enterprise product |
|---|---|---|
| Colour | Violet brand + cobalt, cyan, mint, coral, amber accents; violet gradients and glows on primary buttons, nav pill, hero cards | Six competing accents; decoration rather than meaning; reads "consumer/AI dashboard" |
| Typography | Plus Jakarta Sans, 800 weights, 26–30 px headings, uppercase tracked labels everywhere | Geometric/friendly face; heavy weights shout; uppercase labels add noise |
| Surfaces | Cards everywhere (KPIs, floating map panels), 16–22 px radii, drop shadows, backdrop blur | Visual weight in the containers, not the data; low density |
| Icons | Tinted coloured tiles behind KPI icons, coloured active nav icon | Decorative colour without information |
| Navigation | 264 px sidebar, 42 px items, violet active pill with gradient edge bar | Large and loud for daily operational use |
| Tables / lists | Tour list as stacked cards with shadows; badges as filled coloured pills | Low density; colour noise in long lists |
| Forms / controls | 40 px controls, 12 px radius, bold labels | Oversized for a desktop work tool |
| Dialogs / menus | 22 px radius, heavy overlay shadow | Fine structurally, too soft visually |
| Map | Panels float above the map with blur/shadow; colour-tinted tiles | Map partly hidden; competing with data colour |
| Responsive / RTL | Works (Phase F): logical CSS, RTL mirroring, drawer on mobile | Keep |
| Admin | Same NEXT system plus gradient hero chart card, ring chart | Will adopt the new system after Dispatch Overview approval |

## 2. Proposed system ("G")

Principles: data first; structure through borders and alignment, not colour or shadows; one accent;
colour only where it carries meaning; dense but calm; identical in EN/DE/AR, mirrored in RTL.

### Colour
| Token | Charcoal (dark, default) | Light |
|---|---|---|
| Canvas / sidebar | `#0e0f11` | `#f7f7f8` |
| Surface (panels) | `#151618` | `#ffffff` |
| Surface 2 (inputs, hover) | `#1a1b1e` | `#f7f7f8` |
| Lines (3 steps) | white 6.5 % / 10 % / 16 % | ink 7 % / 11 % / 18 % |
| Text primary / secondary / muted | `#e9eaec` / `#b1b4ba` / `#868a92` | `#18191c` / `#4b4e56` / `#6c6f78` |
| Accent (selection, focus, primary action only) | indigo `#5e6ad2` | indigo `#5e6ad2` (text `#4651b8`) |
| Success / warning / danger / info | `#4cb782` / `#d9a03d` / `#eb5757` / `#5b8def` | `#2f8a5c` / `#9a6400` / `#c93a3a` / `#3a6fd8` |
| Hover / selected | white 4 % / 7 % | ink 3.5 % / 6 % |

No gradients, glows or tinted icon tiles. Route colours on the map stay (they are functional and
match the list). Status colour is a 6 px dot plus text; red/amber text only for things needing action.

### Typography
Inter (self-hosted, OFL) for Latin, IBM Plex Sans Arabic for Arabic (unchanged). App text 13 px,
weights 400/500/600 only; page title 20/600; section headings 12–13.5/500–600 in sentence case;
figures 22/500 with tabular numerals. No uppercase tracking (also correct for Arabic, which must
never be letter-spaced).

### Spacing, radius, elevation
4 px grid; controls 32 px (28 px small); nav items 30 px; content padding 20 px. Radius 6 px
(controls), 8 px (panels), 10 px (dialogs). No shadows on in-page surfaces; a single soft shadow +
hairline on overlays (menus, dialogs, tooltips). Hairline dividers instead of card gaps.

### Components (G variants in packages/web-ui, opt-in)
Button (solid indigo primary, quiet secondary/ghost), Badge (dot + text, no fill), Card (flat,
bordered), Input/Search (32 px), Menu (6 px items, neutral highlight), Avatar (neutral circle),
EmptyState (small neutral icon), AppShell (232 px sidebar, sentence-case groups, neutral active
state, 48 px top bar, compact theme toggle), PageHeader (20 px title).

### Iconography
Lucide outline at 15–16 px, stroke 1.75–1.8, muted colour; never on coloured backgrounds; no
icons where a label suffices (KPI band has none).

## 3. Dispatch Overview prototype (implemented, real data)
* **KPI band**: one bordered band, six cells divided by hairlines – label, figure, one line of
  context; neutral 2 px progress rules; red/amber dot only for unassigned, delayed, pickup issues.
  Same figures, same links (delayed → Tours filter, pickups → Pickups).
* **Workspace**: tour list · map · details docked in one frame (no floating blurred cards), so
  the map is fully visible; panels still collapse (same controls); below 1024 px tours/map tabs,
  below 1280 px details as a drawer (unchanged behaviour).
* **Tour list**: dense rows with a 3 px route-colour mark (matches the map), name, depot, status
  as dot + text, driver/vehicle, progress fraction and a 2 px rule; selection is a neutral fill.
* **Details panel**: tour facts as a two-column definition grid with sentence-case labels;
  delay reasons as a bordered note with a coloured icon instead of a red block.
* **Map**: neutral greyscale tiles (charcoal at night, soft grey by day) so routes and states
  carry the colour; controls as small square bordered buttons.
* All existing actions, API calls, permissions, live updates, ETA logic and translations are the
  same components and code paths – only presentation differs.

## 4. Default and fallback
Since Step 2, G is the **Dispatch default** and charcoal (dark) is the default theme (light and
"follow system" remain choices in Settings / the top bar). The previous design stays available as
a fallback during development: `?ui=classic` (back with `?ui=g`), remembered per browser.

Since Step 3 the same applies to **Admin Web** (same cookie `tv_ui`, same tokens and shared
normalisations in `packages/web-ui/src/ds/g.css`). Admin's appearance choice (Follow system / Light /
Dark) is in the account menu, stored like Dispatch's. Admin has no translations (English only).

Implementation notes: G styling lives in `g:` classes next to the classic ones (classic unchanged),
plus a few global normalisations at the end of `apps/dispatch/app/globals.css` (sentence-case
labels, weights ≤ 600, no blur/lift/gradient decoration, calmer radii, compact table cells).

## 5. Next steps after approval
1. Apply G to Planning, Tours/Archive, Pickups, Analytics, Settings, Fleet (one screen at a time).
2. Admin Web on the same system.
3. Make G the default and remove the NEXT styles and the preview flag.
