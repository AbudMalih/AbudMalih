#!/bin/bash
# TURVIO – verify an encrypted turvio-staging backup without writing it unencrypted anywhere.
#
# [1] Checksum and encryption (AES-256, no readable dump content in the file).
# [2] The passphrase opens it and the archive is readable: table of contents (object names only).
# [3] DATA restore: all tables and rows into a throwaway PostgreSQL 17 container.
# [4] SCHEMA restore: constraints, foreign keys, indexes, triggers, row-level security and policies,
#     then the restored object counts are compared with the archive's table of contents.
# [5] Fingerprint per table: row count and content hash (no personal data) for comparison with staging.
#
# Safety: the container is unique to this run, has no network (--network none), keeps its database in
# memory (tmpfs), writes no logs (--log-driver none) and is removed at the end. The decrypted stream goes
# straight into pg_restore; the table of contents and error messages stay in memory. Any error – in gpg,
# pg_restore or psql – stops the script with FAILED; "VERIFIED" is printed only after every check
# passed and the container is confirmed removed.
#
# Not covered (Supabase-managed, not part of this backup): owners and grants (--no-owner/--no-privileges),
# the auth/storage/vault/cron schemas and their data, extensions in the "extensions" schema.
#
# Works with macOS's bash 3.2. Nothing derived from the backup is passed through here-strings or
# temporary files (bash 3.2 writes here-strings to a temp file): only pipes and shell variables.
#
# Usage: bash turvio-staging-backup-verify.sh ~/turvio-backups/turvio-staging-<time>.dump.gpg
set -euo pipefail
umask 077

FILE="${1:?usage: $0 <backup .dump.gpg>}"
IMAGE="postgres:17"
RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$-$RANDOM"
BOX="turvio-restore-check-$RUN_ID"
CID=""   # id of the container THIS run created; cleanup touches nothing else

