# Phase I, step 1 – what the owner runs on the Mac (read-only + encrypted backup)

Nothing here changes staging: the pre-checks run in a READ ONLY transaction, the backup reads a
read-only snapshot, `deploy --status` only prints. Passwords are typed at hidden prompts; never paste
them, the backup passphrase or connection strings into a chat or a report.

Needs: Docker Desktop running, GnuPG (`brew install gnupg`), the repo at commit `551cf17` or later
(`git -C turvio fetch && git -C turvio checkout claude/tender-lovelace-4odw0l && git -C turvio pull`).

## A. Pre-checks (read-only, ~1 min)

```
docker run --rm -it -v "$PWD/turvio:/turvio:ro" -w / postgres:17 \
  psql "host=aws-1-eu-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.xwryomkbrkwjytwofgcu sslmode=require" \
  -X -v ON_ERROR_STOP=1 -f /turvio/deploy/staging/runbooks/phase-i-step1-prechecks.sql | tee ~/turvio-backups/precheck-$(date -u +%Y%m%dT%H%M%SZ).txt
```
(psql asks for the staging database password.) **Stop if** section 2 does not show latest
`20261118000100`, or section 3 is not `0 | 0 | 0`, or section 4 lists a transaction older than a minute.

## B. Encrypted backup + verification

```
EXPECT_MIGRATION=20261118000100 bash turvio/deploy/staging/backup/turvio-staging-backup.sh
bash turvio/deploy/staging/backup/turvio-staging-backup-verify.sh ~/turvio-backups/<file>.dump.gpg
```
The backup refuses to run unless staging is PostgreSQL 17 at `20261118000100`. The verify script must
end with `VERIFIED`. Keep the backup passphrase in the password manager only.

## C. Deployed release SHAs (read-only)

```
ssh turviodeploy@<vps> /opt/turvio/bin/deploy --status
```

## What to send back (contains no secrets)

1. The pre-check output file from A (counts, hashes, versions only).
2. From B: the backup file name, its size, the `.sha256` line, and the verify output from `[1]` to `VERIFIED`.
3. From C: the current / previous release SHAs and container states.
