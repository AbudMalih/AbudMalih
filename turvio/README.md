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

Docs: [Architecture](docs/ARCHITECTURE.md) · [Feature parity](docs/FEATURE_PARITY.md) · [Roadmap](docs/ROADMAP.md) · [Billing](docs/BILLING.md) · [Security & privacy](docs/SECURITY_PRIVACY.md) · [Design system](docs/DESIGN_SYSTEM.md)

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

## Run

Optimizer (port 8000):

```bash
cd services/optimizer && .venv/bin/uvicorn turvio_optimizer.app:app --port 8000
```

API in development auth mode (port 4000; synthetic identity, refused in production):

```bash
cd apps/api && AUTH_MODE=dev pnpm dev
```

Dispatch (http://localhost:3000) and Admin (http://localhost:3001):

```bash
pnpm --filter @turvio/dispatch dev
```

```bash
pnpm --filter @turvio/admin dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `apps/dispatch/.env.local` to optimize through the API; without it Dispatch uses a clearly labelled in-browser heuristic.

Dispatch has no login yet; its development identity can be switched to exercise permissions (data is scoped on the server):

```bash
DISPATCH_DEV_ROLE=dispatcher DISPATCH_DEV_DEPOTS=dep_bremen,dep_kassel pnpm --filter @turvio/dispatch dev
```

Roles: `owner`, `admin` (default, company-wide), `dispatcher` (optionally limited to depots), `driver` (no dispatch data).

Driver app:

```bash
cd apps/driver && cp .env.example .env
```

```bash
cd apps/driver && npx expo run:android
```

```bash
cd apps/driver && npx expo run:ios
```

Then `pnpm dev:driver` for subsequent starts. Set `EXPO_PUBLIC_API_URL` (use your computer's LAN IP on a physical phone) to use OR-Tools; otherwise the app optimizes on-device. Android maps need `GOOGLE_MAPS_ANDROID_API_KEY`.

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

Dispatch browser tests (real Chromium against a running production build; screenshots optional):

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
| `apps/api` | JWT verification, tenant/role authorization, optimize gateway, config safety |
| `apps/driver` | store, stop form, optimizer client, Home screen rendering |
| `apps/dispatch` | planning draft, server-side scoping, components (tour list, list view, planning, pickups); `e2e/smoke.mjs` browser tests incl. responsive checks at 1920/1440/1100/800/390 px |
| `apps/admin` | platform KPIs, company table logic and component tests |
| `services/optimizer` | VRPTW constraints, OSRM client, HTTP contract |

## External services and keys

| Service | Needed for | Variable(s) | Status |
|---|---|---|---|
| Supabase (EU region) | Auth, Postgres, Storage, Realtime | `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (optional), `SUPABASE_SERVICE_ROLE_KEY` (server only) | schema ready, project not created |
| Google Maps SDK for Android | Driver map on Android builds | `GOOGLE_MAPS_ANDROID_API_KEY` | needed for Android builds |
| OSRM (self-hosted) | Road-network travel times | `OSRM_URL` | optional; falls back to labelled estimates |
| Map tiles + geocoding provider | Dispatch map in production, address search | – | decision pending (OSM public tiles are dev-only) |
| Stripe Billing | Subscriptions | – | intentionally not connected |
| Expo / EAS | Mobile builds | `eas login` | account owned by Lunapact recommended |

Never commit `.env` files. `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` values are embedded in client bundles and must not contain secrets.
