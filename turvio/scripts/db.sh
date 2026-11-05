#!/usr/bin/env bash
# Local PostgreSQL for TURVIO development and tests (no Docker needed).
#   scripts/db.sh init|start|stop|reset|status|psql|url
# Uses the PostgreSQL 16 server binaries on this machine. Data lives OUTSIDE
# the repository (TURVIO_PGDATA, default /tmp/turvio-pg). Development only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${TURVIO_PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGDATA="${TURVIO_PGDATA:-/tmp/turvio-pg}"
PORT="${TURVIO_PGPORT:-54329}"
DB="${TURVIO_DB:-turvio}"
PASSWORD="${TURVIO_DB_PASSWORD:-turvio-dev-only}"
SOCK="/tmp"
RUN=()
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); fi

psql_admin() { "${RUN[@]}" "$PGBIN/psql" -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

init() {
  if [ -f "$PGDATA/PG_VERSION" ]; then echo "cluster exists at $PGDATA"; return; fi
  mkdir -p "$PGDATA"
  [ "$(id -u)" = "0" ] && chown postgres:postgres "$PGDATA"
  "${RUN[@]}" "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth-local=trust --auth-host=scram-sha-256 >/dev/null
  echo "initialised $PGDATA"
}

start() {
  if "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then echo "already running on :$PORT"; return; fi
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -w \
    -o "-p $PORT -k $SOCK -c listen_addresses=localhost" start >/dev/null
  echo "PostgreSQL running on localhost:$PORT"
}

stop() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null && echo stopped; }

reset() {
  # Fresh database: stubs, migrations, local auth, service role.
  psql_admin -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
  psql_admin -d "$DB" -f "$ROOT/supabase/local/00_supabase_stubs.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do psql_admin -d "$DB" -f "$f"; done
  psql_admin -d "$DB" -f "$ROOT/supabase/local/10_local_auth.sql"
  psql_admin -d "$DB" -f "$ROOT/supabase/local/20_local_service_role.sql"
  psql_admin -d postgres -c "alter role turvio_service password '$PASSWORD'"
  echo "database $DB reset (migrations applied)"
}

case "${1:-}" in
  init) init ;;
  start) init; start ;;
  stop) stop ;;
  reset) init; start; reset ;;
  status) "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" status ;;
  psql) shift; psql_admin -d "$DB" "$@" ;;
  url) echo "postgres://turvio_service:$PASSWORD@localhost:$PORT/$DB" ;;
  *) echo "usage: $0 init|start|stop|reset|status|psql|url"; exit 1 ;;
esac
