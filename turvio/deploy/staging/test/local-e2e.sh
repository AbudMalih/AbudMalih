#!/usr/bin/env bash
# Local end-to-end rehearsal of the staging deployment (NOT for the server).
# Runs deploy.sh against a throw-away TURVIO_ROOT with:
#   - a bare git "remote" cloned from this repository (commit pinning, branch check)
#   - a local Postgres 17 with the same migrations instead of Supabase (AUTH_PROVIDER=local)
#   - Mailpit as SMTP sink, Caddy with its internal CA instead of Let's Encrypt
#   - the real OSRM preparation (BBBike Region Hannover download + checksum + build)
# Then: seed synthetic pilot data, run e2e/pilot.mjs through Caddy (HTTPS), deploy a
# deliberately broken commit (automatic rollback), and test --rollback/--status.
#
#   deploy/staging/test/local-e2e.sh <commit-sha> [branch]
# Requires Docker (rootful is accepted here), git, node + pnpm workspace installed.
set -Eeuo pipefail
SHA="${1:?commit sha}"
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"
SRC="$(git rev-parse --show-toplevel)"
T="${TURVIO_TEST_ROOT:-/tmp/turvio-deploy-test}"
DEPLOY="$SRC/turvio/deploy/staging/deploy.sh"
export TURVIO_ROOT="$T/root" TURVIO_ALLOW_ROOT_FOR_TESTS=1 TURVIO_ALLOW_ROOTFUL_FOR_TESTS=1 TURVIO_ALLOW_PLACEHOLDERS_FOR_TESTS=1
export DEPLOY_COMPOSE_OVERRIDE="$T/compose.localtest.yml"
PGPW="localtest-$(head -c 9 /dev/urandom | base64 | tr -dc a-zA-Z0-9)"
step() { printf '\n=== %s\n' "$*"; }

step "clean previous test state"
docker compose -p turvio-staging down -v --remove-orphans >/dev/null 2>&1 || true
rm -rf "$T"; mkdir -p "$TURVIO_ROOT"

step "git remote (bare) and server clone"
git clone --quiet --bare --branch "$BRANCH" --single-branch "$SRC" "$T/remote.git"
git clone --quiet --branch "$BRANCH" "$T/remote.git" "$TURVIO_ROOT/repo"

step ".env (test values only) and placeholder CA"
cat > "$TURVIO_ROOT/.env" <<EOF
TURVIO_API_HOST=api.staging.example.invalid
TURVIO_DISPATCH_HOST=dispatch.staging.example.invalid
TURVIO_ADMIN_HOST=admin.staging.example.invalid
ACME_EMAIL=ops@example.invalid
TURVIO_TLS=internal
SUPABASE_URL=https://unused.supabase.invalid
SUPABASE_PUBLISHABLE_KEY=sb_publishable_unused
SUPABASE_SECRET_KEY=sb_secret_unused
DATABASE_URL=postgres://turvio_service:$PGPW@db:5432/turvio
SMTP_URL=smtp://mailpit:1025
MAIL_FROM="TURVIO Test <no-reply@example.invalid>"
RATE_LIMIT_PER_MINUTE=5000
DEPLOY_BRANCH=$BRANCH
EOF
chmod 600 "$TURVIO_ROOT/.env"
echo "not used in the local test" > "$TURVIO_ROOT/supabase-ca.crt"

