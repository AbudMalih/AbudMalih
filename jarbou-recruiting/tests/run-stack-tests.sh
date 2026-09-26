#!/usr/bin/env bash
# Full stack test on an ISOLATED copy (own folder, own database, port 18080).
# Usage: tests/run-stack-tests.sh        (KEEP=1 keeps the test stack running afterwards)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TEST_WORKDIR:-/tmp/jrc-stack-test}"
PROJECT=jrc-test
export TEST_BASE_URL="http://127.0.0.1:18080"
export TEST_ADMIN_USER=admin TEST_ADMIN_PASS='Test-Chef-Pass-2026'
pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; exit 1; }
dc() { (cd "$WORK" && docker compose -p "$PROJECT" "$@"); }
wait_healthy() {
  for i in $(seq 1 60); do
    s=$(dc ps --format '{{.Service}}={{.Health}}' | tr '\n' ' ')
    [[ "$s" == *"app=healthy"* && "$s" == *"db=healthy"* ]] && return 0
    sleep 3
  done
  dc ps; dc logs --tail 50 app; fail "stack did not become healthy"
}

echo "== Preparing isolated test stack in $WORK"
dc down -v >/dev/null 2>&1 || true
rm -rf "$WORK"; mkdir -p "$WORK"
tar -C "$SRC" --exclude=./data --exclude=./backups --exclude=./.env --exclude='./backend/node_modules' --exclude=./tests -cf - . | tar -C "$WORK" -xf -
cat > "$WORK/.env" <<ENV
APP_PORT=18080
POSTGRES_PASSWORD=stack-test-db-password-123456
APP_SECRET=stack-test-secret-0123456789abcdef0123456789
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_FULL_NAME=Test Admin
INITIAL_ADMIN_PASSWORD=Initial-Start-Pass-2026
TZ=Europe/Berlin
ENV

echo "== Docker build + start"
dc up -d --build >/dev/null
wait_healthy && pass "containers healthy (app + db)"

echo "== First administrator: forced password change"
node -e "
const {Client}=require('$SRC/tests/api/helpers');(async()=>{const c=new Client();
const l=await c.login('admin','Initial-Start-Pass-2026'); if(l.status!==200||!l.data.user.mustChangePassword) process.exit(1);
const p=await c.post('/api/auth/password',{currentPassword:'Initial-Start-Pass-2026',newPassword:process.env.TEST_ADMIN_PASS}); if(p.status!==200) process.exit(2);})()" \
  && pass "initial admin created from .env and must change password" || fail "initial admin flow"

echo "== Network exposure"
pb=$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$(dc ps -q db)")
[[ "$pb" == "{}" || "$pb" == "null" ]] && pass "PostgreSQL port is not published (bindings: $pb)" || fail "PostgreSQL is published: $pb"
curl -sf "$TEST_BASE_URL/api/health" >/dev/null && pass "app reachable on published port"

echo "== API tests"
node --test --test-concurrency=1 "$SRC"/tests/api/0[1-5]-*.test.js

echo "== Audit log is append-only at database level"
if dc exec -T db psql -U jarbou -d jarbou_recruiting -c "UPDATE audit_logs SET summary='tampered'" >/dev/null 2>&1; then fail "audit log UPDATE was allowed"; else pass "UPDATE rejected"; fi
if dc exec -T db psql -U jarbou -d jarbou_recruiting -c "DELETE FROM audit_logs" >/dev/null 2>&1; then fail "audit log DELETE was allowed"; else pass "DELETE rejected"; fi

echo "== Passwords are hashed (argon2id), never plain"
h=$(dc exec -T db psql -U jarbou -d jarbou_recruiting -tAc "SELECT password_hash FROM users WHERE username='admin'")
[[ "$h" == \$argon2id\$* ]] && pass "argon2id hash stored" || fail "unexpected password storage"

echo "== Persistence across restarts"
export MARKER_FILE="$WORK/marker.json"
node "$SRC/tests/persistence-check.js" create
dc restart app >/dev/null; wait_healthy; node "$SRC/tests/persistence-check.js" verify && pass "after app container restart"
dc restart db >/dev/null; sleep 3; wait_healthy; node "$SRC/tests/persistence-check.js" verify && pass "after PostgreSQL restart"
dc down >/dev/null; dc up -d >/dev/null; wait_healthy; node "$SRC/tests/persistence-check.js" verify && pass "after docker compose down + up"
[[ -d "$WORK/data/postgres/base" ]] && pass "database files on host folder ./data/postgres"

echo "== Backup + restore (destructive, isolated stack)"
node --test "$SRC"/tests/api/09-backup-restore.test.js
ls "$WORK/backups"/*.tar.gz >/dev/null && pass "backup archives stored in ./backups on the host"
node "$SRC/tests/persistence-check.js" verify && pass "marker still present after restore"

echo "== Upgrade safety: restarting runs migrations without data loss"
dc exec -T app node src/cli.js migrate >/dev/null && pass "migrations idempotent"

if [[ "${KEEP:-0}" != "1" ]]; then dc down -v >/dev/null; rm -rf "$WORK"; echo "== Test stack removed"; fi
echo "ALL STACK TESTS PASSED"
