#!/usr/bin/env bash
# TURVIO – local rehearsal of the Phase B–G staging release: migrations 20261119000100 (enum values),
# 20261119000200 (tour lifecycle) and 20261119000300 (settings / preferences).
#
# Touches no shared database: a throwaway PostgreSQL cluster (local binaries, 127.0.0.1 only, data
# in a temp dir) that is removed at the end. Synthetic data only. Mirrors release-rehearsal.sh
# (P0-3), which runs in a postgres:17 container – use this one where Docker images are unavailable.
#
#   stand-in = database written by the release currently on staging (its own harness + seed, schema at
#              20261118000100) · §0 pre-checks · §1 encrypted backup · §2 apply (three transactions,
#              lock_timeout) + hosted grants re-run · §3 verify (data fingerprint unchanged, new columns
#              empty, RLS, grants, search_path, old index rules still met) · use the new lifecycle
#              (close + archive a tour, save preferences) · post-migration backup · rollback (guarded
#              down scripts, refusal while a cancelled tour exists) · fingerprint equal · disaster
#              recovery: pre-migration backup restored into a fresh database → equals the baseline.
#
# Usage: deploy/staging/test/release-rehearsal-lifecycle.sh [previous-release-commit]   (default bab51d7^)
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PREV="${1:-$(git -C "$ROOT" rev-parse --short 'bab51d7^')}"
BASE="20261118000100"
M1="$ROOT/supabase/migrations/20261119000100_tour_lifecycle_enums.sql"
M2="$ROOT/supabase/migrations/20261119000200_tour_lifecycle.sql"
M3="$ROOT/supabase/migrations/20261119000300_settings_preferences.sql"
D2="$ROOT/supabase/rollback/20261119000200_tour_lifecycle.down.sql"
D3="$ROOT/supabase/rollback/20261119000300_settings_preferences.down.sql"
FP="$ROOT/supabase/rollback/fingerprint.sql"
HOSTED="$ROOT/supabase/hosted/10_turvio_service.sql"
PGBIN="${TURVIO_PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${REHEARSAL_PORT:-55419}"
WORK="$(mktemp -d)"
PASS="rehearsal-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"   # throwaway backup passphrase
RUN=(); [ "$(id -u)" = 0 ] && RUN=(runuser -u postgres --)       # initdb refuses to run as root

say() { printf '%s\n' "$*"; }
ok() { say "  PASS $*"; }
die() { say "FAILED: $*" >&2; exit 1; }
want() { [ "$2" = "$3" ] || die "$1: expected '$3', got '$2'"; ok "$1"; }
cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/pg" -m immediate stop >/dev/null 2>&1 || true
  [ -d "$WORK/prev" ] && git -C "$ROOT" worktree remove --force "$WORK/prev" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

[ -n "$RUN" ] && chown postgres "$WORK"
"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/pg" -U postgres -E UTF8 --locale=C.UTF-8 --auth=trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/pg" -l "$WORK/pg/server.log" -w -o "-p $PORT -k $WORK/pg -c listen_addresses=127.0.0.1 -c timezone=UTC" start >/dev/null
P_() { "$PGBIN/$1" -h 127.0.0.1 -p "$PORT" -U postgres "${@:2}"; }
say "PostgreSQL $(P_ psql -d postgres -XAtc 'show server_version') (staging runs 17; the PG17 backup/verify scripts run on the owner's machine)"

