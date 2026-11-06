# TURVIO – hosting and deployment (EU)

Nothing below has been provisioned. Locally verified (2026-11-06) with **real OpenStreetMap data for Region Hannover** (BBBike extract `Hannover.osm.pbf`, data as of 2026-10-31, bbox 9.18–10.15 E / 52.07–52.67 N, MD5 checked):
- OSRM car routing: graph built in 46 s. Hannover Hbf → Messe is 11.8 km / 14.8 min.
- PostgreSQL geocoder: 326,599 addresses imported in 11 s.
  - House-level hits for umlaut and ASCII spellings, `str.`, and queries without a postcode.
  - An unknown house number gives a street-level result; an unknown street gives no result.
  - Some public buildings have no address in OSM, e.g. Trammplatz 2 (New Town Hall). These give **no** result, and the driver sets the pin by hand.
- Synthetic JARBOU pilot on these real roads and real public addresses, with fictional recipients: 7/7 checks, every optimisation on the `osrm` matrix ([report](pilot-report-2026-11-06-real-osm.json)).

Hosted Supabase (audit only, see [STAGING_MIGRATION_PLAN.md](STAGING_MIGRATION_PLAN.md)), SMTP, a full Germany extract and production containers are **not** verified.

## Components

| Component | Runs where | Size (pilot) | Notes |
|---|---|---|---|
| Supabase (Postgres, Auth, Storage) | Supabase, region **Frankfurt (eu-central-1)** | Pro plan | see [SETUP_SUPABASE.md](SETUP_SUPABASE.md) |
| API (`apps/api`, Node 22) | EU container service (e.g. Hetzner, Scaleway, AWS eu-central-1) | 1 vCPU / 1 GB, 2 instances | HTTPS behind a load balancer; long-lived SSE connections |
| Optimizer (`services/optimizer`, Python 3.13 + OR-Tools) | same network, **not public** | 2 vCPU / 2 GB | CPU-bound; 5–15 s per 100-stop tour |
| OSRM (`osrm-routed`) | same network, **not public** | Germany: ~16 GB RAM for preprocessing, ~8 GB to serve (CH); Niedersachsen only: ~2–3 GB | weekly data refresh |
| Geocoder | Postgres (`geo.addresses`) – no extra service | ~25–30 M German addresses ≈ 4–6 GB incl. indexes | or a self-hosted Photon/Nominatim |
| Dispatch / Admin (Next.js) | Vercel EU region or a container | small | need `TURVIO_API_URL` only |

## Database migrations
1. `supabase link --project-ref <ref>` then `supabase db push` (applies `supabase/migrations/*.sql` in order). Never apply `supabase/local/*`.
2. Schedule retention: `select cron.schedule('turvio-retention', '17 3 * * *', 'select app.purge_expired_data()');` (or keep `BACKGROUND_JOBS=true` on exactly one API instance).
3. Before every production migration: backup/PITR checkpoint, run on a staging project first.

## OSRM (road routing)
```bash
scripts/osrm-local.sh prepare germany-latest.osm.pbf
```
```bash
scripts/osrm-local.sh start
```
Production with the official image (same commands, `ghcr.io/project-osrm/osrm-backend`): `osrm-extract -p /opt/car.lua germany-latest.osm.pbf`, `osrm-contract germany-latest.osrm`, `osrm-routed --algorithm ch --max-table-size 1000 --max-viaroute-size 1000 germany-latest.osrm`. Data: Geofabrik extract, or for a single region the BBBike city extract (e.g. `https://download.bbbike.org/osm/bbbike/Hannover/Hannover.osm.pbf`, about 80 MB; verify against its `CHECKSUM.txt`). © OpenStreetMap contributors, ODbL: show attribution where routes are displayed. Region Hannover needs about 1 GB RAM to prepare. Set `OSRM_URL` on **both** the optimizer and the API. Health check: `GET /nearest/v1/driving/9.73,52.37`.

Failure behaviour (implemented + tested): optimizer and API time out (`OSRM_TIMEOUT_SECONDS`, `OSRM_TIMEOUT_MS`), fall back to the straight-line estimate and label it (`matrixNote`, `source: "none"`); results are cached in memory.

## Geocoder (self-hosted, no paid service)
```bash
python3 tools/osm_addresses.py germany-latest.osm.pbf > addresses.csv
```
```bash
cd apps/api && DATABASE_URL=… npx tsx src/scripts/import-addresses.ts addresses.csv --replace
```
Then `GEOCODER=postgres`. Refresh monthly. Public Nominatim/Photon instances must not be used for production traffic.

## Environment variables (API)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `AUTH_PROVIDER` | `supabase` |
| `DATABASE_URL`, `DATABASE_SSL=true` | Supabase connection string (secret) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase settings (service key = secret) |
| `PROOF_STORAGE=supabase`, `PROOF_BUCKET=proofs` | private bucket |
| `OPTIMIZER_URL` | internal URL of the optimizer |
| `OSRM_URL`, `OSRM_TIMEOUT_MS` | internal OSRM URL |
| `GEOCODER=postgres` | after importing addresses |
| `MAILER=smtp`, `SMTP_URL`, `MAIL_FROM` | EU SMTP provider (secret) |
| `DISPATCH_URL`, `ADMIN_URL`, `CORS_ORIGINS` | public HTTPS origins |
| `RATE_LIMIT_PER_MINUTE` | 600 (plus a WAF/proxy limit) |
| `BACKGROUND_JOBS` | `true` on one instance, `false` on the others |
| `DEV_MAILBOX` | `false` (refused in production) |
| `REQUIRE_ADMIN_MFA` | `true` (default in production) – admin and platform endpoints need two-step verification |

Optimizer: `OSRM_URL`, `OSRM_TIMEOUT_SECONDS`, `OSRM_TABLE_CHUNK` (≤ OSRM `--max-table-size`).
Driver app (EAS environment): `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_ANDROID_API_KEY` (secret), `EAS_PROJECT_ID`.

Secrets go into the hosting provider's / EAS secret store – never into Git or chat.
