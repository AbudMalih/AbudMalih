# TURVIO – Development roadmap

Updated 2026-11-06 (Phase 5). Originally written 2026-10-30 after the switch to a multi-tenant SaaS model (owner: Lunapact Technologies, UAE; pilot: JARBOU Logistik GmbH).

## M1 – Foundation & vertical slice ✅ (this delivery)

- Monorepo (pnpm), shared domain package with Zod validation, i18n (de/en/ro/ar), synthetic data.
- **Multi-tenant database** (Supabase/Postgres): organizations, memberships, roles, RLS on all tables, composite tenant FKs, driver RPCs, audit log, retention purge, plans/subscriptions with DB-enforced limits.
- **Tenant-isolation test suite** (PGlite) – 22 tests.
- **Tenant-aware API** (Fastify): Supabase JWT verification, tenant from URL, membership + permission checks, subscription/feature gate, optimize gateway – 9 tests.
- **Optimizer** (OR-Tools VRPTW): time windows, shifts, capacity, priorities, multi-vehicle, start/end depots, OSRM client – 11 tests.
- **Driver app**: navigation (tabs + modal + detail), home with tour progress and actions, stop list with search and manual reorder, map, manual stop entry with validation and parcel grouping, stop completion, offline persistence, server/offline optimization, RTL support – 15 tests; Android & iOS bundles build.
- **Dispatch** (read-only tour overview, tour detail with map + optimization preview, drivers, vehicles, depots) and **Admin** (tenants, plans/limits, system status) – build + tests.

## M1.5 – Premium UI & Dispatch command centre ✅ (2026-11)

- Design system (Tailwind v4 tokens, Radix-based components), official TURVIO logo integrated (raster derivatives, favicons, Expo icons).
- TURVIO Admin redesign (companies, subscriptions, activity).
- TURVIO Dispatch: map-centred workspace (tours/drivers panel, route map, details panel), List, Planning (local draft: create tours, assign drivers/vehicles, assign unassigned stops, priorities, optimization) and Pickups (deadlines, conflicts) – multi-depot pilot data for Hannover, Bremen, Kassel, Haiger.
- Depot-scoped access in Postgres (`membership_depots`, `app.can_access_depot`) and server-side scoping in Dispatch; unassigned stops in the schema.

## M2 – Real accounts, persistence & working Dispatch ✅ (2026-11, Phase 3)

Done:
- Authentication for all three apps: login, password reset, invitations, session refresh/rotation, logout, workspace switch, role- and depot-based navigation (local provider; Supabase provider implemented, not yet tested against a live project).
- Persistent Dispatch: tours, stops, parcels, drivers, vehicles, depots, team; optimize & save, depot-plan optimization, publish/withdraw, activity log, optimistic concurrency.
- Driver app on live data: only published tours, status updates via RPC, offline outbox, background sync.
- Change feed (Postgres NOTIFY → SSE) so Dispatch shows driver progress without reloading.
- Security tests (DB 39, API 31 incl. 22 integration) and a browser end-to-end test of the full dispatcher→driver workflow (15 steps).

Still open from the original M2 list:
1. Hosted Supabase project (EU, Frankfurt) – see [SETUP_SUPABASE.md](SETUP_SUPABASE.md); requires Lunapact accounts.
2. ~~Driver app redesign~~ – done in Phase 4 (M2.5).
3. ~~Proof of delivery~~ – done in Phase 4; create the private bucket in the hosted project.
4. ~~Failure reason codes, start/end options~~ – done; editing address fields of a stop, drag-and-drop reorder: open.
5. MFA for staff; CI pipeline after the repository move.

## M2.5 – Driver app (Phase 4) ✅ (2026-11, device tests pending)

Done: redesigned driver app (scan/optimize-first home, stops, map, stop detail), continuous barcode scanning, label capture with review (OCR boundary), manual/paste/CSV/XLSX import with grouping, geocoder abstraction, server optimization with start/end/locks, navigation hand-off (Google/Apple/Waze), arrival and not-delivered outcomes with configurable reasons, notes, proof of delivery (photo, signature, name, optional location) with private storage and retention, personal routes, offline outbox with idempotent retries, dark mode, de/en/ro/ar. DB-level double-booking protection; shared route metrics (Dispatch = driver figures).

Open: **device testing on Android and iOS (EAS dev builds)**, OCR engine, hosted geocoder and OSRM, native review of ro/ar texts.

## M2.6 – Native builds, OCR, routing, pilot readiness (Phase 5) ✅ local / ⏳ hosted

Done: EAS profiles and app variants; native Android APK built; on-device OCR module (ML Kit / Vision) + parser; scanner performance and battery work; OSRM integration (optimizer matrices, route geometry, road ETAs, caching, labelled fallback); self-hosted PostgreSQL geocoder + OSM import tools; route editing (edit address, drag-and-drop, merge, move, remove); map clustering; deeper offline tests; access logging and rate limits; synthetic 5-driver Hannover pilot.

Open (blockers for a real pilot): device tests on Android and iPhone, first iOS build (Apple account), hosted Supabase/OSRM/geocoder data, SMTP, MFA, penetration test, legal documents. See [PILOT_PLAN.md](PILOT_PLAN.md).

## M3 – Dispatch operations

Stop import (CSV/XLSX), geocoding provider + address autocomplete, moving stops between tours, live driver positions (privacy-reviewed, DPIA), self-hosted OSRM for road travel times, hosted map tiles.

## M4 – Scanning & OCR

Continuous barcode scanning, label OCR (recipient, address, tracking no.) with review/correct screen, manifest/PDF import, parcel-to-stop grouping from scans, load confirmation scan trail. Decide on on-device (ML Kit) vs server OCR with a DPIA.

## M5 – Optimization & reporting depth

Self-hosted OSRM (Germany extract) for road travel times, breaks, pickup→delivery pairs, workload balancing, max stops per driver, weight capacity, minimal-change "update route", package finder, reports and CSV/manifest exports, tour history and statistics.

## M6 – Customer communication & platform

Recipient notifications and tracking page (GDPR review first), public API + webhooks, i18n for web apps incl. Arabic RTL, accessibility audit.

## M7 – Commercial launch readiness

Stripe Billing activation (test mode first), self-service signup and plan changes, invoices/VAT (EU reverse charge, UAE entity), legal docs (DPA/AVV, TOMs, privacy policy), penetration test, app-store releases under the Lunapact publisher account.

## Decisions needed from the business

| Topic | Needed by |
|---|---|
| Final repository move to Lunapact (see [REPO_MIGRATION.md](REPO_MIGRATION.md)) | before M2 CI work |
| Supabase/hosting accounts owned by Lunapact, EU data region | M2 |
| Map tiles + geocoding provider (e.g. self-hosted, MapTiler, HERE, Google) | M3 |
| Pricing per plan and currency | M7 |
| Store publisher accounts and bundle IDs (`com.lunapact.turvio.driver` proposed) | M2 (TestFlight/internal testing) |
