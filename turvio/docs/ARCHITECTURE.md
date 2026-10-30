# TURVIO – Architecture

**TURVIO — Smart Routes. Simple Deliveries.**
Software/IP owner (intended): Lunapact Technologies, UAE. First pilot customer: JARBOU Logistik GmbH, Germany.

TURVIO is a **multi-tenant SaaS** platform for route optimization and delivery management. Every logistics company that subscribes is an isolated tenant (an *organization*). JARBOU is the first tenant, not a special case in the code.

Status as of 2026-10-30: first vertical slice. See [ROADMAP.md](ROADMAP.md) for what is done and what is next, and [FEATURE_PARITY.md](FEATURE_PARITY.md) for feature coverage.

---

## 1. System overview

```
 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │  TURVIO Driver   │   │ TURVIO Dispatch  │   │  TURVIO Admin    │
 │ Expo/React Native│   │ Next.js (tenant  │   │ Next.js (platform│
 │  iOS + Android   │   │ admins/dispatch.)│   │  operators)      │
 └───────┬──────────┘   └───────┬──────────┘   └───────┬──────────┘
         │ HTTPS (JWT)          │ HTTPS (JWT)          │ HTTPS (JWT)
         ▼                      ▼                      ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Supabase                                  │  TURVIO API (apps/api)│
 │  • Auth (users, JWT)                      │  Node.js + Fastify    │
 │  • PostgreSQL + Row Level Security  ◄─────┤  • tenant resolution  │
 │  • Storage (private bucket "proofs")      │  • permission checks  │
 │  • Realtime (tour progress) [planned]     │  • plan/limit checks  │
 └───────────────────────────────────────────┤  • optimize gateway   │
                                             │  • billing [planned]  │
                                             └──────────┬────────────┘
                                                        │ internal HTTP
                                             ┌──────────▼────────────┐
                                             │ Optimizer service     │
                                             │ Python + OR-Tools     │──► OSRM (road matrix,
                                             │ (services/optimizer)  │     self-hosted) [planned]
                                             └───────────────────────┘
```

Clients talk to Supabase directly for plain CRUD (protected by RLS), and to the TURVIO API for anything that needs server-side logic: optimization, imports, OCR, billing, cross-table workflows. The optimizer is an **internal** service and is never exposed to the internet.

## 2. Monorepo layout

```
turvio/
├── apps/
│   ├── driver/      Expo SDK 58 + Expo Router (TypeScript)      – TURVIO Driver
│   ├── dispatch/    Next.js 16 (App Router)                     – TURVIO Dispatch
│   ├── admin/       Next.js 16 (App Router)                     – TURVIO Admin
│   └── api/         Fastify 5 (TypeScript, run with tsx)        – TURVIO API
├── packages/
│   ├── shared/      Domain types, Zod schemas, permissions, billing rules,
│   │                i18n (de/en/ro/ar), geo utils, offline heuristic, synthetic data
│   ├── web-ui/      Shared light-theme shell + CSS tokens for the two web apps
│   └── db/          Migration + tenant-isolation tests (PGlite)
├── services/
│   └── optimizer/   Python 3.13, FastAPI, Google OR-Tools
├── supabase/
│   └── migrations/  SQL schema, RLS policies, billing tables
└── docs/
```

pnpm workspaces with a hoisted `node_modules` (`.npmrc: node-linker=hoisted`) — the most reliable layout for React Native/Metro. `@turvio/shared` is consumed as TypeScript source (no build step); Next.js transpiles it (`transpilePackages`), Metro and Vitest handle TS natively.

## 3. Multi-tenancy

### 3.1 Model

| Concept | Table | Notes |
|---|---|---|
| Tenant | `organizations` | status: trialing / active / past_due / suspended / cancelled; per-tenant retention settings |
| User | `auth.users` (Supabase) + `profiles` | one login can belong to several tenants |
| Tenant role | `memberships (organization_id, user_id, role)` | `owner`, `admin`, `dispatcher`, `driver` |
| Platform operator | `platform_admins` | Lunapact staff; **not** a tenant member, sees tenants & subscriptions, *not* operational data |
| Subscription | `subscriptions` (1 per tenant) + `plans` | limits, seats, trial, Stripe IDs (inactive) |
| Tenant data | `depots, vehicles, drivers, tours, stops, parcels, stop_events, proofs, location_pings, audit_log` | every row has `organization_id` |

### 3.2 Isolation – defence in depth

