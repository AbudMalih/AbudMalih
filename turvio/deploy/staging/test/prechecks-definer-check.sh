#!/bin/bash
# Validates the SECURITY DEFINER checks of the staging runbooks on throwaway local databases:
#   A. runbooks/phase-i-step1-prechecks.sql §7 – database at the staging baseline (≤ 20261118000100)
#   B. runbooks/phase-i-step2-verify.sql V5   – database with all migrations (the state after step 2)
# Each runs the complete runbook file (read-only transaction, ON_ERROR_STOP), first on the clean
# database (nothing flagged), then with fixture functions:
#   - search_path='' and search_path=pg_catalog count as pinned
#   - exactly public.rls_auto_enable() is a documented exception: reported, not counted
#   - every other unpinned definer function is listed and counted: no path, path=public,
#     "pg_catalog, public", the overload rls_auto_enable(int), app.rls_auto_enable()
#   - functions that are not SECURITY DEFINER are ignored
#   - B only: the exception's EXECUTE right for anon / authenticated is reported (t | t while granted,
#     f | f once revoked – the state on staging)
# Needs a local PostgreSQL superuser connection (PGHOST/PGPORT/PGUSER; default /tmp:54329, postgres).
# Touches no other database; the throwaway databases are dropped at the end.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
RUNBOOKS="$ROOT/deploy/staging/runbooks"
DBS=()
fail() { echo "FAILED: $*" >&2; exit 1; }
cleanup() { for d in "${DBS[@]}"; do psql -X -q -d postgres -c "drop database if exists $d with (force)" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT

# new_db <name> <max migration version>: stubs + migrations up to that version, recorded like on staging.
new_db() {
  local db=$1 max=$2
  DBS+=("$db")
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database $db" >/dev/null
  psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$ROOT/supabase/local/00_supabase_stubs.sql" >/dev/null
  psql -X -q -v ON_ERROR_STOP=1 -d "$db" -c "create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)" >/dev/null
  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    local v; v=$(basename "$f" | cut -c1-14)
    [[ "$v" > "$max" ]] && continue
    psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null
    psql -X -q -v ON_ERROR_STOP=1 -d "$db" -c "insert into supabase_migrations.schema_migrations (version) values ('$v')" >/dev/null
  done
}
FIXTURES=$(cat <<'SQL'
create function public.rls_auto_enable() returns void language sql security definer as $$ select $$;            -- exception (even unpinned)
create function app.t_pinned_empty() returns void language sql security definer set search_path = '' as $$ select $$;
create function app.t_pinned_catalog() returns void language sql security definer set search_path = pg_catalog as $$ select $$;
create function public.t_no_path() returns void language sql security definer as $$ select $$;
create function public.t_path_public() returns void language sql security definer set search_path = public as $$ select $$;
create function public.t_catalog_public() returns void language sql security definer set search_path = pg_catalog, public as $$ select $$;
create function public.rls_auto_enable(int) returns void language sql security definer as $$ select $$;       -- other signature
create function app.rls_auto_enable() returns void language sql security definer as $$ select $$;             -- other schema
create function public.t_invoker() returns void language sql as $$ select $$;                                   -- not SECURITY DEFINER
SQL
)
WANT_LIST="app.rls_auto_enable() public.rls_auto_enable(integer) public.t_catalog_public() public.t_no_path() public.t_path_public() "

# section <db> <file> <start marker> <end marker>: that part of the runbook output (unaligned, '|').
section() { psql -X -q -v ON_ERROR_STOP=1 -At -F '|' -d "$1" -f "$2" | sed -n "/^$3/,/^$4/p"; }
counts() { grep -E '^[0-9]+\|[0-9]+$' | tail -1; }
listed() { grep -E '^(app|public)\.' | cut -d'|' -f1 | sort | tr '\n' ' '; }
exec_rights() { grep -E '^(t|f)?\|(t|f)?$' | tail -1; }

# ------------------------------------------------------------------ A. pre-check (baseline)
A=precheck_definer_a_$$
new_db "$A" 20261118000100
out=$(section "$A" "$RUNBOOKS/phase-i-step1-prechecks.sql" '== 7\.' '== 8\.')
[ "$(counts <<<"$out")" = "0|0" ] || fail "A clean: expected 0|0, got $(counts <<<"$out")"
[ -z "$(listed <<<"$out")" ] || fail "A clean: listed $(listed <<<"$out")"
echo "ok   A pre-check, clean baseline: unpinned=0, exceptions=0"
psql -X -q -v ON_ERROR_STOP=1 -d "$A" -c "$FIXTURES" >/dev/null
out=$(section "$A" "$RUNBOOKS/phase-i-step1-prechecks.sql" '== 7\.' '== 8\.')
[ "$(listed <<<"$out")" = "$WANT_LIST" ] || fail "A fixtures: listed '$(listed <<<"$out")'"
[ "$(counts <<<"$out")" = "5|1" ] || fail "A fixtures: expected 5|1, got $(counts <<<"$out")"
echo "ok   A pre-check, fixtures: '' and pg_catalog pinned; exception reported (1); 5 flagged"

# ------------------------------------------------------------------ B. step 2 verification (all migrations)
B=precheck_definer_b_$$
new_db "$B" 99999999999999
out=$(section "$B" "$RUNBOOKS/phase-i-step2-verify.sql" '== V5\.' '== V6\.')
[ "$(counts <<<"$out")" = "0|0" ] || fail "B clean: expected 0|0, got $(counts <<<"$out")"
[ -z "$(listed <<<"$out")" ] || fail "B clean: listed $(listed <<<"$out")"
[ "$(exec_rights <<<"$out")" = "|" ] || fail "B clean: exception rights should be empty (no exception), got '$(exec_rights <<<"$out")'"
echo "ok   B verify, clean (all migrations): unpinned=0, exceptions=0, no exception rights to report"
psql -X -q -v ON_ERROR_STOP=1 -d "$B" -c "$FIXTURES" >/dev/null
out=$(section "$B" "$RUNBOOKS/phase-i-step2-verify.sql" '== V5\.' '== V6\.')
[ "$(listed <<<"$out")" = "$WANT_LIST" ] || fail "B fixtures: listed '$(listed <<<"$out")'"
[ "$(counts <<<"$out")" = "5|1" ] || fail "B fixtures: expected 5|1, got $(counts <<<"$out")"
[ "$(exec_rights <<<"$out")" = "t|t" ] || fail "B fixtures: new function is executable by PUBLIC – expected t|t, got '$(exec_rights <<<"$out")'"
echo "ok   B verify, fixtures: 5 flagged, exception reported (1); exception executable by anon|authenticated detected (t|t)"
psql -X -q -v ON_ERROR_STOP=1 -d "$B" -c "revoke execute on function public.rls_auto_enable() from public, anon, authenticated" >/dev/null
out=$(section "$B" "$RUNBOOKS/phase-i-step2-verify.sql" '== V5\.' '== V6\.')
[ "$(exec_rights <<<"$out")" = "f|f" ] || fail "B revoked: expected f|f, got '$(exec_rights <<<"$out")'"
[ "$(counts <<<"$out")" = "5|1" ] || fail "B revoked: counts changed: $(counts <<<"$out")"
echo "ok   B verify, exception revoked for anon/authenticated (staging state): f|f"
echo "PASSED"
