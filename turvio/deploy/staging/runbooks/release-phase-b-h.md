# Runbook – staging release of Phases B–H (tour lifecycle, Dispatch/Admin redesign, security upgrade)

Target: **turvio-staging** (Supabase `xwryomkbrkwjytwofgcu`, PostgreSQL 17; VPS `turviodeploy`).
Never production. **Not approved yet – every step needs the owner's explicit go-ahead.**
Migration-first, as in previous releases: the database change goes live before the application that
uses it; the release currently running keeps working on the migrated database (verified, see
"Compatibility").

| Item | Value |
|---|---|
| Release commit | the approved commit on `claude/tender-lovelace-4odw0l` (40-character SHA) |
| Migrations (in order) | `20261119000100_tour_lifecycle_enums.sql` · `20261119000200_tour_lifecycle.sql` · `20261119000300_settings_preferences.sql` |
| DB rollback (reverse order) | `supabase/rollback/20261119000300_settings_preferences.down.sql` (needs `turvio.confirm_drop_settings = 'yes'`) · `20261119000200_tour_lifecycle.down.sql` (needs `turvio.confirm_drop_tour_lifecycle = 'yes'`; refuses while a tour or stop is `cancelled`). 20261119000100 has no down script (enum values cannot be dropped; unused they are harmless). |
| Fingerprint (read-only) | `supabase/rollback/fingerprint.sql` – the new columns are excluded, so before/after compare |
| Service-role grants | `supabase/hosted/10_turvio_service.sql` – **re-run after the migrations** |
| Rehearsal | `deploy/staging/test/release-rehearsal-lifecycle.sh` – PASSED (stand-in written by the deployed release, backup, apply, verify, guarded rollback, restore = baseline) |
| New API / web settings | none (no new environment variables) |
| Dependency changes | Next.js 16.4.3 → 16.4.6, nodemailer 9.1.1 → 10.6.0 (security) |

## 0. Pre-checks (read-only)

1. Supabase project `turvio-staging` is `ACTIVE_HEALTHY`, server version 17.
2. `select max(version) from supabase_migrations.schema_migrations` → **`20261118000100`**;
   none of the three new versions present. (If it is anything else: stop – the plan assumed P0-3 is live.)
3. Absent: columns `tours.archived_at`, `tours.closed_at`; table `public.user_preferences`;
   enum label `cancelled` in `public.tour_status` / `public.stop_status`.
4. Driver/vehicle double bookings that the new unique index would reject → none (the new rule is
   looser than the old one, so this is a formality):
   `select organization_id, driver_id, tour_date, count(*) from tours where driver_id is not null and status <> 'completed' and origin = 'dispatch' group by 1,2,3 having count(*) > 1;` → 0 rows.
5. No long-running transactions on `tours`/`stops` (`pg_stat_activity`): the migrations take brief
   locks to add nullable columns (metadata only) and to recreate two partial indexes.
6. `ssh turviodeploy@<vps> /opt/turvio/bin/deploy --status` – note the **current** release SHA
   (rollback target) and that all containers are healthy.
7. Run `fingerprint.sql`, keep the output (baseline).

## 1. Backup (owner's machine – Docker Desktop + GnuPG, as before)

```
EXPECT_MIGRATION=20261118000100 bash turvio/deploy/staging/backup/turvio-staging-backup.sh
bash turvio/deploy/staging/backup/turvio-staging-backup-verify.sh <dump>.gpg      # must print VERIFIED
```
Keep the `[5]` fingerprint block. Staging has no Supabase-managed backup or PITR – this dump is the
disaster-recovery path.

## 2. Apply (three transactions – an enum value cannot be used in the transaction that adds it)

```sql
begin; set local lock_timeout = '5s';
\i supabase/migrations/20261119000100_tour_lifecycle_enums.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000100', 'tour_lifecycle_enums');
commit;

begin; set local lock_timeout = '5s';
\i supabase/migrations/20261119000200_tour_lifecycle.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000200', 'tour_lifecycle');
commit;

begin; set local lock_timeout = '5s';
\i supabase/migrations/20261119000300_settings_preferences.sql
insert into supabase_migrations.schema_migrations (version, name) values ('20261119000300', 'settings_preferences');
commit;
```
A lock timeout changes nothing – retry when idle. Then, as project owner, **re-run
`supabase/hosted/10_turvio_service.sql`** (idempotent).

## 3. Verify the database (read-only)

1. `fingerprint.sql` → identical to 0.7 (every existing row unchanged).
2. New columns empty: `select count(*) from tours where closed_at is not null or archived_at is not null or closed_remotely` → 0;
   `select count(*) from stops where cancelled_at is not null or returned_from_tour_id is not null` → 0.
