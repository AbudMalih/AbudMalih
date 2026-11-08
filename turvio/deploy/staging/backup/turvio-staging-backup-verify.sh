#!/bin/bash
# TURVIO – verify an encrypted turvio-staging backup without writing it unencrypted anywhere.
#
# 1. Checksum and encryption (AES-256, no readable dump content in the file).
# 2. The passphrase opens it and the archive is readable: table of contents (object names only).
# 3. Full restore test of the tables and data into a throwaway PostgreSQL 17 container that keeps its
#    data in memory (tmpfs), has no network and is deleted afterwards. The decrypted stream goes
#    straight into pg_restore; no unencrypted file is created.
# 4. Prints per table: row count and content hash (no personal data) for comparison with staging.
#
# Usage: bash turvio-staging-backup-verify.sh ~/turvio-backups/turvio-staging-<time>.dump.gpg
set -euo pipefail
umask 077

FILE="${1:?usage: $0 <backup .dump.gpg>}"
IMAGE="postgres:17"
BOX="turvio-restore-check"
die() { echo "FAILED: $*" >&2; exit 1; }
cleanup() { unset GPG_PASS; docker rm -f "$BOX" >/dev/null 2>&1 || true; }
trap cleanup EXIT
[ -f "$FILE" ] || die "no such file: $FILE"

# 1. Integrity and encryption
(cd "$(dirname "$FILE")" && shasum -a 256 -c "$(basename "$FILE").sha256" >/dev/null) || die "checksum mismatch"
echo "[1] checksum OK"
file -b "$FILE" | grep -q -i -E "symmetric(ally)? (key )?encrypted" || die "file is not GPG-encrypted: $(file -b "$FILE")"
if LC_ALL=C grep -a -q -E "PGDMP|CREATE TABLE|COPY public\." "$FILE"; then die "readable dump content found – not encrypted"; fi
echo "[1] encrypted: $(file -b "$FILE"); no readable dump content"

read -rsp "Backup passphrase: " GPG_PASS; echo
dec() { gpg --batch --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FILE" 3< <(printf '%s' "$GPG_PASS"); }

# 2. Readable archive: table of contents (names only, kept in memory)
toc=$(dec | docker run --rm -i --network none "$IMAGE" pg_restore --list) || die "wrong passphrase or damaged archive"
count() { grep -c -E "$1" <<<"$toc" || true; }
echo "[2] archive readable – $(count '^[0-9]+;') entries:"
echo "    tables $(count ' TABLE [a-z_]+ ')  table data $(count ' TABLE DATA ')  functions $(count ' FUNCTION ')  policies $(count ' POLICY ')  triggers $(count ' TRIGGER ')  foreign keys $(count ' FK CONSTRAINT ')  indexes $(count ' INDEX ')"
echo "    tables with data: $(grep -E ' TABLE DATA ' <<<"$toc" | awk '{print $(NF-2)"."$(NF-1)}' | sort | tr '\n' ' ')"

# 3. Restore test in a throwaway in-memory container
docker run -d --name "$BOX" --network none --tmpfs /var/lib/postgresql/data:rw,size=2g \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e PGTZ=UTC "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$BOX" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
sleep 2; docker exec "$BOX" pg_isready -U postgres -q || die "restore container did not start"
# Stand-ins for what Supabase provides (roles, auth.uid()) – as supabase/local/00_supabase_stubs.sql.
docker exec -i "$BOX" psql -U postgres -XqAt -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'turvio_service'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email varchar(255));
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
# Tables and data (pre-data + data). Constraints, triggers and policies (post-data) are listed in [2];
# they need Supabase's auth data, which is not part of this backup.
errs=$(dec | docker exec -i "$BOX" pg_restore -U postgres -d postgres --no-owner --no-privileges --section=pre-data --section=data 2>&1 >/dev/null | grep -E "^pg_restore: error|ERROR:" | grep -v -E 'schema "(public|auth)" already exists' || true)
if [ -n "$errs" ]; then echo "$errs" | cut -c1-200 | head -20; die "restore reported errors"; fi
echo "[3] restore test OK (tables and all rows restored into a throwaway PostgreSQL 17)"

# 4. Fingerprint (same as supabase/rollback/fingerprint.sql, without auth.users)
echo "[4] fingerprint – send this block to Claude for comparison with staging (counts and hashes only):"
docker exec -i "$BOX" psql -U postgres -XAt -F ' ' -v ON_ERROR_STOP=1 <<'SQL'
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
echo "[done] the throwaway container is removed now; nothing unencrypted remains on disk."
