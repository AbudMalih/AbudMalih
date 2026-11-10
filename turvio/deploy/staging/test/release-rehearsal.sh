#!/usr/bin/env bash
# TURVIO – local rehearsal of the P0-3 staging release (migration 20261118000100) on PostgreSQL 17.
# Touches no shared database: everything happens in a throwaway postgres:17 container (tmpfs, port
# bound to 127.0.0.1 only) that is removed at the end. Synthetic data only.
#
# Follows deploy/staging/runbooks/p0-3-stop-location-history.md step by step:
#   stand-in  = database written by the PREVIOUS release (its own harness + seed, migrations < new)
#   §0 pre-checks · §1 encrypted backup + the real verify script · §2 apply in one transaction
#   + hosted grants re-run · §3 verify (history baseline, fingerprint, RLS, grants, search_path,
#   retention 400/30) · post-migration backup + verify · history written after the migration
#   · rollback (history dump, guarded down script) · fingerprint equal · disaster recovery:
#   pre-migration backup restored into a fresh database → fingerprint equal to the baseline.
#
# Usage: deploy/staging/test/release-rehearsal.sh [previous-release-commit]   (default 59666cf)
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PREV="${1:-59666cf}"
NEW="20261118000100"
MIG="$ROOT/supabase/migrations/${NEW}_stop_location_history.sql"
DOWN="$ROOT/supabase/rollback/${NEW}_stop_location_history.down.sql"
FP="$ROOT/supabase/rollback/fingerprint.sql"
HOSTED="$ROOT/supabase/hosted/10_turvio_service.sql"
PORT="${REHEARSAL_PORT:-55417}"
WORK="$(mktemp -d)"
BOX="turvio-rehearsal-$$"
PASS="rehearsal-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"   # throwaway backup passphrase

