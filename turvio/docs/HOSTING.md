# TURVIO – hosting and deployment (EU)

Nothing below has been provisioned. Locally verified: the API, optimizer, OSRM (with a *synthetic* road grid) and the PostgreSQL geocoder (with a *synthetic* address fixture) work together. Hosted Supabase, SMTP, a real Germany OSRM extract and production containers are **not** verified.

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
Production with the official image (same commands, `ghcr.io/project-osrm/osrm-backend`): `osrm-extract -p /opt/car.lua germany-latest.osm.pbf`, `osrm-contract germany-latest.osrm`, `osrm-routed --algorithm ch --max-table-size 1000 --max-viaroute-size 1000 germany-latest.osrm`. Data: Geofabrik extract (© OpenStreetMap contributors, ODbL – show attribution where routes are displayed). Set `OSRM_URL` on **both** the optimizer and the API. Health check: `GET /nearest/v1/driving/9.73,52.37`.

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

Optimizer: `OSRM_URL`, `OSRM_TIMEOUT_SECONDS`, `OSRM_TABLE_CHUNK` (≤ OSRM `--max-table-size`).
Driver app (EAS environment): `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_ANDROID_API_KEY` (secret), `EAS_PROJECT_ID`.

Secrets go into the hosting provider's / EAS secret store – never into Git or chat.