1. **Row Level Security on every table.** Policies call `SECURITY DEFINER` helpers in the non-exposed `app` schema (`app.is_org_member`, `app.is_org_staff`, `app.is_org_admin`, `app.my_driver_ids`, `app.is_platform_admin`). Suspended tenants lose access automatically.
2. **Composite foreign keys** `(organization_id, id)`: a tour can only reference a driver/vehicle/depot *of the same tenant*, even for the service role.
3. **Explicit tenant in every API route** (`/v1/orgs/:orgId/...`). The API never infers the tenant from a request body. "Unknown org" and "not a member" return the same 403 to prevent tenant enumeration.
4. **Drivers never get direct UPDATE rights** on tours/stops. Status changes go through `driver_set_stop_status()` / `driver_set_tour_status()` which check ownership and enforce the state machine; every change is appended to `stop_events`.
5. **Storage paths** for proofs must start with the tenant id (`<organization_id>/<stop_id>/…`), enforced by a CHECK constraint (bucket policies: planned with the upload feature).
6. **Service role** (bypasses RLS) is used only server-side, never shipped to clients.

All of this is covered by automated tests (`packages/db`, 22 tests against a real Postgres engine via PGlite): cross-tenant reads/writes, FK cross-references, role restrictions, owner-role escalation, platform-admin scope, suspended tenants, plan limits, audit, retention.

### 3.3 Roles and permissions

The permission matrix lives in `packages/shared/src/permissions.ts` and mirrors the RLS policies.

| Capability | owner | admin | dispatcher | driver |
|---|:-:|:-:|:-:|:-:|
| Company settings, members, audit log, billing view | ✓ | ✓ | | |
| Grant/revoke **owner** role | ✓ | | | |
| Manage depots | ✓ | ✓ | | |
| Manage drivers, vehicles, tours, stops; imports; live tracking; reports/exports | ✓ | ✓ | ✓ | |
| See own tours, add stops to own tour, set stop status, optimize own tour | ✓ | ✓ | ✓ | ✓ |

### 3.4 Authentication

Supabase Auth issues JWTs. The API verifies them with `jose` (project JWKS, or the legacy HS256 secret), checks issuer and audience, then resolves the membership for the tenant in the URL. `AUTH_MODE=dev` (synthetic identity, no token) exists for local development and is refused when `NODE_ENV=production`.

Login UIs in the three apps are **not yet built** (next milestone).

## 4. Subscriptions and limits

See [BILLING.md](BILLING.md). Plans (`driver_solo`, `team`, `business` – placeholder prices) define limits; per-driver plans use purchased seats as the driver limit; tenants can get overrides. Limits are enforced **in the database** (trigger on drivers/vehicles/depots) and checked in the API (`checkLimit`, plan features). Payments are disabled.

## 5. Route optimization

* **Engine:** Google OR-Tools routing solver (VRPTW) in `services/optimizer`.
* **Constraints supported now:** multiple vehicles; per-vehicle start and end location (depot or current position → re-optimization); time windows; service time per stop; shift duration limit; parcel capacity; priority stops (very high drop penalty + soft "as early as possible" cost); infeasible stops are returned as unassigned instead of failing the whole request.
* **Search:** parallel cheapest insertion + guided local search, bounded by a time limit. The response status is `feasible`, never "optimal": local search does not prove optimality.
* **Travel times:** OSRM table service when `OSRM_URL` is set (self-hosted, Germany extract – planned), otherwise a clearly labelled straight-line estimate (haversine × 1.35 at 30 km/h).
* **Offline fallback (driver app):** nearest-neighbour + 2-opt on estimates, priority stops first, *no* time windows. The UI states which engine was used.
* **Planned:** breaks (OR-Tools break intervals), linked pickup→delivery pairs, workload balancing, traffic-aware matrices.

## 6. Driver app

Expo Router (file-based) with tabs Today / Stops / Map / Settings, plus Add-stop (modal) and Stop detail. State in Zustand persisted to AsyncStorage → the current tour works offline. Maps via `react-native-maps` (Apple Maps on iOS; Google Maps on Android needs an API key in dev/prod builds). Navigation handoff via deep links to Apple Maps / Google Maps. Server sync with Supabase is the next milestone; today the app runs on synthetic data.

## 7. Internationalization

`packages/shared/src/i18n` holds typed message catalogues for **de, en, ro, ar** with a test that keys and placeholders match. Device locale is detected via `expo-localization`; Arabic switches the app to RTL (`I18nManager.forceRTL`, effective after app restart – a React Native constraint). Romanian and Arabic texts are machine-assisted drafts that need native review. The web apps are German/English only so far (i18n wiring planned).

## 8. Security and privacy

See [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md). Highlights: TLS everywhere, RLS + API authorization, least-privilege roles, audit log without personal data copies, per-tenant retention for location pings and proofs, location only during active tours, no carrier (e.g. DHL) integrations without written authorization.

## 9. Maps and tiles

The Dispatch map uses Leaflet with OpenStreetMap's public tiles **for development only** (OSM tile usage policy). Production needs a commercial or self-hosted tile provider – decision pending (see roadmap).
