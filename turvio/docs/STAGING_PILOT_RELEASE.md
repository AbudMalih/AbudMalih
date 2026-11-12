# Staging release for the Jarbou pilot (prepared 2026-11-12)

Everything below runs on the staging VPS as `turviodeploy` and needs the owner's approval per step
(marked **⏸ approval**). Nothing here touches production, Supabase data or migrations: this release
has **no database migration**. `<SHA>` = the commit named in the hand-over message (40 characters).

## What this release contains

| Change | Why | Risk |
|---|---|---|
| API survives lost idle database connections | a pooler restart/failover killed the whole API process (reproduced locally) | none – logging only, regression test |
| Driver routes dated by the company's day | a personal route created near midnight / on a phone in another zone vanished and the next import went into the running tour (reproduced) | `GET /v1/me/tours` gains two fields; old apps ignore them |
| Support reference on every API error | the Team page error could not be diagnosed; Dispatch now shows `HTTP <status> · <code> · Ref <id>` | none |
| Address database `geodb` (+ `deploy.sh --geodb-refresh/--geodb-status`) | staging has no address search (`GEOCODER=none`); imports cannot place addresses | new container on the internal network; geocoding stays **off** until step 3 |

Verified locally (2026-11-12): API 248 tests, Dispatch 63, Driver 112, optimizer 451; browser workflow
19/19 (Dispatch → Driver → offline → live monitoring → isolation) and the 5-tour Hannover pilot
simulation 7/7 on the real road graph with 375/375 real public addresses geocoded at house level.

## Step 0 – preflight (read-only)

0a. **Backup first** – staging has no Supabase-managed backup (Management API: `backups: []`, PITR off).
On your Mac, with Docker Desktop and GnuPG (encrypted dump, read-only, nothing on staging changes):
```bash
EXPECT_MIGRATION=20261118000100 bash turvio/deploy/staging/backup/turvio-staging-backup.sh
```
This release does not touch the Supabase database, but the backup protects all existing staging data
(including the 666 DHL-format parcels, which nothing here reads or changes).

0b. Server resources and stack health:
```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy --server-check
```
Needed: ≥ 4 GB free disk (address data ~1.2 GB + ~3.5 GB temporary during the import), ≥ 1 GB free RAM.

0c. Evidence for the Team error (the API crash fixed in this release restarts the container):
```bash
ssh turviodeploy@<vps> 'docker inspect -f "{{.RestartCount}} restarts, started {{.State.StartedAt}}" turvio-staging-api-1; docker logs --since 72h turvio-staging-api-1 2>&1 | grep -ciE "terminating connection|connection terminated|uncaught|ECONNRESET"'
```
A restart count > 0 together with connection errors confirms the cause.

## Step 1 – deploy the code (⏸ approval B)

1. Install the new deploy script (it gained `--geodb-*` and the `geodb` / `geodb-prepare` images):
```bash
ssh turviodeploy@<vps> 'cd /opt/turvio/repo && git fetch -q origin claude/tender-lovelace-4odw0l && git show <SHA>:turvio/deploy/staging/deploy.sh > /tmp/deploy.sh && install -m 750 /tmp/deploy.sh /opt/turvio/bin/deploy && rm /tmp/deploy.sh'
```
2. Add two new secrets to `/opt/turvio/.env` (mode 600). `GEOCODER` stays `none`:
```bash
ssh turviodeploy@<vps> 'printf "GEODB_PASSWORD=%s\nGEODB_READER_PASSWORD=%s\n" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" >> /opt/turvio/.env'
```
3. Build first (nothing is stopped), then deploy:
```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy --build <SHA>
```
```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy <SHA>
```

**Verify:** the script's smoke checks pass; Dispatch login; Fleet & team → Team loads (if not, the toast
now shows `Ref req-…` – send it, then `docker logs turvio-staging-api-1 2>&1 | grep <ref>` shows the cause);
an error toast anywhere shows `HTTP … · code · Ref …`.
**Rollback:** `ssh turviodeploy@<vps> /opt/turvio/bin/deploy --rollback` (the geodb container of the new
release is removed; its empty volume stays).

## Step 2 – load the addresses (⏸ approval C: large dataset)

```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy --geodb-refresh
```

Runs the `geodb-prepare` job: downloads Niedersachsen + Bremen from Geofabrik (checksums verified),
extracts the addresses and loads them. Verified as containers with the server limits (2026-11-12): ~10 min, ~5.3 M addresses, 1.2 GB database. The node index
is a disk-backed file: the extractor's own memory peaked at 175 MB (anonymous); the other ~1.8 GB it
touches is file cache the kernel can evict under the 2 GB job limit. Ends with
`ACTIVE: osm-<date>-<id> (<rows> addresses)`; a failed or refused run changes nothing.
Hessen (Kassel/Haiger depots) can be added later with `GEODB_REGIONS="niedersachsen bremen hessen"` in `.env`.

```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy --geodb-status
```

## Step 3 – switch address search on (⏸ approval D)

Set in `/opt/turvio/.env`: `GEOCODER=postgres` and `ADDRESS_DATA_VERSION=<version printed in step 2>`, then
re-deploy the same release:
```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy <SHA>
```

**Verify (synthetic data only):** Dispatch → new stop → search `Lister Meile 4, 30161 Hannover` → house-level
result; Planning → import the sample file → stops placed on the map → optimize.
**Rollback:** `GEOCODER=none` and re-deploy; the address data stays for later.

## Step 4 – end-to-end smoke test with synthetic data

Needs a QA dispatcher and a QA driver for Hannover (invite them in Dispatch → Fleet & team; synthetic
use only). From any machine with Node 22 and the repository:
```bash
QA_DISPATCH_EMAIL=… QA_DISPATCH_PASSWORD=… QA_DRIVER_EMAIL=… QA_DRIVER_PASSWORD=… node turvio/e2e/staging-smoke.mjs
```
10 checks: address search, batch geocoding, tour, road-network optimization, publish, driver work,
dispatcher progress, completion. It creates one tour named `QA-SMOKE <time>` and changes nothing else.

## Step 5 – Android test build on phones

Build `815c945f` (commit 86b06e9, company-day fix) is finished; later preview builds increase the version
code automatically. Checklist: `docs/ANDROID_DEVICE_TEST_CHECKLIST.md`.

## Not in this release

- The approved dark visual design (functionality first, as decided 2026-11-12).
- iOS (never compiled; needs the Apple developer account).
- Production environment.
