# TURVIO – staging hosting comparison (EU only)

Status 2026-11-06: **nothing has been purchased, registered or provisioned.** Every order, including a domain, needs the owner's (Lunapact) explicit approval. Prices were collected on 2026-11-06 from the sources linked below. They exclude VAT unless marked. Several providers changed prices in 2026, so check the provider's own page before ordering. "Unverified" means only third-party pages confirmed the figure, or the sources disagreed.

## What has to run

| Component | Needs | Consequence |
|---|---|---|
| API (Fastify, Node 22) | **always-on process** with a long-lived Postgres *session* connection (Supabase session pooler, port 5432) for `LISTEN turvio_changes`, plus long-lived SSE connections to Dispatch | Hosting that scales to zero or bills per request (serverless functions, Render free tier, Vercel functions) is **unsuitable** for the API |
| Optimizer (Python, OR-Tools) | CPU-bound, 5–15 s per 100-stop tour, internal only | Dedicated or burstable vCPU; never public |
| OSRM | Region Hannover: graph prepared with about 1 GB RAM (measured), serves in < 1 GB. Germany (car, CH): about 8 GB to serve and ≥ 16 GB to prepare ([OSRM maintainer, 2018](https://lists.openstreetmap.org/pipermail/osrm-talk/2018-March/001658.html)) | RAM is the driver; see [MAP_DATA_PLAN.md](MAP_DATA_PLAN.md) |
| Dispatch / Admin (Next.js) | `next start`; they call the API server-side | Can run next to the API or on Vercel (EU region) |
| Database, Auth, Storage | Supabase `turvio-staging`, Frankfurt (already exists, Free plan) | No hosting needed; see [STAGING_MIGRATION_PLAN.md](STAGING_MIGRATION_PLAN.md) |

## Options

| Provider (EU region) | Staging setup | Approx. monthly cost | Fit | Price source |
|---|---|---|---|---|
| **Hetzner Cloud** (Falkenstein/Nuremberg, DE) | 1 VM, e.g. CX43 (8 vCPU shared, 16 GB) with Docker Compose for everything | CX43 **€15.99** after the 15 June 2026 increase (unverified, third-party). Add backups (+20 %) and a primary IPv4 | **Best for staging**: German DC, cheapest RAM, Hannover OSRM fits easily, Germany OSRM (serve) fits in 16 GB | [findstack](https://findstack.com/resources/hetzner-price-increase-2026), [privatedevops](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do); official: Hetzner price-adjustment docs (check) |
| Hetzner Cloud, larger | CX53 (16 vCPU shared, 32 GB) – enough to *prepare* Germany OSRM on the same box | **€29.49** (unverified) | Germany-wide later | same |
| Hetzner dedicated (EX44, 64 GB) | Production-class OSRM Germany + optimizer | **€46.41** incl. 19 % VAT + equal setup fee (official page); auction ~€35–40 (unverified) | Production / Germany routing | [hetzner.com/ex44](https://www.hetzner.com/dedicated-rootserver/ex44?country=de) |
| **Scaleway** (Paris) | PLAY2-MICRO (4 vCPU, 8 GB) or PRO2-XXS | PLAY2-MICRO ~€40.20; PRO2-XXS ~€40.95 (official page, after the 1 June 2026 change) | Works; about 2.5× Hetzner for less RAM | [scaleway.com pricing](https://scaleway.com/en/pricing/virtual-instances), [Scaleway blog](https://www.scaleway.com/en/blog/a-transparent-update-on-scaleway-pricing/) |
| **Fly.io** (Frankfurt `fra`) | API as an always-on Machine (no auto-stop), optimizer + OSRM as separate Machines | shared-cpu-1x 256 MB $2.19; RAM $6/GB-month; performance-1x 2 GB $33 (official). Realistic staging set (API 1 GB, optimizer 2 GB, OSRM 2 GB) ≈ **$45–60** | Possible if auto-stop is off; RAM-heavy OSRM gets expensive | [fly.io/pricing](https://fly.io/pricing) |
| **Render** (Frankfurt) | API "Standard" web service + 2 private services | Starter $7 (512 MB), Standard $25 (2 GB), Pro $85 (4 GB) per service (official) → **≈ $75–135** plus workspace fee | Simple, but costly per GB; free tier spins down (unsuitable) | [render.com/pricing](https://render.com/pricing), [compute plans](https://render.com/docs/compute-plans) |
| **AWS** eu-central-1 | Lightsail bundle (VM), or ECS Fargate tasks | Lightsail Frankfurt price: **not confirmed**. Fargate ≈ €0.046 per vCPU-hour (EU page, region unclear) → 2 vCPU/4 GB always-on ≈ €80+ (unverified) | Enterprise-grade, but the most expensive and complex for a pilot | [AWS ECS pricing](https://aws.amazon.com/ecs/pricing/), [aws.eu Fargate](https://aws.eu/fargate/pricing) |
| **Vercel** (Frankfurt `fra1`), Next.js only | Dispatch + Admin; the API stays elsewhere | Pro $20 per member/month + usage (third-party; **unverified** on Vercel's page). Functions default to US `iad1` and **must be set to `fra1`** | Optional. Running both apps on the same VM costs nothing extra | [vercel.com/docs/plans/pro](https://vercel.com/docs/plans/pro), [fra1 pricing](https://vercel.com/docs/pricing/regional-pricing/fra1) |

## Recommendation for staging

**One Hetzner Cloud VM in Germany (CX43, 16 GB) running Docker Compose**, with:
- Caddy for automatic Let's Encrypt TLS;
- the API, optimizer and OSRM (Region Hannover) containers;
- Dispatch and Admin on the same VM;
- Supabase `turvio-staging` (Free plan) for the database.

| Item | €/month |
|---|---|
| CX43 VM | ~16 (unverified after June 2026) |
| Backups (+20 %) | ~3 |
| Primary IPv4 | ~0.5–1 (check) |
| Supabase `turvio-staging` | 0 (Free plan; it pauses after inactivity, so it is not for production) |
| Domain / DNS (existing domain, sub-domain `staging.`) | 0 if an existing domain is used |
| E-mail (SMTP, EU provider) | 0–15, owner's decision (needed for invitations) |
| **Total** | **≈ €20–35** |

Why: an always-on process (LISTEN/NOTIFY and SSE), the lowest price per GB of RAM, a data centre in Germany, and a single machine is easy to reset. It also matches the existing Compose/script workflow. The risk is that all of staging is one machine, which is acceptable for a pilot. The Hetzner price pages were changed in 2026; confirm the figures on hetzner.com before ordering.

## What production would need (not now)

- **Supabase Pro** with point-in-time recovery, and a separate production project.
- **API:** 2 instances behind a load balancer. `BACKGROUND_JOBS=true` on exactly one of them.
- **Optimizer:** separate VMs.
- **OSRM Germany:** on a 32–64 GB machine (dedicated EX44-class or CX53), with blue/green data refresh.
- **Operations:**
  - monitoring and uptime alerts;
  - centralised logs without personal data;
  - WAF / rate limiting at the proxy;
  - SMTP with SPF/DKIM;
  - an incident runbook.
- **Indicative:** €150–300 per month plus Supabase Pro. Do not budget from this figure without fresh quotes.
- **Paperwork:** a DPA (AVV) with every provider, see [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md).

## Docker Compose sketch (staging VM)

Secrets live only in `/opt/turvio/.env` on the server: `chmod 600`, never committed, never pasted in chat. `DATABASE_URL` uses the `turvio_service` role and the **session** pooler on port 5432.

```yaml
# /opt/turvio/compose.yaml  (sketch – not yet used)
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes: ["./Caddyfile:/etc/caddy/Caddyfile:ro", "caddy_data:/data"]
    restart: unless-stopped
  api:
    build: { context: ./turvio, dockerfile: apps/api/Dockerfile }   # to be written
    env_file: .env            # NODE_ENV, AUTH_PROVIDER=supabase, DATABASE_URL, SUPABASE_*, PROOF_STORAGE=supabase, SMTP_URL ...
    environment:
      OPTIMIZER_URL: http://optimizer:8000
      OSRM_URL: http://osrm:5000
      GEOCODER: postgres
      BACKGROUND_JOBS: "true"
    restart: unless-stopped
  optimizer:
    build: ./turvio/services/optimizer
    environment: { OSRM_URL: "http://osrm:5000" }
    restart: unless-stopped   # not published – internal network only
  osrm:
    image: ghcr.io/project-osrm/osrm-backend:v6.0.0   # pin the version that prepared the data
    command: osrm-routed --algorithm ch --max-table-size 1000 --max-viaroute-size 1000 /data/map.osrm
    volumes: ["./osrm:/data:ro"]
    restart: unless-stopped   # not published
  dispatch:
    build: { context: ./turvio, dockerfile: apps/dispatch/Dockerfile }   # to be written
    environment: { TURVIO_API_URL: "http://api:4000" }
    restart: unless-stopped
  admin:
    build: { context: ./turvio, dockerfile: apps/admin/Dockerfile }      # to be written
    environment: { TURVIO_API_URL: "http://api:4000" }
    restart: unless-stopped
volumes: { caddy_data: {} }
```

```
# Caddyfile
api.staging.example.de      { reverse_proxy api:4000 }
dispatch.staging.example.de { reverse_proxy dispatch:3000 }
admin.staging.example.de    { reverse_proxy admin:3001 }
```

**Gaps in this sketch:**
- The Dockerfiles do not exist yet.
- The OSRM image tag must match the OSRM version that prepared the data. Locally that was the npm binaries 26.4.1, so the image tag has to be checked before use.
- The firewall must open only ports 22 (restricted), 80 and 443.
- SSH access by key only.