3. RLS on: `select relname, relrowsecurity from pg_class where relname in ('tour_deletions','user_preferences')` → both true.
4. Every SECURITY DEFINER function pins `search_path` (query in the P0-3 runbook §3.4) → no rows.
5. `anon` has no privileges on `tour_deletions` / `user_preferences` (`information_schema.role_table_grants`) → 0 rows.
6. Lifecycle functions present: `close_tour`, `cancel_stop`, `delete_tour`, `tour_delete_eligibility`,
   `delete_draft_stop`; trigger `tours_lifecycle_guard` on `public.tours`.

## 4. Application release

1. `ssh turviodeploy@<vps> '/opt/turvio/bin/deploy --build <SHA>'` (images only; nothing restarts).
2. `ssh turviodeploy@<vps> '/opt/turvio/bin/deploy <SHA>'` – starts API, Dispatch, Admin, optimizer;
   deploy.sh waits for health checks and **rolls back automatically** if any service is unhealthy.
3. Health: `curl https://api.staging.turvio.online/health` → `ok`; Dispatch and Admin `/login` → 200.

## 5. Smoke tests (synthetic QA accounts only)

1. `QA_DISPATCH_EMAIL=… QA_DISPATCH_PASSWORD=… QA_DRIVER_EMAIL=… QA_DRIVER_PASSWORD=… node turvio/e2e/staging-smoke.mjs` → all steps pass.
2. Dispatch (QA dispatcher): sign-in page is charcoal; Overview, Planning, Tours, Archive, Pickups,
   Analytics, Settings, Fleet load; language switch EN → DE → AR (right-to-left) and back; Settings →
   "My preferences" saves (PUT returns 200); `?ui=classic` shows the previous design, `?ui=g` returns.
3. Lifecycle on a QA test tour: finish a running tour from Dispatch (open stops go back to the pool),
   archive it, restore it; delete an empty draft. Exports (CSV/Excel) download with translated headings.
4. Admin (platform admin with two-step verification): Overview, Organizations, Plans, System status,
   Audit log load; Appearance menu switches Light / Dark / Follow system.
5. **Installed Driver APK 0.2.0** (unchanged): sign in, today's tours load, start a QA tour, scan,
   deliver with photo proof, complete. A tour cancelled or finished from Dispatch disappears from the
   app at the next sync; nothing else changes for the driver.
6. Live tracking: with the company in pilot mode for the QA driver only, positions arrive after the
   notice is acknowledged; mode "off" records nothing.

## Compatibility (tested)

- **Running release on the migrated database:** its full API test suite passes against the new schema
  (250 of 250 tests that run without a road-routing server). No visible change until the new release is
  deployed; deploy promptly after §3 anyway.
- **New release on the old database:** would fail on the new columns – never deploy it before §2.
- **Installed Driver APK 0.2.0 (commit 86b06e9):** all 20 endpoints it calls still exist with the same
  method and path; the feed never carries the new `cancelled` status (contract tests); offline replays
  stay idempotent; deliveries recorded before a tour was closed from Dispatch are still accepted.

## Rollback

1. **Application:** `ssh turviodeploy@<vps> /opt/turvio/bin/deploy --rollback` (previous SHA from 0.6).
   The previous release runs on the migrated database (see Compatibility) – usually this is enough.
2. **Database (only if really needed – drops the lifecycle records and preferences recorded since §2):**
   a. Dump `tours`, `stops`, `tour_deletions`, `user_preferences`, `organizations` (encrypted) first.
   b. Cancelled tours/stops block the lifecycle rollback. Decide per row with the operator (e.g. back to
      a planned draft); the lifecycle guard blocks reopening closed or archived tours, so this step runs
      with triggers bypassed in its own transaction:
      ```sql
      begin; set local session_replication_role = replica;
      update tours set status = 'planned', closed_at = null, close_reason = null, archived_at = null, archived_by = null where status = 'cancelled';
      update stops set status = 'pending', cancel_reason = null, cancelled_at = null, cancelled_by = null where status = 'cancelled';
      commit;
      ```
   c. Down scripts in reverse order:
      ```sql
      begin; set local lock_timeout = '5s'; set local turvio.confirm_drop_settings = 'yes';
      \i supabase/rollback/20261119000300_settings_preferences.down.sql
      delete from supabase_migrations.schema_migrations where version = '20261119000300';
      commit;
      begin; set local lock_timeout = '5s'; set local turvio.confirm_drop_tour_lifecycle = 'yes';
      \i supabase/rollback/20261119000200_tour_lifecycle.down.sql
      delete from supabase_migrations.schema_migrations where version in ('20261119000200', '20261119000100');
      commit;
      ```
   d. Re-run `supabase/hosted/10_turvio_service.sql`; `fingerprint.sql` must equal the value just before c.
3. **Disaster recovery:** restore the §1 backup into a fresh database/project (verify script procedure),
   then deploy the previous release SHA. Rehearsed: the restored database equals the baseline fingerprint.
