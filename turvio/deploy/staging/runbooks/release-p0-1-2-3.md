# Runbook – combined staging release P0-1 / P0-2 / P0-3

Target **turvio-staging** only (Supabase `xwryomkbrkwjytwofgcu`, Hetzner Docker host). **Not approved –
nothing here may run before the owner's explicit staging approval.** Running release: `59666cf`
(Phase B). Release candidate: the commit named in the GO/NO-GO report (contains this file).

| Part | What changes | Database |
|---|---|---|
| P0-1 | Optimizer time budget: VROOM warm start in a worker process killed at its deadline, matrix fetch bounded by the budget (#16), spare-worker pool fixed (#17) | – |
| P0-2 | Road-based ETA projection (shared/API/Dispatch) | – |
| P0-3 | Stop location checks, history, confirmations, approach points (API, Dispatch, Driver) | `20261118000100_stop_location_history` |

Detailed database steps and checks: `p0-3-stop-location-history.md`. Rehearsed locally:
`deploy/staging/test/release-rehearsal.sh` (PostgreSQL 17), `deploy/docker/test/optimizer-hardened-check.sh`.

## Settings (`/opt/turvio/.env`, mode 600 – values never in Git or logs)

| Variable | Value for this release | Note |
|---|---|---|
| `ROUTING_DATA_VERSION` | name of the active OSRM build, e.g. `build-20261106T120000Z` | **new**; read it in step A3. Change it whenever a new graph is switched in. Empty = check results valid 24 h only |
| `ADDRESS_DATA_VERSION` | empty | **new**; only with `GEOCODER=postgres` |
| `GEOCODER` | unchanged (`none`) | address cross-checks show "partly checked" |
| `OSRM_MAX_SNAP_METERS` | unchanged (default 1000) | |
| Optimizer (compose, fixed) | `ROUTING_REQUIRED=true`, `OSRM_TIMEOUT_SECONDS=8`, `OSRM_TABLE_CHUNK=100` | unchanged |
| Retention (database) | 400 days history / 30 days checks | migration defaults; **provisional – privacy review before commercial use** |

No other variable is added or required.

## A. Before the window (no effect on users)

1. `deploy.sh --status` → current = `59666cf`, all containers healthy.
2. `deploy.sh --server-check` → free RAM/disk; note the routing-graph block.
3. Active OSRM data: in the `--server-check` output, `readlink /data/current` names the build
   directory (`build-YYYYMMDDTHHMMSSZ`) and `META` shows `BUILT_AT`/`OSRM_VERSION` (and the region).
   Put the directory name into `ROUTING_DATA_VERSION` in `.env`. `deploy.sh --osrm-check` → note which
   pilot cities are covered (Suhl, Hannover, Kassel, Bremen, Cologne); cities outside the graph
   fail with `routing_out_of_coverage` – by design, not a release defect.
4. `deploy.sh --build <RC-SHA>` → images built and tagged; **nothing started** (running release unaffected).
5. Backup on the operator Mac: `bash deploy/staging/backup/turvio-staging-backup.sh` (expects
   `20261117000100`), then `…-verify.sh <file>` → must end with `VERIFIED`; keep the `[5]` block.

## B. Window (keep short – a few minutes; no dispatcher editing published tours)

1. Runbook P0-3 §0 pre-checks + fingerprint.
2. P0-3 §2: apply the migration in one transaction; **re-run `supabase/hosted/10_turvio_service.sql`**.
3. P0-3 §3 checks (baseline records = stop count, fingerprint identical, RLS, grants, search_path, 400/30).
4. Immediately: `deploy.sh <RC-SHA>` → reuses the images, starts, health + TLS smoke; automatic
   rollback to `59666cf` if unhealthy (that release works on the migrated database).

Between B2 and B4 the old Dispatch gets 422 "a reason is required" when changing the address or pin
of a stop on a published tour (verified with the old release); everything else keeps working.

## C. After the deploy (synthetic data only)

1. `deploy.sh --status`; `deploy.sh --osrm-check`.
2. Smoke as in P0-3 §4.3 (swapped coordinates → "Location error", optimize excludes it, history with
   role, motorway warning + approach suggestion, acceptance audited) and one optimization per tier
   (≤60 / ≤150 / >150 stops) within 5 / 10 / 15 s plus a few seconds.
3. Watch the optimizer container for 24 h: `docker stats` (≤ 768 MB), restarts 0.

## Rollback

| Situation | Action | Data |
|---|---|---|
| New release unhealthy at B4 | automatic (deploy.sh) → `59666cf` | none lost; migration stays (compatible) |
| Problem found later in the app | `deploy.sh --rollback` → `59666cf`, keep the migration | none lost; old Dispatch: 422 on published-tour location edits |
| Migration itself must go | app rollback first, then P0-3 "Rollback" (encrypted dump of the four history tables, guarded down script) | location history since the migration (kept in the dump) |
| Database damaged | restore the step-A5 backup into a new project/database (verified by the verify script; rehearsed: restored data equal to the baseline), point `DATABASE_URL` there, `59666cf` | changes after the backup |

The previous release's images and directory are kept by `deploy.sh` (current + previous), so a
rollback starts in seconds without a build.

## Open issues – not part of this release

| # | Item | Effect until done |
|---|---|---|
| 20 | ETA across a DST change in overnight tours | finish times of tours spanning the switch night can be off by one hour |
| 21 | Running tours carried over from a previous date | such tours are projected like today's tours |
| 22 | Day indicator for finish times after midnight | "01:10" without "+1 day" in Dispatch |
| – | Arabic right-to-left layout | texts translated; RTL layout only verified on a device after the restart prompt |
| – | Expressway/motorway detection from road data (P0-3.7) | motorway warning uses the snap road name/class only |
| – | Physical-device tests (iOS + Android) | `docs/MOBILE_RELEASE_READINESS.md` §5; first iOS compile still open |
| – | Privacy review of retention 400 / 30 days | provisional values; required before commercial use |