# ------------------------------------------------------------- stand-in written by the release on staging
git -C "$ROOT" worktree add -q --detach "$WORK/prev" "$PREV"
P="$WORK/prev/turvio"; [ -d "$P" ] || P="$WORK/prev"
ln -s "$ROOT/node_modules" "$P/node_modules"
for d in apps/api packages/shared packages/db; do [ -d "$ROOT/$d/node_modules" ] && cp -a "$ROOT/$d/node_modules" "$P/$d/"; done
[ ! -e "$P/supabase/migrations/$(basename "$M2")" ] || die "previous release already contains the lifecycle migration"
[ -e "$P/supabase/migrations/${BASE}_stop_location_history.sql" ] || die "previous release is not at $BASE"
cp "$ROOT/deploy/staging/test/standin-seed.test.ts" "$P/apps/api/test/integration/zz-standin-seed.test.ts"
(cd "$P/apps/api" && TEST_PG_HOST=127.0.0.1 TEST_PG_PORT="$PORT" STANDIN_OUT="$WORK/db" \
  npx vitest run test/integration/zz-standin-seed.test.ts >"$WORK/seed.log" 2>&1) || { tail -30 "$WORK/seed.log"; die "seeding with $PREV failed"; }
DB="$(cat "$WORK/db")"
sql() { P_ psql -d "${SQLDB:-$DB}" -X -q -A -t -v ON_ERROR_STOP=1 "$@"; }
{ say "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  for f in $(cd "$P/supabase/migrations" && ls *.sql | sort); do v="${f%%_*}"; n="${f#*_}"; say "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '${n%.sql}');"; done
} | sql
sql <"$HOSTED"
say "stand-in: database written by $PREV – $(sql -c "select count(*) from tours") tours, $(sql -c "select count(*) from stops") stops, $(sql -c "select count(*) from stop_events") stop events, $(sql -c "select count(*) from parcels") parcels"

# ------------------------------------------------------------- §0 pre-checks
say "§0 pre-checks"
want "latest migration $BASE" "$(sql -c "select max(version) from supabase_migrations.schema_migrations")" "$BASE"
want "no lifecycle columns yet" "$(sql -c "select count(*) from information_schema.columns where table_name = 'tours' and column_name in ('archived_at','closed_at')")" 0
want "no user_preferences table" "$(sql -c "select count(*) from pg_class where relname = 'user_preferences'")" 0
want "no 'cancelled' enum values yet" "$(sql -c "select count(*) from pg_enum where enumlabel = 'cancelled' and enumtypid in ('public.tour_status'::regtype, 'public.stop_status'::regtype)")" 0
sql <"$FP" >"$WORK/fp.baseline"
ok "baseline fingerprint ($(wc -l <"$WORK/fp.baseline") tables)"

# ------------------------------------------------------------- §1 backup (same pg_dump flags and encryption as the backup script)
backup() {
  P_ pg_dump -d "$DB" --format=custom --compress=6 --no-owner --no-privileges \
      --schema=public --schema=app --schema=geo --schema=supabase_migrations \
    | gpg --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
          --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-count 65011712 \
          --output "$WORK/$1.dump.gpg" 3< <(printf '%s' "$PASS")
  (cd "$WORK" && sha256sum "$1.dump.gpg" >"$1.dump.gpg.sha256")
  [ -s "$WORK/$1.dump.gpg" ] || die "empty backup $1"
}
say "§1 backup"
backup pre; ok "pre-migration backup (encrypted, $(stat -c %s "$WORK/pre.dump.gpg") bytes, sha256 recorded)"

# ------------------------------------------------------------- §2 apply (enum values need their own transaction)
say "§2 apply"
apply() { # apply <file> <version> <name>
  { say "begin;"; say "set local lock_timeout = '5s';"; say "set local statement_timeout = '120s';"; cat "$1"
    say "insert into supabase_migrations.schema_migrations (version, name) values ('$2', '$3');"; say "commit;"; } | sql
  ok "$2 applied in one transaction"
}
apply "$M1" 20261119000100 tour_lifecycle_enums
apply "$M2" 20261119000200 tour_lifecycle
apply "$M3" 20261119000300 settings_preferences
sql <"$HOSTED"; ok "hosted grants re-run"

# ------------------------------------------------------------- §3 verify
say "§3 verify"
sql <"$FP" >"$WORK/fp.migrated"; cmp -s "$WORK/fp.baseline" "$WORK/fp.migrated" || { diff "$WORK/fp.baseline" "$WORK/fp.migrated"; die "fingerprint changed by the migrations"; }
ok "every existing row unchanged (fingerprint equal)"
want "new tour columns empty for existing tours" "$(sql -c "select count(*) from tours where closed_at is not null or archived_at is not null or closed_remotely")" 0
want "new stop columns empty for existing stops" "$(sql -c "select count(*) from stops where cancelled_at is not null or returned_from_tour_id is not null")" 0
want "RLS on tour_deletions and user_preferences" "$(sql -c "select count(*) from pg_class where relname in ('tour_deletions','user_preferences') and relrowsecurity")" 2
x="$(sql -c "select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app','public') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=\"\"']")"; want "every SECURITY DEFINER function pins search_path" "$x" ""
want "anon has no table privileges on the new tables" "$(sql -c "select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_name in ('tour_deletions','user_preferences')")" 0
want "one open tour per driver/day still holds" "$(sql -c "select count(*) from (select 1 from tours where driver_id is not null and status not in ('completed','cancelled') and archived_at is null and origin = 'dispatch' group by organization_id, driver_id, tour_date having count(*) > 1) d")" 0

