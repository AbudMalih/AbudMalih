# TURVIO design system – TURVIO NEXT

One visual identity for **TURVIO Admin**, **TURVIO Dispatch** and **TURVIO Driver**, implemented from the
prototypes approved on 2026-11-11 (`design/next/*`, sources preserved unchanged). Obsidian/charcoal dark
mode (default) and warm porcelain light mode; violet for the primary action, cyan/mint/amber/coral for
meaning.

| Where | File |
|---|---|
| Approved reference | `design/next/{admin,dispatch,driver}` (`preview.html` opens locally) |
| Web tokens (Tailwind v4 `@theme`, both themes) | `packages/web-ui/src/ds/tokens.css` |
| Web components / shell / theme switch | `packages/web-ui/src/ds/*` (import from `@turvio/web-ui/ds`) |
| Mobile palette + typography | `apps/driver/src/theme.ts` |

## Principles

1. **Dark first, colour for meaning.** Obsidian canvas, charcoal surfaces, hairline borders. Violet marks the primary action and the active state; mint/amber/coral are status; cyan is route/progress.
2. **Density with air.** 13–14 px UI text, 40 px controls, 22 px card radii, 18 px grid gaps.
3. **Honest data.** Never show invented numbers. Missing values render as "—" with a reason; synthetic content carries the environment badge.
4. **Motion that explains.** Spring easing for the active pill and switches, 200–450 ms; `prefers-reduced-motion` disables motion globally.
5. **Driver first.** On mobile: 52–58 dp actions, one-handed reach, the floating tab bar keeps Scan in the thumb zone.

## Themes

`ThemeScript` (in each app's `<head>`) sets `<html data-theme>` before first paint from the stored choice
(`localStorage["turvio-theme"]`) or the system preference (dark when unknown). `ThemeSwitch` (top bar,
sign-in pages) stores an explicit choice. The Driver app follows the system unless the driver picks one.

## Tokens (values copied from the prototype)

| Token | Dark | Light | Use |
|---|---|---|---|
| `canvas` (`--bg`) | `#090B11` | `#F6F4EF` | page background |
| `surface` / `surface-2` / `raised` | `#141821` / `#1A1F2B` / `#212736` | `#FFFFFF` / `#FAF8F4` / `#FFFFFF` | cards / hovers, chips / menus, dialogs |
| `line` / `line-strong` | `rgba(166,180,224,.09/.17)` | `rgba(44,40,66,.085/.15)` | borders |
| `ink` / `ink-2` / `muted` | `#F1F3F9` / `#B4BBCC` / `#8A93A8` | `#161922` / `#454B5C` / `#646A7C` | text |
| `brand-600` (violet) | `#6F55FF` (hi `#8C76FF`, text `#AA9BFF`) | `#5B44E8` | primary, active, focus |
| `nx-cobalt` / `nx-cyan` / `nx-mint` / `nx-amber` / `nx-coral` | `#3478FF` / `#18D9E8` / `#2CE6A6` / `#FFB85C` / `#FF718B` | `#2563EB` / `#0A8B99` / `#0B8A5F` / `#A35C00` / `#CF3558` | info, route, success, warning, danger (+ `*-soft`) |
| Radii | 8 / 10 / 12 / 16 / 22 / 26 px | | tags / controls / buttons / panels / cards / hero |
| Type | Plus Jakarta Sans (Latin), IBM Plex Sans Arabic (Arabic) – self-hosted, SIL OFL | | 26/800 page titles, 15.5/700 card titles, 13–14 body, 11/700 uppercase labels |

## Components (web)

**Logo:** `Wordmark`, `TurvioLockup`, `TurvioMark` render the official raster logo from `/brand/*` (see `branding/README.md`); only the height is set so proportions are preserved. The default `tone="auto"` follows the theme.

`AppShell` (264/84 px sidebar with grouped navigation, violet active pill with cyan→violet edge bar, profile card with company switching; sticky glass top bar with ⌘K command palette, theme switch and environment badge; mobile drawer; `fullBleed` for map pages) · `ThemeScript`, `ThemeSwitch`, `useTheme` · `PageHeader` · `Card`, `CardHeader` · `KpiCard` (+ `Sparkline` for genuine series only) · `Badge` (status with dot) · `Button` (primary, dark, secondary, ghost, danger; sm/md/lg/icon) · `SearchInput` · `Checkbox` · `Menu*` (Radix dropdown incl. checkbox items) · `Tooltip` · `Sheet` (Radix dialog side panel) · `Avatar` (initials, deterministic tint) · `Skeleton`, `EmptyState`, `DemoDataTag` · `Toaster`/`toast` (Sonner) · `Dialog` (modal) · `Wordmark`/`TurvioLockup`/`TurvioMark`.

Built with Tailwind CSS v4, Radix primitives (shadcn-style composition, written in-repo), Lucide icons, Motion. Recharts is reserved for real analytics once historical data exists.

## Status language (all apps)

| Status | Tone |
|---|---|
| Active, Delivered, Picked up | success |
| Trial, In progress, Planned-with-driver | brand |
| Past due, Skipped, Trial ending ≤ 3 days, Priority | warning |
| Suspended, Failed, Payment issue | danger |
| Cancelled, Open/Pending, Unassigned | neutral |

## Rollout

- [x] **Admin** – NEXT shell and components (dashboard, companies, activity, plans, system). The prototype's delivery analytics are not shown: Admin is platform-level and reads aggregates only (owner decision 2026-11-11).
- [x] **Dispatch** – NEXT sidebar shell (Operations: Overview, Planning, Tours, Pickups · Resources: Drivers, Vehicles, Locations, Team); Overview with KPI cards and the map card with floating tour/detail panels; Planning, Tours, Pickups, Fleet.
- [x] **Driver** – NEXT palette and typography, floating tab bar with the scan button, Today hero, stop rows, gradient actions (`apps/driver`).
- [ ] Web apps are English-only; the prototypes' German/Romanian/Arabic UI needs a web translation layer (Driver is already multilingual).
