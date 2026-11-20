# Phase I, step 3 – tracking stabilization (migration 20261120000100 + application release)

**Not approved yet. Run nothing here until the owner says so.** Target: turvio-staging only.
Rollback baseline: the running release `c9de80951877d2d22ce2a7c825e126cd6bd6793a` (validated).
The new release SHA is the approved commit on `claude/stabilization-sprint` (given in the approval).

Shorthands as in `phase-i-step2-rollout.md` (`PSQL`, `VPS`, `RB`), plus `SHA=<approved release SHA>`.

## 0. Ready (read-only)
1. `git -C turvio fetch origin claude/stabilization-sprint && git -C turvio checkout --detach $SHA`
2. Pilot paused for the duration (no driver on a tour), `$VPS /opt/turvio/bin/deploy --status` →
   current `c9de809…`, all containers healthy.
3. Encrypted backup + `VERIFIED` (step 1 part B procedure) – staging has no managed backups.
4. Fingerprint before: `eval "$PSQL -At -F '|' -f /turvio/supabase/rollback/fingerprint.sql" > ~/turvio-backups/step3-before.txt`
   (the 20261120000100 columns are excluded, so before/after compare).

## 1. Apply (changes the database)
```
eval "$PSQL -f $RB/phase-i-step3-apply.sql" | tee ~/turvio-backups/step3-apply.txt
```
Guard: refuses unless staging is at `20261119000500`. Must end with `latest_migration 20261120000100`.
The running release `c9de809` keeps working on the migrated database (additive: new columns with
NULL, new triggers/functions; the live-position trigger only ignores bad fixes).

## 2. Verify (read-only)
```
eval "$PSQL -f $RB/phase-i-step3-verify.sql" | tee ~/turvio-backups/step3-verify.txt
eval "$PSQL -At -F '|' -f /turvio/supabase/rollback/fingerprint.sql" > ~/turvio-backups/step3-after.txt
diff ~/turvio-backups/step3-before.txt ~/turvio-backups/step3-after.txt && echo FINGERPRINT UNCHANGED
```
Expect S1 `20261120000100`; S3 `t | t | t | 4`; S4 `t | f`; S5 nothing listed, `0 | 1`, `f | f`.

## 3. Application release
```
$VPS "/opt/turvio/bin/deploy --build $SHA"
$VPS "/opt/turvio/bin/deploy $SHA"
$VPS /opt/turvio/bin/deploy --status
```
Then the browser suites against staging (QA accounts) and the Driver APK built from `$SHA`
(EAS `preview`, installs over 0.3.0).

## Rollback
- **Application:** `$VPS /opt/turvio/bin/deploy --rollback` → `c9de809…` (works on the migrated database).
- **Database (only if needed):**
  ```sql
  begin; set local lock_timeout = '5s'; set local turvio.confirm_drop_tracking_notice = 'yes';
  \i supabase/rollback/20261120000100_tracking_stabilization.down.sql
  delete from supabase_migrations.schema_migrations where version = '20261120000100';
  commit;
  ```
  Then re-run `supabase/hosted/10_turvio_service.sql`; the fingerprint must equal `step3-before.txt`.
  The company notice texts are lost (export them first); audit-log rows stay.
- **Rehearsed locally** (database at 20261119000500 with data): apply, verify, fingerprint unchanged,
  re-run refused, rollback, fingerprint unchanged.