step "test-only compose override"
mkdir -p "$T/initdb"
cat > "$T/initdb/10-turvio.sh" <<EOF
#!/bin/bash
set -e
S=/turvio-sql
psql -v ON_ERROR_STOP=1 -U postgres -d turvio -q -f \$S/local/00_supabase_stubs.sql
for f in \$(ls \$S/migrations/*.sql | sort); do psql -v ON_ERROR_STOP=1 -U postgres -d turvio -q -f "\$f"; done
psql -v ON_ERROR_STOP=1 -U postgres -d turvio -q -f \$S/local/10_local_auth.sql -f \$S/local/20_local_service_role.sql
psql -v ON_ERROR_STOP=1 -U postgres -d turvio -q -c "alter role turvio_service password '$PGPW'"
EOF
chmod 755 "$T/initdb/10-turvio.sh"
PROXY_ENV=""
if [ -n "${HTTPS_PROXY:-}" ] && [ -f /root/.ccr/ca-bundle.crt ]; then
  # Sandbox only: the download in osrm-prepare goes through the local TLS-inspecting proxy.
  PROXY_ENV="    network_mode: host
    networks: !reset []
    environment: { HTTPS_PROXY: \"$HTTPS_PROXY\", CURL_CA_BUNDLE: /etc/proxy-ca.crt }
    volumes: [ \"osrm-data:/data\", \"/root/.ccr/ca-bundle.crt:/etc/proxy-ca.crt:ro\" ]"
fi
cat > "$DEPLOY_COMPOSE_OVERRIDE" <<EOF
services:
  db:
    image: postgres:17
    environment: { POSTGRES_PASSWORD: "$PGPW", POSTGRES_DB: turvio }
    volumes:
      - $T/initdb:/docker-entrypoint-initdb.d:ro
      - $TURVIO_ROOT/repo/turvio/supabase:/turvio-sql:ro
    ports: ["127.0.0.1:55432:5432"]
    networks: [edge]
    healthcheck: { test: ["CMD", "pg_isready", "-U", "postgres", "-d", "turvio"], interval: 3s, retries: 40 }
  mailpit:
    image: axllent/mailpit:v1.27
    ports: ["127.0.0.1:58025:8025"]
    networks: [edge]
  api:
    environment:
      AUTH_PROVIDER: local
      JWT_SECRET: "local-e2e-$(head -c 24 /dev/urandom | base64 | tr -dc a-zA-Z0-9)-local-e2e"
      DATABASE_SSL: "false"
      PROOF_STORAGE: local
      PROOF_STORAGE_DIR: /tmp/proofs
    depends_on:
      db: { condition: service_healthy }
  osrm-prepare:
$PROXY_ENV
EOF

# Sandbox builds need the local proxy (host network + its CA as the optional build secret);
# compose cannot pass those, so the images are built here and tagged for the commits under test.
prebuild() { # prebuild <tag>: build all five images from the exported tree of $SHA
  local ctx="$T/ctx"
  if [ ! -d "$ctx" ]; then mkdir -p "$ctx" && git -C "$TURVIO_ROOT/repo" archive "$SHA" turvio | tar -x -C "$ctx"; fi
  local b=(docker build -q)
  if [ -n "${HTTPS_PROXY:-}" ] && [ -f /root/.ccr/ca-bundle.crt ]; then
    b+=(--network host --build-arg "HTTPS_PROXY=$HTTPS_PROXY" --build-arg "HTTP_PROXY=$HTTPS_PROXY" --secret "id=build_ca,src=/root/.ccr/ca-bundle.crt")
  fi
  "${b[@]}" -f "$ctx/turvio/deploy/docker/api.Dockerfile" -t "turvio/api:$1" "$ctx/turvio" >/dev/null
  "${b[@]}" -f "$ctx/turvio/deploy/docker/optimizer.Dockerfile" -t "turvio/optimizer:$1" "$ctx/turvio" >/dev/null
  "${b[@]}" -f "$ctx/turvio/deploy/docker/osrm.Dockerfile" -t "turvio/osrm:$1" "$ctx/turvio" >/dev/null
  "${b[@]}" --build-arg APP=dispatch -f "$ctx/turvio/deploy/docker/web.Dockerfile" -t "turvio/dispatch:$1" "$ctx/turvio" >/dev/null
  "${b[@]}" --build-arg APP=admin -f "$ctx/turvio/deploy/docker/web.Dockerfile" -t "turvio/admin:$1" "$ctx/turvio" >/dev/null
}
retag() { for s in api optimizer osrm dispatch admin; do docker tag "turvio/$s:$SHA" "turvio/$s:$1"; done; }

step "build images for $SHA"
prebuild "$SHA"

step "deploy $SHA"
"$DEPLOY" "$SHA"
"$DEPLOY" --status

step "seed synthetic pilot data"
(cd "$SRC/turvio/apps/api" && SEED_DATABASE_URL="postgres://postgres:$PGPW@127.0.0.1:55432/turvio" SEED_PILOT=true SEED_DEMO_DAY=false npx tsx src/scripts/seed.ts | tail -3)

step "pilot through Caddy (HTTPS, internal CA)"
docker compose -p turvio-staging cp caddy:/data/caddy/pki/authorities/local/root.crt "$T/caddy-root.crt" >/dev/null
grep -q "api.staging.example.invalid" /etc/hosts || echo "127.0.0.1 api.staging.example.invalid dispatch.staging.example.invalid admin.staging.example.invalid" >> /etc/hosts
(cd "$SRC/turvio" && NODE_EXTRA_CA_CERTS="$T/caddy-root.crt" API_URL=https://api.staging.example.invalid PILOT_REPORT="$T/pilot.json" node e2e/pilot.mjs | tail -12)

step "broken release -> automatic rollback"
git clone --quiet --branch "$BRANCH" "$T/remote.git" "$T/work"
(cd "$T/work" && sed -i 's/      REQUIRE_ADMIN_MFA: "true"/      REQUIRE_ADMIN_MFA: "true"\n      MAILER: outbox/' turvio/deploy/staging/compose.yml \
  && git -c user.email=test@example.invalid -c user.name=test commit -qam "test: broken release (API refuses MAILER=outbox)" && git push -q origin "$BRANCH")
BROKEN="$(git -C "$T/work" rev-parse HEAD)"
retag "$BROKEN"   # images are identical: only compose.yml changed
if "$DEPLOY" "$BROKEN"; then echo "FAIL: broken release was reported healthy"; exit 1; fi
[ "$(cat "$TURVIO_ROOT/state/current")" = "$SHA" ] || { echo "FAIL: current is not $SHA after rollback"; exit 1; }
curl -sk --resolve api.staging.example.invalid:443:127.0.0.1 https://api.staging.example.invalid/health

step "second good release, then manual --rollback"
(cd "$T/work" && git -c user.email=test@example.invalid -c user.name=test revert --no-edit -q HEAD && git push -q origin "$BRANCH")
GOOD2="$(git -C "$T/work" rev-parse HEAD)"
retag "$GOOD2"
"$DEPLOY" "$GOOD2"
[ "$(cat "$TURVIO_ROOT/state/previous")" = "$SHA" ] || { echo "FAIL: previous should be $SHA"; exit 1; }
"$DEPLOY" --rollback
[ "$(cat "$TURVIO_ROOT/state/current")" = "$SHA" ] || { echo "FAIL: --rollback did not return to $SHA"; exit 1; }
echo "manual rollback ok"

step "refusals"
"$DEPLOY" 0123 && { echo "FAIL: short sha accepted"; exit 1; } || echo "short sha refused"
"$DEPLOY" ffffffffffffffffffffffffffffffffffffffff >/dev/null 2>&1 && { echo "FAIL: unknown commit accepted"; exit 1; } || echo "unknown commit refused"
chmod 644 "$TURVIO_ROOT/.env"; "$DEPLOY" --status >/dev/null 2>&1 && { echo "FAIL: .env mode 644 accepted"; exit 1; } || echo ".env with mode 644 refused"; chmod 600 "$TURVIO_ROOT/.env"

echo; echo "LOCAL E2E PASSED"