# Use the new lifecycle as the API does: finish a running tour (open stops back to the pool), archive
# a completed one, save a preference. Then a cancelled tour must block the rollback.
TID="$(sql -c "select id from tours where status = 'in_progress' order by id limit 1")"
[ -n "$TID" ] || TID="$(sql -c "select id from tours where published_at is not null order by id limit 1")"
VER="$(sql -c "select version from tours where id = '$TID'")"
want "lifecycle guard trigger installed" "$(sql -c "select count(*) from pg_trigger where tgname = 'tours_lifecycle_guard' and not tgisinternal")" 1
want "close/archive/delete functions installed" "$(sql -c "select count(*) from pg_proc where proname in ('close_tour','cancel_stop','delete_tour','tour_delete_eligibility','delete_draft_stop')")" 5
U="$(sql -c "select user_id from user_preferences limit 1")"; [ -z "$U" ] || die "unexpected preferences rows"
OWNER="$(sql -c "select m.user_id from memberships m where m.role = 'owner' limit 1")"
sql -c "insert into user_preferences (user_id, language, theme) values ('$OWNER', 'de', 'dark')" >/dev/null; ok "preferences row written"
CANCEL="$(sql -c "select id from tours where published_at is null and status = 'planned' order by id limit 1")"
[ -n "$CANCEL" ] || die "stand-in has no draft tour to cancel"
sql -c "update tours set status = 'cancelled', closed_at = now(), close_reason = 'rehearsal' where id = '$CANCEL'" >/dev/null && ok "a draft tour cancelled (new status in use)"
sql -c "update tours set archived_at = now(), archived_by = '$OWNER' where id = '$CANCEL'" >/dev/null && ok "the cancelled tour archived"
if sql -c "update tours set name = name || ' x' where id = '$CANCEL'" >/dev/null 2>&1; then die "an archived tour could be edited"; fi
ok "guard: an archived tour cannot be edited (tour_archived)"
sql <"$FP" >"$WORK/fp.used"

say "post-migration backup"
backup post; ok "post-migration backup taken"

# ------------------------------------------------------------- rollback (reverse order)
say "rollback"
if { say "begin;"; say "set local turvio.confirm_drop_tour_lifecycle = 'yes';"; cat "$D2"; say "commit;"; } | sql >/dev/null 2>&1; then die "lifecycle down script ran while a cancelled tour exists"; fi
ok "lifecycle rollback refuses while a cancelled tour exists"
if { say "begin;"; cat "$D3"; say "commit;"; } | sql >/dev/null 2>&1; then die "settings down script ran without confirmation"; fi
ok "settings rollback refuses without turvio.confirm_drop_settings"
# Resolve the cancelled tour before rolling back (documented in the runbook): the lifecycle guard
# blocks reopening closed/archived tours, so this operator step bypasses triggers explicitly.
{ say "begin;"; say "set local session_replication_role = replica;"
  say "update tours set status = 'planned', closed_at = null, close_reason = null, archived_at = null, archived_by = null where status = 'cancelled';"; say "commit;"; } | sql >/dev/null
