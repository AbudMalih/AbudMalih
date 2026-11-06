#!/usr/bin/env bash
# Starts the complete local TURVIO stack (development only):
#   PostgreSQL :54329 · optimizer :8000 · API :4000 · Dispatch :3000 · Admin :3001 · Driver (web build) :8081
#
#   scripts/dev-stack.sh up [--fresh] [--no-demo] [--pilot]   build + start everything (fresh = reset DB + seed; pilot = 5 Hannover drivers, empty day)
#   scripts/dev-stack.sh down                       stop the app processes (database keeps running)
#
# Logs and PID files: $TURVIO_RUN_DIR (default /tmp/turvio-run). Secrets below are
# DEVELOPMENT DEFAULTS for a local machine – never reuse them anywhere else.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="${TURVIO_RUN_DIR:-/tmp/turvio-run}"
mkdir -p "$RUN"

export TURVIO_DB_PASSWORD="${TURVIO_DB_PASSWORD:-turvio-dev-only}"
DB_URL="$("$ROOT/scripts/db.sh" url)"
JWT_SECRET="${JWT_SECRET:-local-development-only-secret-0123456789abcdef}"

start() { # name, dir, command...
  local name=$1 dir=$2; shift 2
  # Own process group per service, so `down` stops wrappers (npx, uvicorn) and children together.
  (cd "$dir" && setsid nohup "$@" >"$RUN/$name.log" 2>&1 & echo $! >"$RUN/$name.pid")
}
wait_for() { # url, name
  for _ in $(seq 1 90); do curl -sf -o /dev/null "$1" && { echo "  ✓ $2"; return 0; }; sleep 1; done
  echo "  ✗ $2 did not start – see $RUN/$2.log"; return 1
}

up() {
  local fresh=0 demo=true pilot=false
  for a in "$@"; do case $a in --fresh) fresh=1 ;; --no-demo) demo=false ;; --pilot) pilot=true; demo=false ;; esac; done
  "$ROOT/scripts/db.sh" start
  if [ $fresh = 1 ]; then
    "$ROOT/scripts/db.sh" reset
    (cd "$ROOT/apps/api" && SEED_DEMO_DAY=$demo SEED_PILOT=$pilot npx tsx src/scripts/seed.ts)
  fi
  echo "Building web apps…"
  (cd "$ROOT/apps/dispatch" && NEXT_PUBLIC_TURVIO_ENV="Development · synthetic data" npx next build >"$RUN/dispatch-build.log" 2>&1)
  (cd "$ROOT/apps/admin" && NEXT_PUBLIC_TURVIO_ENV="Development · synthetic data" npx next build >"$RUN/admin-build.log" 2>&1)
  (cd "$ROOT/apps/driver" && EXPO_PUBLIC_API_URL=http://localhost:4000 EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir "$RUN/driver-web" >"$RUN/driver-build.log" 2>&1) || echo "  (driver web build failed – see $RUN/driver-build.log)"
  echo "Starting services…"
  # Optional services (development): TURVIO_OSRM_URL (see scripts/osrm-local.sh), TURVIO_GEOCODER=postgres.
  # TURVIO_RATE_LIMIT: the pilot simulation sends every driver from 127.0.0.1, so it needs more than the
  # per-IP default of 600/min (e.g. 5000). Real devices have their own addresses; keep the default there.
  start optimizer "$ROOT/services/optimizer" env OSRM_URL="${TURVIO_OSRM_URL:-}" .venv/bin/uvicorn turvio_optimizer.app:app --port 8000
  start api "$ROOT/apps/api" env NODE_ENV=development AUTH_PROVIDER=local DATABASE_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" \
    OPTIMIZER_URL=http://localhost:8000 DEV_MAILBOX=true MAILER=outbox ${TURVIO_OSRM_URL:+OSRM_URL=$TURVIO_OSRM_URL} GEOCODER="${TURVIO_GEOCODER:-none}" \
    ${TURVIO_RATE_LIMIT:+RATE_LIMIT_PER_MINUTE=$TURVIO_RATE_LIMIT} \
    CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:8081 npx tsx src/server.ts
  start dispatch "$ROOT/apps/dispatch" env TURVIO_API_URL=http://localhost:4000 npx next start --port 3000
  start admin "$ROOT/apps/admin" env TURVIO_API_URL=http://localhost:4000 npx next start --port 3001
  [ -d "$RUN/driver-web" ] && start driver "$ROOT" node scripts/serve-static.mjs "$RUN/driver-web" 8081
  wait_for http://localhost:8000/health optimizer
  wait_for http://localhost:4000/health api
  wait_for http://localhost:3000/login dispatch
  wait_for http://localhost:3001/login admin
  [ -d "$RUN/driver-web" ] && wait_for http://localhost:8081/ driver
  echo "Dispatch http://localhost:3000 · Admin http://localhost:3001 · Driver (web) http://localhost:8081 · dev mailbox http://localhost:4000/v1/dev/outbox"
}

down() {
  for f in "$RUN"/*.pid; do
    [ -f "$f" ] || continue
    pid=$(cat "$f")
    kill -TERM -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    rm -f "$f"
  done
  # setsid may fork, so the stored pid is not always the group leader: also stop anything
  # still listening on the stack's ports (development machine only).
  for port in 8000 4000 3000 3001 8081; do
    fuser -k -TERM "$port/tcp" >/dev/null 2>&1 || true
  done
  echo "stopped app processes"
}

case "${1:-}" in
  up) shift; up "$@" ;;
  down) down ;;
  *) echo "usage: $0 up [--fresh] [--no-demo] | down"; exit 1 ;;
esac
