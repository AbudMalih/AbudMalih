# Phase I, step 2 – staging rollout (migrations, then application)

**Not approved yet. Run nothing here until the owner says so.** Target: turvio-staging only.
Run from the folder that contains the `turvio` checkout, on the owner's Mac (Docker Desktop, GnuPG,
SSH key `~/.ssh/turvio_claude_deploy`). Passwords are typed at the hidden prompts only.

| Item | Value |
|---|---|
| Release SHA (application, §4) | `c9de80951877d2d22ce2a7c825e126cd6bd6793a` (approved) |
| Running release (application rollback target) | `02ce796e45afe62dbb2c0aaaab3be7742944c276` |
| Database before | PostgreSQL 17, latest migration `20261118000100` |
| Database after | latest migration `20261119000500` (0100–0300 lifecycle/settings, 0400 failure-reason grant, 0500 platform-admin functions) |
| Disaster-recovery backup | the verified Phase I step 1 backup (`~/turvio-backups/*.dump.gpg`) |

Shorthands used below (type them once in the terminal):
```
PSQL='docker run --rm -it -v '"$PWD"'/turvio:/turvio:ro -w / postgres:17 psql "host=aws-1-eu-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.xwryomkbrkwjytwofgcu sslmode=require" -X -v ON_ERROR_STOP=1'
VPS='ssh -i ~/.ssh/turvio_claude_deploy turviodeploy@<vps>'
SHA=c9de80951877d2d22ce2a7c825e126cd6bd6793a
RB=/turvio/deploy/staging/runbooks
```

## 0. Ready (read-only, 2 min)
1. `git -C turvio fetch origin claude/tender-lovelace-4odw0l && git -C turvio checkout --detach origin/claude/tender-lovelace-4odw0l`
   – the database runbooks and checks come from the branch head (it contains the corrected
   SECURITY DEFINER checks); `git -C turvio merge-base --is-ancestor $SHA HEAD` must succeed. The
   application release deployed in §4 stays `$SHA`.
2. Nobody is using staging (QA paused, no driver on a tour).
3. `$VPS /opt/turvio/bin/deploy --status` → current `02ce796e…`, all containers healthy.
4. If staging was used since the step 1 backup: take a fresh backup and verify it (step 1, part B).

## 1. Baseline right before the change (read-only)
```
eval "$PSQL -f $RB/phase-i-step1-prechecks.sql" | tee ~/turvio-backups/step2-before.txt
```
**Stop if** section 2 is not latest `20261118000100`, section 3 is not `0 | 0 | 0`, or section 4 lists a
transaction older than a minute.

## 2. Apply the migrations (changes the database)
```
eval "$PSQL -f $RB/phase-i-step2-apply.sql" | tee ~/turvio-backups/step2-apply.txt
```
Three transactions (enums, lifecycle, settings), each checks the expected version first, `lock_timeout`
5 s, then the hosted service-role grants. Must end with `latest_migration 20261119000500` and
`== done`. **If it stops with an error:** nothing of the failed transaction is applied; a lock timeout →
wait a minute and run the same command again (it continues where it stopped); any other error → stop and
send the output. The running release `02ce796` keeps working on the migrated database (tested).

## 3. Verify the database (read-only)
```
eval "$PSQL -f $RB/phase-i-step2-verify.sql" | tee ~/turvio-backups/step2-after.txt
diff <(sed -n '/== 8/,$p' ~/turvio-backups/step2-before.txt | grep -E '^ [a-z._]+ +\|') \
     <(sed -n '/== V2/,/== V3/p' ~/turvio-backups/step2-after.txt | grep -E '^ [a-z._]+ +\|') && echo "FINGERPRINT UNCHANGED"
```
Expect: `FINGERPRINT UNCHANGED` (every existing row identical); V3 `0 | 0 | 0`; V4 both `t`, `0`;
V5 only `rls_auto_enable()`; V6 `5` and both triggers; V7 `0`, `0`. **Any difference → stop** (the
application has not changed yet; decide on the database rollback with the owner).

## 3b. New API setting (before the release)
`SUPPORT_EMAIL=<TURVIO support mailbox>` in `/opt/turvio/.env` on the VPS (passed to the API by
`compose.yml`) – receives account-deletion requests from the Driver app. Without it the request answers
"not available right now" (nothing else is affected).

## 4. Application release
```
$VPS "/opt/turvio/bin/deploy --build $SHA"     # builds images only; nothing restarts
$VPS "/opt/turvio/bin/deploy $SHA"             # switches; rolls back automatically if a health check fails
$VPS /opt/turvio/bin/deploy --status           # current = $SHA, previous = 02ce796e…, all healthy
curl -fsS https://api.staging.turvio.online/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://dispatch.staging.turvio.online/login   # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://admin.staging.turvio.online/login      # 200
```

## 5. Smoke tests (synthetic QA accounts only)
As `release-phase-b-h.md` §5: staging smoke script; Dispatch screens, EN/DE/AR + RTL, preferences save,
`?ui=classic`; lifecycle on a QA tour (finish, archive, restore, delete an empty draft), exports; Admin
screens and appearance; installed Driver APK 0.2.0 (sign in, start, scan, deliver with photo, complete;
a tour closed from Dispatch disappears at the next sync); tracking only after acknowledgement.

## Rollback
- **Application:** `$VPS /opt/turvio/bin/deploy --rollback` → back to `02ce796e…`, which runs on the
  migrated database. Usually sufficient.
- **Database (only if really needed):** first `supabase/rollback/20261119000500_platform_admin_management.down.sql`, then `…0400_failure_reason_private.down.sql` (each with its `delete from supabase_migrations.schema_migrations where version = …`), then `release-phase-b-h.md` → Rollback §2 (guarded down scripts in
  reverse order, fingerprint must equal `step2-before.txt`), after the application rollback.
- **Disaster recovery:** restore the step 1 backup into a fresh project (verify-script procedure), then
  deploy `02ce796e…`. Not covered by that backup: `auth` (sign-in accounts) and `storage` (proof photos) –
  migrations do not touch either.
