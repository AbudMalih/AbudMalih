# TURVIO

**Smart Routes. Simple Deliveries.**

Multi-tenant SaaS for route optimization and delivery management. Intended software/IP owner: Lunapact Technologies (UAE). First pilot customer: JARBOU Logistik GmbH (Germany).

> This folder is self-contained and independent of the JARBOU website in the repository root. See [docs/REPO_MIGRATION.md](docs/REPO_MIGRATION.md) for the planned move to a private Lunapact repository.

| App | Path | Stack |
|---|---|---|
| TURVIO Driver (iOS/Android) | `apps/driver` | Expo SDK 58, Expo Router, React Native 0.88 |
| TURVIO Dispatch (tenant web dashboard) | `apps/dispatch` | Next.js 16 |
| TURVIO Admin (platform administration) | `apps/admin` | Next.js 16 |
| TURVIO API | `apps/api` | Node.js 22, Fastify 5 |
| Optimizer | `services/optimizer` | Python 3.13, FastAPI, Google OR-Tools |
| Database | `supabase/migrations` | Supabase Postgres + RLS |

Branding: official logo files in [`branding/`](branding/README.md) (raster; no vector version yet).

Docs: [Architecture](docs/ARCHITECTURE.md) · [Driver app](docs/DRIVER_APP.md) · [Device testing](docs/DEVICE_TESTING.md) · [Hosting](docs/HOSTING.md) · [Production checklist](docs/PRODUCTION_CHECKLIST.md) · [Pilot plan](docs/PILOT_PLAN.md) · [Feature parity](docs/FEATURE_PARITY.md) · [Roadmap](docs/ROADMAP.md) · [Billing](docs/BILLING.md) · [Security & privacy](docs/SECURITY_PRIVACY.md) · [Design system](docs/DESIGN_SYSTEM.md)

All data in development is **synthetic** (fictional people, made-up `TVO…` tracking numbers). There is no connection to DHL or any other carrier.

## Prerequisites

* Node.js ≥ 22 and pnpm 10 (`corepack enable`)
* Python 3.11+ (3.13 tested) for the optimizer
* For the mobile app: Expo Go is **not** enough (react-native-maps etc. need a development build) → Android Studio emulator / Xcode simulator, or an EAS development build on a phone

## Install

```bash
cd turvio
```

```bash
pnpm install
```

```bash
cd services/optimizer && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
```

## Run (complete local stack)

Everything runs locally without Docker: PostgreSQL 16 (system binaries), the OR-Tools optimizer, the API, Dispatch, Admin and a web build of TURVIO Driver.

```bash
scripts/dev-stack.sh up --fresh
```

`--fresh` resets the database (`scripts/db.sh reset`: Supabase-compatible stubs, all migrations, local auth schema) and seeds **synthetic** data: JARBOU Logistik GmbH with depots Hannover, Bremen, Kassel, Haiger (Hannover starts empty, the others have a live-looking day) and a second company, Muster Kurier GmbH. Add `--no-demo` for empty tours everywhere.

| App | URL |
|---|---|
| TURVIO Dispatch | http://localhost:3000 |
| TURVIO Admin | http://localhost:3001 |
| TURVIO Driver (web build, for testing) | http://localhost:8081 |
| API / dev mailbox (reset & invitation mails) | http://localhost:4000 · http://localhost:4000/v1/dev/outbox |

Development accounts (password `Turvio-Demo-2026`, override with `SEED_PASSWORD`; local only):

| Account | Role |
|---|---|
| `ops@turvio.test` | platform admin (TURVIO Admin) |
| `owner@jarbou.test` | JARBOU owner (all depots) |
| `dispatch.hannover@jarbou.test` / `dispatch.bremen@jarbou.test` | dispatchers limited to one depot |
| `lena.hoffmann@jarbou.test`, `mihai.popescu@jarbou.test` (Hannover), `aylin.demir@jarbou.test` (Bremen) | drivers |
| `owner@muster.test`, `driver@muster.test` | second company |

```bash
scripts/dev-stack.sh down
```

Individual pieces: `scripts/db.sh start|reset|psql|url`, `pnpm --filter @turvio/api seed`, `pnpm --filter @turvio/api dev` (see `apps/api/.env.example`), `pnpm --filter @turvio/dispatch dev` with `TURVIO_API_URL`.

Driver app on a phone/emulator (needs a development build because of native modules):

