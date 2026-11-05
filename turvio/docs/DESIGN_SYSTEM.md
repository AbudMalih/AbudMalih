# TURVIO design system

One visual identity for **TURVIO Admin**, **TURVIO Dispatch** and **TURVIO Driver**: premium light mode, precise typography, quiet surfaces, colour used for meaning.

| Where | File |
|---|---|
| Web tokens (Tailwind v4 `@theme`) | `packages/web-ui/src/ds/tokens.css` |
| Web components | `packages/web-ui/src/ds/*` (import from `@turvio/web-ui/ds`) |
| Mobile tokens | `packages/shared/src/theme.ts` |

## Principles

1. **Calm by default, colour for meaning.** Neutral off-white canvas, white surfaces, thin borders. Blue marks the primary action and the active state; green/amber/red are reserved for status.
2. **Density with air.** Compact 13–14 px UI text, 36 px controls on web, generous but not empty spacing. No oversized plain cards.
3. **Honest data.** Never show invented numbers. Missing values render as "—" with a reason; synthetic content carries a `DemoDataTag` or the environment badge.
4. **Motion that explains.** 120–260 ms ease-out transitions (sidebar, active-nav indicator, menus, sheets). `prefers-reduced-motion` disables them globally (`tokens.css`, `MotionConfig reducedMotion="user"`).
5. **Driver first.** On mobile: 52 dp touch targets, one-handed reach, no decorative animation in time-critical flows.

## Tokens

| Token | Value | Use |
|---|---|---|
| `brand-600` | `#2563EB` | primary actions, active nav, focus |
| `navy` | `#0F172A` | wordmark tile, tooltips, dark buttons, primary text |
| `canvas` | `#F8FAFC` | app background |
| `surface` / `surface-2` | `#FFFFFF` / `#F1F5F9` | cards / hovers, table headers |
| `line` / `line-strong` | `#E2E8F0` / `#CBD5E1` | borders |
| `ink` / `muted` / `subtle` | `#0F172A` / `#64748B` / `#94A3B8` | text hierarchy |
| `success` / `warning` / `danger` | `#10B981` / `#F59E0B` / `#EF4444` | status (with `*-soft` backgrounds and `*-ink` text) |
| Radii | 6 / 8 / 12 / 16 px | badges / controls / cards / sheets |
| Shadows | `xs`, `card`, `raised` (hover), `overlay` (menus, sheets), `focus` ring | layered elevation |
| Type | Geist Sans / Geist Mono (local, via `geist` package) | 22 px page titles, 14 px section titles, 13 px body, 11 px labels (uppercase, tracked) |

## Components (web)

**Logo:** `Wordmark`, `TurvioLockup`, `TurvioMark` render the official raster logo from `/brand/*` (see `branding/README.md`); only the height is set so proportions are preserved. Use `tone="dark"` on dark surfaces.

`AppShell` (collapsible grouped sidebar with animated active indicator, workspace switcher, user menu, sticky blurred header with breadcrumbs, mobile drawer) · `PageHeader` · `Card`, `CardHeader` · `KpiCard` (+ `Sparkline` for genuine series only) · `Badge` (status with dot) · `Button` (primary, dark, secondary, ghost, danger; sm/md/lg/icon) · `SearchInput` · `Checkbox` · `Menu*` (Radix dropdown incl. checkbox items) · `Tooltip` · `Sheet` (Radix dialog side panel) · `Avatar` (initials, deterministic tint) · `Skeleton`, `EmptyState`, `DemoDataTag` · `Toaster`/`toast` (Sonner) · `Dialog` (modal) · `Wordmark`/`TurvioLockup`/`TurvioMark`.

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

- [x] **Admin** – fully on the design system (dashboard, companies, activity, plans, system).
- [x] **Dispatch** – top navigation with workspace tabs, depot switcher, date, compact operations strip; Map (three panels), List, Planning and Pickups workspaces; tour drawer. Desktop uses the top bar; below 1024 px a bottom tab bar.
- [ ] **Driver** – palette already shared via `theme.ts`; next: home redesign with Scan Parcels / Optimize actions, stop cards, bottom navigation.