say() { printf '%s\n' "$*"; }
ok() { say "  PASS $*"; }
die() { say "FAILED: $*" >&2; exit 1; }
want() { [ "$2" = "$3" ] || die "$1: expected '$3', got '$2'"; ok "$1"; }   # want <check> <actual> <expected>
cleanup() {
  docker rm -f "$BOX" >/dev/null 2>&1 || true
  [ -d "$WORK/prev" ] && git -C "$ROOT" worktree remove --force "$WORK/prev" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

docker run -d --name "$BOX" -p "127.0.0.1:$PORT:5432" --tmpfs /var/lib/postgresql/data:rw,size=1g \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e PGTZ=UTC postgres:17 >/dev/null
for _ in $(seq 1 60); do docker exec "$BOX" pg_isready -h 127.0.0.1 -U postgres -q 2>/dev/null && break; sleep 1; done
docker exec "$BOX" pg_isready -h 127.0.0.1 -U postgres -q || die "postgres:17 did not start"
say "PostgreSQL $(docker exec "$BOX" psql -U postgres -XAtc 'show server_version')"

# ------------------------------------------------------------- stand-in written by the previous release
git -C "$ROOT" worktree add -q --detach "$WORK/prev" "$PREV"
P="$WORK/prev/turvio"; [ -d "$P" ] || P="$WORK/prev"
ln -s "$ROOT/node_modules" "$P/node_modules"
for d in apps/api packages/shared packages/db; do [ -d "$ROOT/$d/node_modules" ] && cp -a "$ROOT/$d/node_modules" "$P/$d/"; done
[ ! -e "$P/supabase/migrations/${NEW}_stop_location_history.sql" ] || die "previous release already contains $NEW"
cp "$ROOT/deploy/staging/test/standin-seed.test.ts" "$P/apps/api/test/integration/zz-standin-seed.test.ts"
(cd "$P/apps/api" && TEST_PG_HOST=127.0.0.1 TEST_PG_PORT="$PORT" STANDIN_OUT="$WORK/db" \
  npx vitest run test/integration/zz-standin-seed.test.ts >"$WORK/seed.log" 2>&1) || { tail -30 "$WORK/seed.log"; die "seeding with $PREV failed"; }
DB="$(cat "$WORK/db")"
sql() { docker exec -i "$BOX" psql -U postgres -d "${SQLDB:-$DB}" -X -q -A -t -v ON_ERROR_STOP=1 "$@"; }
# What staging has and the local harness does not: the migration ledger, the hosted service role.
{ say "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  for f in $(cd "$P/supabase/migrations" && ls *.sql | sort); do v="${f%%_*}"; n="${f#*_}"; say "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '${n%.sql}');"; done
} | sql
sql <"$HOSTED"
say "stand-in: database written by $PREV – $(sql -c "select count(*) from public.tours") tours, $(sql -c "select count(*) from public.stops") stops, $(sql -c "select count(*) from public.stop_events") stop events"

# ------------------------------------------------------------- §0 pre-checks
say "§0 pre-checks"
want "latest migration 20261117000100" "$(sql -c "select max(version) from supabase_migrations.schema_migrations")" "20261117000100"
want "no stop_location_* tables" "$(sql -c "select count(*) from pg_class where relname like 'stop_location_%' and relkind = 'r'")" 0
want "no new stop columns" "$(sql -c "select count(*) from information_schema.columns where table_name = 'stops' and column_name in ('address_version','location_version','location_precision')")" 0
STOPS="$(sql -c "select count(*) from public.stops")"
sql <"$FP" >"$WORK/fp.baseline"
ok "baseline fingerprint ($(wc -l <"$WORK/fp.baseline") rows), $STOPS stops"

# ------------------------------------------------------------- §1 backup (same pg_dump flags and encryption as the backup script)
backup() { # backup <name>: encrypted custom-format dump of the four schemas + checksum
  docker exec "$BOX" pg_dump -U postgres -d "$DB" --format=custom --compress=6 --no-owner --no-privileges \
      --schema=public --schema=app --schema=geo --schema=supabase_migrations \
    | gpg --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
          --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-count 65011712 \
          --output "$WORK/$1.dump.gpg" 3< <(printf '%s' "$PASS")
  (cd "$WORK" && shasum -a 256 "$1.dump.gpg" >"$1.dump.gpg.sha256")
}
verify() { # the real verify script; passphrase on stdin
  printf '%s\n' "$PASS" | bash "$ROOT/deploy/staging/backup/turvio-staging-backup-verify.sh" "$WORK/$1.dump.gpg" >"$WORK/$1.verify" 2>&1 \
    || { cat "$WORK/$1.verify"; die "verify of $1 failed"; }
  grep -q '^VERIFIED' "$WORK/$1.verify" || die "verify of $1 did not print VERIFIED"
}
say "§1 backup"
backup pre; verify pre
ok "pre-migration backup: $(grep -E '^\[4\]' "$WORK/pre.verify" | cut -c1-160)"

# ------------------------------------------------------------- §2 apply (one transaction) + grants
say "§2 apply"
{ say "begin;"; say "set local lock_timeout = '5s';"; cat "$MIG"; say "insert into supabase_migrations.schema_migrations (version, name) values ('$NEW', 'stop_location_history');"; say "commit;"; } | sql
ok "migration applied in one transaction"
[ "$(sql -c "select has_function_privilege('turvio_service', 'app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)', 'EXECUTE')")" = f ] \
  && ok "before the hosted re-run the API role cannot store checks (as documented)"
sql <"$HOSTED"

# ------------------------------------------------------------- §3 verify
say "§3 verify"
want "one baseline record per stop ($STOPS)" "$(sql -c "select kind || '|' || provenance || '|' || count(*) from stop_location_origins group by kind, provenance")" "baseline_at_migration|unknown|$STOPS"
want "no history events invented" "$(sql -c "select count(*) from stop_location_events")" 0
sql <"$FP" >"$WORK/fp.migrated"; cmp -s "$WORK/fp.baseline" "$WORK/fp.migrated" || die "fingerprint changed by the migration"; ok "fingerprint unchanged"
want "RLS on the four tables" "$(sql -c "select count(*) from pg_class where relname in ('stop_location_origins','stop_location_events','stop_location_checks','stop_location_decisions') and relrowsecurity")" 4
want "authenticated: SELECT only" "$(sql -c "select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_name like 'stop_location_%'")" SELECT
want "turvio_service: store_location_check + purge" "$(sql -c "select has_function_privilege('turvio_service', 'app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)', 'EXECUTE') and has_function_privilege('turvio_service', 'app.purge_expired_data()', 'EXECUTE')")" t
x="$(sql -c "select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app','public') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=\"\"']")"; want "every SECURITY DEFINER function pins search_path" "$x" ""
want "retention 400 / 30 days" "$(sql -c "select string_agg(distinct location_audit_retention_days || '/' || location_check_retention_days, ',') from organizations")" "400/30"

say "post-migration backup"
backup post; verify post
ok "post-migration backup restores completely: $(grep -E '^\[4\]' "$WORK/post.verify" | cut -c1-160)"

# History written after the migration (a staff correction with a reason, as the new API does).
SID="$(sql -c "select s.id from stops s join tours t on t.id = s.tour_id where t.published_at is not null and s.status = 'pending' order by s.id limit 1")"
printf '%s\n' "begin;" "set local turvio.change_reason = 'rehearsal: corrected pin';" "update stops set lat = lat + 0.0001 where id = '$SID';" "commit;" | sql >/dev/null
[ "$(sql -c "select count(*) from stop_location_events")" -ge 1 ] || die "no history after the edit"; ok "history recorded after the migration ($(sql -c "select count(*) from stop_location_events") event)"
sql <"$FP" >"$WORK/fp.before-rollback"

# ------------------------------------------------------------- rollback
say "rollback"
docker exec "$BOX" pg_dump -U postgres -d "$DB" --format=custom --data-only -t public.stop_location_origins -t public.stop_location_events -t public.stop_location_checks -t public.stop_location_decisions \
  | gpg --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 --output "$WORK/history.dump.gpg" 3< <(printf '%s' "$PASS")
[ -s "$WORK/history.dump.gpg" ] || die "no history dump"; ok "history tables dumped (encrypted) before the rollback"
if { say "begin;"; cat "$DOWN"; say "commit;"; } | sql >/dev/null 2>&1; then die "down script ran without the confirmation"; fi
ok "down script refuses without turvio.confirm_drop_location_history"
{ say "begin;"; say "set local lock_timeout = '5s';"; say "set local turvio.confirm_drop_location_history = 'yes';"; cat "$DOWN"; say "delete from supabase_migrations.schema_migrations where version = '$NEW';"; say "commit;"; } | sql
sql <"$FP" >"$WORK/fp.rolled-back"
cmp -s "$WORK/fp.before-rollback" "$WORK/fp.rolled-back" || die "rollback changed data"; ok "rollback keeps every row (fingerprint equal)"
want "schema back at 20261117000100" "$(sql -c "select count(*) from pg_class where relname like 'stop_location_%' and relkind = 'r'") $(sql -c "select max(version) from supabase_migrations.schema_migrations")" "0 20261117000100"

# ------------------------------------------------------------- disaster recovery: restore the pre-migration backup
say "restore pre-migration backup into a fresh database"
SQLDB=postgres sql -c "create database restored" >/dev/null
SQLDB=restored sql -c "create schema if not exists auth; create table if not exists auth.users (id uuid primary key, email varchar(255)); create or replace function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$; drop schema public cascade;" >/dev/null
gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --decrypt "$WORK/pre.dump.gpg" 3< <(printf '%s' "$PASS") \
  | docker exec -i "$BOX" pg_restore -U postgres -d restored --no-owner --no-privileges --section=pre-data --section=data --exit-on-error --single-transaction
# auth.users is Supabase's (not in the backup): only the referenced ids, as the verify script does.
docker exec "$BOX" sh -c "psql -U postgres -d '$DB' -XAtc 'copy (select id from auth.users) to stdout' | psql -U postgres -d restored -Xqc 'copy auth.users (id) from stdin'"
gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --decrypt "$WORK/pre.dump.gpg" 3< <(printf '%s' "$PASS") \
  | docker exec -i "$BOX" pg_restore -U postgres -d restored --no-owner --no-privileges --section=post-data --exit-on-error --single-transaction
SQLDB=restored sql <"$FP" >"$WORK/fp.restored"
# auth.users belongs to Supabase and is not in this backup (only the referenced ids were added): compare
# its row count; every TURVIO table must be identical.
want "restored auth.users ids" "$(grep '^auth.users|' "$WORK/fp.restored" | cut -d'|' -f2)" "$(grep '^auth.users|' "$WORK/fp.baseline" | cut -d'|' -f2)"
cmp -s <(grep -v '^auth.users|' "$WORK/fp.baseline") <(grep -v '^auth.users|' "$WORK/fp.restored") || { diff "$WORK/fp.baseline" "$WORK/fp.restored" | head; die "restored database differs from the baseline"; }
ok "restored pre-migration backup equals the baseline fingerprint ($(grep -vc '^auth.users|' "$WORK/fp.restored") tables/rows)"
want "restored database is at 20261117000100 (previous release compatible)" "$(SQLDB=restored sql -c "select max(version) from supabase_migrations.schema_migrations")" 20261117000100

say "release rehearsal: PASSED"
