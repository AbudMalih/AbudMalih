# Runbook – P0-3: stop location checks and history (migration 20261118000100)

Target: **turvio-staging** (`xwryomkbrkwjytwofgcu`, PostgreSQL 17). Never production. **Not yet
approved – every step below needs the owner's go-ahead.** Migration-first: the database change goes
live before the application release that uses it; the currently running release keeps working on
the migrated database (it does not use the new tables; see "Compatibility").

| Item | Value |
|---|---|
| Migration | `supabase/migrations/20261118000100_stop_location_history.sql` |
| DB rollback | `supabase/rollback/20261118000100_stop_location_history.down.sql` (refuses without `turvio.confirm_drop_location_history = 'yes'`) |
| Fingerprint (read-only) | `supabase/rollback/fingerprint.sql` – new columns excluded, so before/after compare |
| Service-role grants | `supabase/hosted/10_turvio_service.sql` – **must be re-run after the migration** |
| Design / retention | `docs/LOCATION_HISTORY.md` |
| New API settings | `ROUTING_DATA_VERSION`, `ADDRESS_DATA_VERSION` (compose passes them; empty = unset) |

Tested locally: PG 17 apply → data/catalog/fingerprint unchanged, existing stops get a labelled
`baseline_at_migration` record and no history; rollback restores the exact catalog and keeps every
pre-existing row; apply → rollback → apply → rollback; PG 18 catalog round trip; hosted order
(service role before migration) incl. the grant re-run (`apps/api/test/integration/location-rollback.test.ts`,
`hosted-grants.test.ts`, `packages/db/test/location-history.test.ts`).

## 0. Pre-checks (read-only)

1. Project `turvio-staging`, `ACTIVE_HEALTHY`; server version 17.
2. Latest `supabase_migrations.schema_migrations` version is `20261117000100`; `20261118000100` absent.
3. Absent: tables `stop_location_*`, columns `stops.address_version` / `location_version` /
   `location_precision`, `organizations.location_audit_retention_days`.
4. `select count(*) from stops` – note it (expected number of baseline records).
5. Long-running transactions on `stops` → none (`pg_stat_activity`), since the migration takes a
   brief lock to add columns (metadata only, no rewrite).
6. Run `fingerprint.sql`, keep the output.

## 1. Backup

Encrypted dump with `deploy/staging/backup/turvio-staging-backup.sh` (expects `20261117000100` by
default – no edit needed) and verification with `…-verify.sh`; it must end with `VERIFIED`. Keep the
`[5]` fingerprint block. The migration changes no existing row; the backup is insurance and the
disaster-recovery path (restore into a fresh project/database, then the previous release).

Rehearsed locally on PostgreSQL 17 with `deploy/staging/test/release-rehearsal.sh` (stand-in written
by the deployed release 59666cf; backup + the real verify script before and after the migration;
apply; §3 checks; rollback; restore of the pre-migration backup equal to the baseline fingerprint).

## 2. Apply (one transaction)

```sql
begin;
set local lock_timeout = '5s';
\i supabase/migrations/20261118000100_stop_location_history.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261118000100', 'stop_location_history');
commit;
```
If the lock times out: nothing changed – retry when idle.

Then, as project owner: **re-run `supabase/hosted/10_turvio_service.sql`** (idempotent). Without it the
API cannot store check results (it keeps working, but recomputes every time).

## 3. Verify (read-only)

1. `select kind, provenance, count(*) from stop_location_origins group by 1, 2` →
   one row `baseline_at_migration | unknown | <count from 0.4>`; `select count(*) from stop_location_events` → 0.
2. `fingerprint.sql` → identical to 0.6.
3. RLS enabled on the four tables; `authenticated` has SELECT only; `turvio_service` has EXECUTE on
   `app.store_location_check(...)` and `app.purge_expired_data()`:
   `select has_function_privilege('turvio_service', 'app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)', 'EXECUTE')` → true.
4. Every SECURITY DEFINER function in `app`/`public` has `search_path=""`:
   `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app','public') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=""']` → no rows.
5. Retention defaults: `select location_audit_retention_days, location_check_retention_days from organizations` → 400 / 30
   (a product default, not a legal requirement – the company may change it).

## 4. Application release

1. Set in the API environment (Hetzner secret/env file):
   - `ROUTING_DATA_VERSION` = name of the active OSRM build (directory `build-YYYYMMDDTHHMMSSZ`, see
     `META` / `BUILT_AT`). **Change it whenever a new graph is switched in** – stored results of the
     old graph then count as stale and are recomputed.
   - `ADDRESS_DATA_VERSION` only if `GEOCODER=postgres` with local address data; otherwise leave empty
     (address cross-checks are then "partly checked", shown as such).
2. Deploy the approved commit with `deploy.sh` (API, Dispatch). Health checks as for Phase B.
3. Smoke test with synthetic data: create a stop with swapped coordinates on a test tour → Dispatch
   shows "Location error" and "≥" finish; optimize excludes it; history shows "created" with the
   dispatcher's role; a motorway point gets a warning and a suggestion; accepting it is audited.
4. Driver builds that use the new endpoints only after this release (see `docs/MOBILE_RELEASE_READINESS.md`).

## Compatibility

- The running release on the migrated database: unchanged behaviour, with two intended effects of
  the triggers: staff changes of the address/coordinates of a stop on a **published** tour need a
  reason – the old Dispatch does not send one and gets "a reason is required" (422) for such edits;
  driver edits are unaffected. Deploy the new release promptly after the migration.
- The new release on the old database: fails on the new columns/endpoints – never deploy it first.

## Rollback

1. Application: redeploy the previous commit (`deploy.sh --rollback`).
2. Database (only if needed – it **drops all location history recorded since the migration**):
   take an encrypted dump of `stop_location_origins`, `stop_location_events`, `stop_location_checks`,
   `stop_location_decisions` first, then
   ```sql
   begin;
   set local lock_timeout = '5s';
   set local turvio.confirm_drop_location_history = 'yes';
   \i supabase/rollback/20261118000100_stop_location_history.down.sql
   delete from supabase_migrations.schema_migrations where version = '20261118000100';
   commit;
   ```
   Then `fingerprint.sql` must equal the baseline of 0.6 (stops added meanwhile stay).
