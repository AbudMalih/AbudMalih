#!/bin/bash
# TURVIO – encrypted backup of turvio-staging (run on the operator's Mac).
#
# - Target is fixed to the turvio-staging project; no other database can be reached with this user.
# - Read-only: pg_dump runs in a read-only snapshot; nothing on staging is changed.
# - The dump never touches the disk unencrypted: pg_dump | gpg (AES-256) -> *.dump.gpg
# - Passwords are typed at hidden prompts; they are not stored, not logged, not on the command line.
#
# Needs: Docker Desktop (runs the PostgreSQL 17 tools) and GnuPG (brew install gnupg).
# Usage: bash turvio-staging-backup.sh
set -euo pipefail
umask 077

REF="xwryomkbrkwjytwofgcu"                          # turvio-staging
HOST="aws-1-eu-central-1.pooler.supabase.com"       # session pooler (port 5432; 6543 is not for pg_dump)
CONN="host=$HOST port=5432 dbname=postgres user=postgres.$REF sslmode=require connect_timeout=15 application_name=turvio-backup"
IMAGE="postgres:17"
DIR="$HOME/turvio-backups"
OUT="$DIR/turvio-staging-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"

die() { echo "ABORTED: $*" >&2; exit 1; }
pg() { docker run --rm -e PGPASSWORD "$IMAGE" "$@"; }
cleanup() { unset PGPASSWORD GPG_PASS GPG_PASS2; [ -f "$OUT.partial" ] && rm -f "$OUT.partial"; return 0; }
trap cleanup EXIT

command -v docker >/dev/null || die "Docker is not installed"
command -v gpg >/dev/null || die "GnuPG is not installed (brew install gnupg)"
docker info >/dev/null 2>&1 || die "Docker is not running"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE" >/dev/null || die "cannot pull $IMAGE"
mkdir -p "$DIR" && chmod 700 "$DIR"

read -rsp "Database password of turvio-staging (Supabase dashboard): " PGPASSWORD; echo; export PGPASSWORD
[ -n "$PGPASSWORD" ] || die "no password"

# 1. Confirm the target (read-only).
info=$(pg psql "$CONN" -XAtq -v ON_ERROR_STOP=1 -c "set default_transaction_read_only = on" \
  -c "select current_user || '|' || (select max(version) from supabase_migrations.schema_migrations) || '|' || (select count(*) from public.organizations) || '|' || split_part(version(), ' ', 2)") \
  || die "cannot connect to turvio-staging (password or network)"
IFS='|' read -r who latest orgs ver <<<"$info"
echo "Connected to turvio-staging ($REF) as $who – PostgreSQL $ver, latest migration $latest, organizations: $orgs"
[ "$who" = "postgres" ] || die "unexpected database user $who"
case "$ver" in 17.*) ;; *) die "expected PostgreSQL 17, got $ver" ;; esac
[ "$latest" = "20261116000100" ] || die "expected latest migration 20261116000100 (pre-Phase-B), found $latest"

# 2. Passphrase for the backup file (keep it in your password manager; it is the only way to open the file).
read -rsp "New passphrase for the backup file (min. 12 characters): " GPG_PASS; echo
read -rsp "Repeat the passphrase: " GPG_PASS2; echo
[ "$GPG_PASS" = "$GPG_PASS2" ] || die "passphrases differ"
[ ${#GPG_PASS} -ge 12 ] || die "passphrase too short"

# 3. Dump -> encrypt, streamed (no plaintext file).
echo "Dumping schemas public, app, geo, supabase_migrations …"
pg pg_dump "$CONN" --format=custom --compress=6 --no-owner --no-privileges \
    --schema=public --schema=app --schema=geo --schema=supabase_migrations \
  | gpg --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 \
        --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-count 65011712 \
        --output "$OUT.partial" 3< <(printf '%s' "$GPG_PASS") \
  || die "dump or encryption failed – no backup written"
mv "$OUT.partial" "$OUT"
chmod 400 "$OUT"
(cd "$DIR" && shasum -a 256 "$(basename "$OUT")" > "$(basename "$OUT").sha256")

echo
echo "Backup written:  $OUT"
echo "Size:            $(du -h "$OUT" | cut -f1)"
echo "Type:            $(file -b "$OUT")"
echo "SHA-256:         $(cut -d' ' -f1 "$OUT.sha256")"
echo "Next: bash turvio-staging-backup-verify.sh \"$OUT\""