```bash
cd apps/driver && EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000 npx expo run:android
```

Without `EXPO_PUBLIC_API_URL` the driver app runs in offline demo mode with synthetic data.

Hosted Supabase (EU): see [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md).

## Test

Everything (JS/TS):

```bash
pnpm test
```

```bash
pnpm typecheck
```

Optimizer:

```bash
cd services/optimizer && .venv/bin/pytest -q
```

Builds:

```bash
pnpm --filter @turvio/dispatch build && pnpm --filter @turvio/admin build
```

```bash
cd apps/driver && EXPO_OFFLINE=1 npx expo export --platform android --platform ios
```

API integration tests run against the local PostgreSQL (start it with `scripts/db.sh start`; they are skipped with a warning if it is not reachable).

End-to-end workflow (dispatcher → driver, all apps, real database and optimizer):

```bash
scripts/dev-stack.sh up --fresh && SCREENSHOT_DIR=/tmp/turvio-e2e node e2e/workflow.mjs
```

Dispatch UI browser tests (synthetic-data era smoke suite; screenshots optional):

```bash
pnpm --filter @turvio/dispatch build && pnpm --filter @turvio/dispatch start
```

```bash
SCREENSHOT_DIR=/tmp/turvio-shots pnpm --filter @turvio/dispatch e2e
```

Brand assets (regenerate after replacing files in `branding/source/`):

```bash
python3 branding/build_assets.py
```

| Suite | What it covers |
|---|---|
| `packages/shared` | schemas, stop logic, offline heuristic, i18n completeness, permissions, billing rules |
| `packages/db` | migrations + **tenant isolation**, **depot scope**, roles, plan limits, audit, retention (PGlite = real Postgres engine) |
| `apps/api` | unit: JWT, authorization, config · **integration on PostgreSQL**: auth (rotation, reuse detection, throttling, reset), invitations, tenant/depot/driver/platform isolation, 25-stop workflow, version conflicts, change feed, plan limits |
| `apps/driver` | store (outcomes, scans, locks, personal routes), offline outbox (persistence across restarts, interrupted uploads, rejected items), proof-of-delivery upload, on-device optimizer fallback, label review, navigation hand-off, Home / stop / outcome screens, address search |
| `apps/dispatch` | planning helpers, server-side scoping, components (tour list, list view, planning, pickups) |
| `apps/admin` | platform KPIs, company table logic and component tests |
| `services/optimizer` | VRPTW constraints, OSRM client, HTTP contract |
| `packages/web-session` | cookie sessions, API proxy (refresh, binary proof files), page guard |
| `e2e/workflow.mjs` | Playwright across Dispatch, Driver (web build), Admin and API: dispatcher → driver scenario incl. scanning (manual entry), proof of delivery (signature), not-delivered outcome, notes, offline queue, server optimization, personal route + import, cross-tenant checks |
| `e2e/driver-screens.mjs` | Driver screenshots (light, dark, Arabic RTL) |
| `e2e/pilot.mjs` | synthetic JARBOU pilot: 5 drivers, 5 tours, 50–100 stops, optimization, deliveries, proofs, offline replay, monitoring |
| `e2e/phase5-screens.mjs` | road route (OSRM) and address-search screenshots |

## External services and keys

| Service | Needed for | Variable(s) | Status |
|---|---|---|---|
| Supabase (EU region) | Auth, Postgres, Storage, Realtime | `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (optional), `SUPABASE_SERVICE_ROLE_KEY` (server only) | schema ready, project not created |
| Google Maps SDK for Android | Driver map on Android builds | `GOOGLE_MAPS_ANDROID_API_KEY` | needed for Android builds |
| OSRM (self-hosted) | Road-network travel times | `OSRM_URL` | optional; falls back to labelled estimates |
| Map tiles | Dispatch map in production | – | decision pending (OSM public tiles are dev-only) |
| Geocoding (self-hosted) | Address search, import geocoding | `GEOCODER=postgres` (+ OSM import) or `nominatim`/`photon` + `GEOCODER_URL` | optional; without it addresses are kept as "needs map position" |
| On-device OCR | Reading parcel labels | – | built in (ML Kit / Apple Vision), no service or key |
| Stripe Billing | Subscriptions | – | intentionally not connected |
| Expo / EAS | Mobile builds | `eas login` | account owned by Lunapact recommended |

Never commit `.env` files. `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` values are embedded in client bundles and must not contain secrets.