die() { echo "FAILED: $*" >&2; exit 1; }
remove_box() { # remove this run's container; succeeds only if it is really gone
  [ -n "$CID" ] || return 0
  docker rm -f "$CID" >/dev/null 2>&1 || true
  if docker container inspect "$CID" >/dev/null 2>&1; then return 1; fi
  CID=""
}
on_exit() {
  local rc=$?
  unset GPG_PASS
  if ! remove_box; then echo "WARNING: could not remove container $BOX – remove it with: docker rm -f $BOX" >&2; rc=1; fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT TERM

# Errors from pg_restore/psql, without lines that could quote row contents (CONTEXT/COPY data lines).
safe_errors() { grep -v -E '^(CONTEXT|DETAIL|HINT|LINE [0-9]+):|^[[:space:]]' | sed -E 's/=\([^)]*\)/=(…)/g; s/: "[^"]*"$/: "…"/' | cut -c1-200 | head -15 || true; }
say() { printf '%s\n' "$1"; }   # feed a variable into a pipe (no here-string, no temp file)

[ -f "$FILE" ] || die "no such file: $FILE"
[ -f "$FILE.sha256" ] || die "checksum file missing: $FILE.sha256"
command -v docker >/dev/null || die "Docker is not installed"
command -v gpg >/dev/null || die "GnuPG is not installed"
docker info >/dev/null 2>&1 || die "Docker is not running"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image $IMAGE missing – run the backup script first (it pulls it)"

# ---------------------------------------------------------------- [1] integrity and encryption
(cd "$(dirname "$FILE")" && shasum -a 256 -c "$(basename "$FILE").sha256" >/dev/null 2>&1) || die "checksum mismatch – the file was changed or damaged"
echo "[1] checksum OK"
kind=$(file -b "$FILE")
say "$kind" | grep -q -i -E "symmetric(ally)? (key )?encrypted" || die "file is not GPG-encrypted: $kind"
say "$kind" | grep -q -i "AES" || die "unexpected cipher: $kind"
if LC_ALL=C grep -a -q -E "PGDMP|CREATE TABLE|COPY public\." "$FILE"; then die "readable dump content found – not encrypted"; fi
echo "[1] encrypted ($kind); no readable dump content"

read -rsp "Backup passphrase: " GPG_PASS; echo
[ -n "$GPG_PASS" ] || die "no passphrase"
dec() { gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FILE" 3< <(printf '%s' "$GPG_PASS"); }

# ---------------------------------------------------------------- [2] table of contents (in memory)
toc=$(dec 2>/dev/null | docker run --rm -i --network none --log-driver none "$IMAGE" pg_restore --list 2>/dev/null) \
  || die "wrong passphrase or damaged archive"
SCHEMAS='(public|app|geo|supabase_migrations)'
entries() { say "$toc" | grep -E "^[0-9]+; [0-9]+ [0-9]+ $1 $SCHEMAS " || true; }   # exact type, our schemas
n() { entries "$1" | grep -c . || true; }
echo "[2] archive readable – $(say "$toc" | grep -c -E '^[0-9]+;') entries: tables $(n 'TABLE') with data $(n 'TABLE DATA'), functions $(n 'FUNCTION'), policies $(n 'POLICY'), triggers $(n 'TRIGGER'), foreign keys $(n 'FK CONSTRAINT'), indexes $(n 'INDEX')"
[ "$(n 'TABLE')" -gt 0 ] && [ "$(n 'TABLE DATA')" -eq "$(n 'TABLE')" ] || die "archive has $(n 'TABLE') tables but $(n 'TABLE DATA') data sections"
for t in public.memberships public.membership_depots public.invitations public.drivers public.tours public.stops public.parcels supabase_migrations.schema_migrations; do
  entries 'TABLE DATA' | grep -q " ${t%%.*} ${t#*.} " || die "archive has no data for $t"
done

# ---------------------------------------------------------------- throwaway container
CID=$(docker run -d --name "$BOX" --label "turvio.restore-check=$RUN_ID" --network none --log-driver none \
  --tmpfs /var/lib/postgresql/data:rw,size=2g -e POSTGRES_HOST_AUTH_METHOD=trust -e PGTZ=UTC "$IMAGE") \
  || die "could not start the restore container"
ready=0
for _ in $(seq 1 90); do
  # During initialisation the image runs a temporary server on the socket only; the final server
  # also listens on TCP (loopback inside the container – there is no network).
  if docker exec "$CID" pg_isready -h 127.0.0.1 -U postgres -q 2>/dev/null; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || die "restore container did not start"
sql() { docker exec -i "$CID" psql -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1 "$@"; }

# Stand-ins for what Supabase provides and this backup does not contain (roles, auth.users, auth.uid(),
# publications) – as supabase/local/00_supabase_stubs.sql.
pubs=$(say "$toc" | grep -E '^[0-9]+; [0-9]+ [0-9]+ PUBLICATION TABLE ' | awk '{print $7}' | sort -u | tr '\n' ' ' || true)
out=$(sql 2>&1 <<SQL
do \$\$ declare r text; begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'turvio_service', 'supabase_admin', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
  foreach r in array string_to_array(trim('$pubs'), ' ') loop
    if r <> '' and not exists (select 1 from pg_publication where pubname = r) then execute format('create publication %I', r); end if;
  end loop;
end \$\$;
create schema auth;
create table auth.users (id uuid primary key, email varchar(255));
create function auth.uid() returns uuid language sql stable as \$f\$ select null::uuid \$f\$;
SQL
) || { say "$out" | safe_errors; die "could not prepare the restore database"; }
# The archive creates schema public itself when it contains it.
if say "$toc" | grep -q -E "^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public "; then sql -c "drop schema public cascade" >/dev/null || die "could not prepare schema public"; fi

restore() { # restore <sections...>: one transaction, stops at the first error, exit status checked
  local args=() s msg
  for s in "$@"; do args+=("--section=$s"); done
  if ! msg=$( { dec | docker exec -i "$CID" pg_restore -U postgres -d postgres --no-owner --no-privileges \
                 --exit-on-error --single-transaction "${args[@]}"; } 2>&1 ); then
    say "$msg" | safe_errors
    die "restore of $* failed"
  fi
}

# ---------------------------------------------------------------- [3] data restore
restore pre-data data
tables=$(sql -c "select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and c.relkind in ('r','p')")
echo "[3] DATA restore OK: $tables tables and all their rows restored (one transaction, no errors)"

# ---------------------------------------------------------------- [4] schema restore
# Foreign keys to Supabase's auth.users need the referenced ids: add exactly those ids (no other data).
fk_sql=$(dec | docker exec -i "$CID" pg_restore --section=post-data -f - 2>/dev/null \
  | awk '/^ALTER TABLE ONLY /{tbl=$4} /FOREIGN KEY \(.*\) REFERENCES auth\.users\(id\)/{match($0,/FOREIGN KEY \([a-z_0-9]+\)/); col=substr($0,RSTART+13,RLENGTH-14); printf "insert into auth.users (id) select distinct %s from %s where %s is not null on conflict do nothing;\n", col, tbl, col}') \
  || die "could not read the archive's constraints"
if [ -n "$fk_sql" ]; then out=$(say "$fk_sql" | sql 2>&1) || { say "$out" | safe_errors; die "could not prepare auth.users ids"; }; fi
restore post-data

# Every object in the archive must exist in the restored database.
q="select json_build_object(
  'TABLE', (select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and c.relkind in ('r','p')),
  'VIEW', (select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and c.relkind = 'v'),
  'FUNCTION', (select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname in ('public','app','geo','supabase_migrations') and p.prokind = 'f'),
  'POLICY', (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations')),
  'TRIGGER', (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and not t.tgisinternal),
  'FK CONSTRAINT', (select count(*) from pg_constraint k join pg_namespace s on s.oid=k.connamespace where s.nspname in ('public','app','geo','supabase_migrations') and k.contype = 'f'),
  'CONSTRAINT', (select count(*) from pg_constraint k join pg_namespace s on s.oid=k.connamespace where s.nspname in ('public','app','geo','supabase_migrations') and k.contype in ('p','u','x') and k.conrelid <> 0),
  'INDEX', (select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid and k.contype in ('p','u','x'))),
  'ROW SECURITY', (select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname in ('public','app','geo','supabase_migrations') and c.relrowsecurity))"
restored=$(sql -c "$q") || die "could not count restored objects"
summary=""
for k in 'TABLE' 'VIEW' 'FUNCTION' 'POLICY' 'TRIGGER' 'FK CONSTRAINT' 'CONSTRAINT' 'INDEX' 'ROW SECURITY'; do
  want=$(n "$k"); got=$(say "$restored" | sed -E "s/.*\"$k\" : ([0-9]+).*/\1/")
  [ "$got" = "$want" ] || die "schema restore incomplete: $k archive $want, restored $got"
  summary="$summary$(say "$k" | tr 'A-Z' 'a-z') $got, "
done
echo "[4] SCHEMA restore OK: ${summary%, } – all equal to the archive"

# ---------------------------------------------------------------- [5] fingerprint
fp=$(sql -F ' ' <<'SQL'
select rpad(t, 22), lpad(n::text, 6), h from (
  select 'organizations' t, count(*) n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) h from public.organizations x
  union all select 'subscriptions', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.subscriptions x
  union all select 'memberships', count(*), md5(coalesce(string_agg((to_jsonb(x) - 'all_locations')::text, '|' order by x.id), '')) from public.memberships x
  union all select 'membership_depots', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.membership_depots x
  union all select 'invitations', count(*), md5(coalesce(string_agg((to_jsonb(x) - 'all_locations')::text, '|' order by x.id), '')) from public.invitations x
  union all select 'platform_admins', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.platform_admins x
  union all select 'depots', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.depots x
  union all select 'drivers', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.drivers x
  union all select 'vehicles', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.vehicles x
  union all select 'tours', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.tours x
  union all select 'stops', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.stops x
  union all select 'parcels', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.parcels x
  union all select 'driver_positions', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.driver_positions x
  union all select 'location_pings', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.location_pings x
  union all select 'tracking_notice_acks', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) from public.tracking_notice_acks x
  union all select 'audit_log', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.audit_log x
) f order by t;
select rpad('migrations', 22), lpad(count(*)::text, 6), max(version) from supabase_migrations.schema_migrations;
SQL
) || die "fingerprint query failed"

# ---------------------------------------------------------------- cleanup, then the verdict
remove_box || die "could not remove container $BOX – remove it with: docker rm -f $BOX"
echo "[5] fingerprint – send this block to Claude for comparison with staging (counts and hashes only):"
echo "$fp"
echo "VERIFIED: checksum, AES-256 encryption, readable archive, complete data restore and complete schema restore; restore container removed, nothing unencrypted on disk."