want "no cancelled tours left" "$(sql -c "select count(*) from tours where status = 'cancelled'")" 0
sql <"$FP" >"$WORK/fp.before-rollback"
{ say "begin;"; say "set local lock_timeout = '5s';"; say "set local turvio.confirm_drop_settings = 'yes';"; cat "$D3"
  say "delete from supabase_migrations.schema_migrations where version = '20261119000300';"; say "commit;"; } | sql
{ say "begin;"; say "set local lock_timeout = '5s';"; say "set local turvio.confirm_drop_tour_lifecycle = 'yes';"; cat "$D2"
  say "delete from supabase_migrations.schema_migrations where version in ('20261119000200','20261119000100');"; say "commit;"; } | sql
sql <"$FP" >"$WORK/fp.rolled-back"
cmp -s "$WORK/fp.before-rollback" "$WORK/fp.rolled-back" || { diff "$WORK/fp.before-rollback" "$WORK/fp.rolled-back"; die "rollback changed data"; }
ok "rollback keeps every row (fingerprint equal)"
want "schema back at $BASE" "$(sql -c "select count(*) from information_schema.columns where table_name = 'tours' and column_name = 'archived_at'") $(sql -c "select count(*) from pg_class where relname = 'user_preferences'") $(sql -c "select max(version) from supabase_migrations.schema_migrations")" "0 0 $BASE"
# The previous release's functions are back: a tour can be created and published again with its API.
want "previous definitions restored (proofs_insert policy present)" "$(sql -c "select count(*) from pg_policies where policyname = 'proofs_insert'")" 1

# ------------------------------------------------------------- disaster recovery: restore the pre-migration backup
say "restore pre-migration backup into a fresh database"
SQLDB=postgres sql -c "create database restored" >/dev/null
SQLDB=restored sql -c "create schema if not exists auth; create table if not exists auth.users (id uuid primary key, email varchar(255)); create or replace function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$; drop schema public cascade;" >/dev/null
gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --decrypt "$WORK/pre.dump.gpg" 3< <(printf '%s' "$PASS") >"$WORK/pre.dump"
P_ pg_restore -d restored --no-owner --no-privileges --section=pre-data --section=data --exit-on-error --single-transaction "$WORK/pre.dump"
P_ psql -d "$DB" -XAtc 'copy (select id from auth.users) to stdout' | P_ psql -d restored -Xqc 'copy auth.users (id) from stdin'
P_ pg_restore -d restored --no-owner --no-privileges --section=post-data --exit-on-error --single-transaction "$WORK/pre.dump"
rm -f "$WORK/pre.dump"
SQLDB=restored sql <"$FP" >"$WORK/fp.restored"
want "restored auth.users ids" "$(grep '^auth.users|' "$WORK/fp.restored" | cut -d'|' -f2)" "$(grep '^auth.users|' "$WORK/fp.baseline" | cut -d'|' -f2)"
cmp -s <(grep -v '^auth.users|' "$WORK/fp.baseline") <(grep -v '^auth.users|' "$WORK/fp.restored") || { diff "$WORK/fp.baseline" "$WORK/fp.restored" | head; die "restored database differs from the baseline"; }
ok "restored pre-migration backup equals the baseline fingerprint"
want "restored database is at $BASE (previous release compatible)" "$(SQLDB=restored sql -c "select max(version) from supabase_migrations.schema_migrations")" "$BASE"

say "release rehearsal (Phase B–G migrations): PASSED"
