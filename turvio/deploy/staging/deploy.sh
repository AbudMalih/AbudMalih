#!/usr/bin/env bash
# TURVIO staging deployment (rootless Docker, commit-pinned, automatic rollback).
#
#   deploy.sh <40-character commit SHA>   build + start exactly this commit
#   deploy.sh --build <commit SHA>        only build (and tag) the images of that commit; nothing is
#                                         started or stopped – the following deploy.sh <SHA> reuses them
#   deploy.sh --rollback                  switch back to the previous release
#   deploy.sh --status                    show releases and container state
#   deploy.sh --osrm-refresh              (re)build the routing graph (OSRM_REGION in .env)
#   deploy.sh --osrm-import FILE SHA256   load a graph prepared on a bigger machine (Germany)
#   deploy.sh --osrm-check                real road routes in Suhl, Hannover, Kassel, Bremen, Cologne
#   deploy.sh --osrm-revert               switch back to the previous routing graph
#   deploy.sh --server-check              RAM, swap, disk and routing-graph information
#   deploy.sh --geodb-refresh             load OpenStreetMap addresses (GEODB_REGIONS) into the geocoder database
#   deploy.sh --geodb-status              active address data (version, rows, size)
#
# Layout under TURVIO_ROOT (default /opt/turvio), owned by the deploy user:
#   .env               secrets (mode 600) – see deploy/staging/.env.example
#   supabase-ca.crt    Supabase root CA (public certificate)
#   repo/              git clone over a READ-ONLY deploy key (fetch only)
#   releases/<sha>/    exported tree of that commit (turvio/ only)
#   state/current, state/previous, state/deploy.log
#
# Never run as root. Database migrations are NOT run here – they go through the
# reviewed Supabase migration process (docs/STAGING_MIGRATION_PLAN.md).
set -Eeuo pipefail
umask 077

ROOT="${TURVIO_ROOT:-/opt/turvio}"
ENV_FILE="$ROOT/.env"
REPO="$ROOT/repo"
RELEASES="$ROOT/releases"
STATE="$ROOT/state"
PROJECT="turvio-staging"
WAIT_TIMEOUT="${DEPLOY_WAIT_TIMEOUT:-300}"
SERVICES=(api optimizer osrm geodb dispatch admin)

# Non-interactive SSH sessions (ssh host deploy …) may lack the rootless Docker variables.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -z "${DOCKER_HOST:-}" ] && [ -S "$XDG_RUNTIME_DIR/docker.sock" ]; then
  export DOCKER_HOST="unix://$XDG_RUNTIME_DIR/docker.sock"
fi

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$STATE/deploy.log" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ---------------------------------------------------------------- preconditions
preflight() {
  mkdir -p "$RELEASES" "$STATE"
  [ "$(id -u)" -ne 0 ] || [ "${TURVIO_ALLOW_ROOT_FOR_TESTS:-}" = "1" ] || die "do not run as root – use the deploy user with rootless Docker"
  command -v docker >/dev/null || die "docker CLI not found"
  docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"
  if ! docker info --format '{{join .SecurityOptions " "}}' 2>/dev/null | grep -q rootless; then
    [ "${TURVIO_ALLOW_ROOTFUL_FOR_TESTS:-}" = "1" ] || die "Docker is not running in rootless mode for this user (see runbook step 2)"
    log "WARNING: rootful Docker allowed for a local test"
  fi
  [ -f "$ENV_FILE" ] || die "$ENV_FILE missing (copy deploy/staging/.env.example)"
  [ "$(stat -c %a "$ENV_FILE")" = "600" ] || die "$ENV_FILE must have mode 600"
  [ "$(stat -c %u "$ENV_FILE")" = "$(id -u)" ] || die "$ENV_FILE must be owned by $(id -un)"
  if grep -qE 'CHANGE_ME|example\.invalid' "$ENV_FILE" && [ "${TURVIO_ALLOW_PLACEHOLDERS_FOR_TESTS:-}" != "1" ]; then
    die "$ENV_FILE still contains placeholders (CHANGE_ME / example.invalid)"
  fi
  [ -f "$ROOT/supabase-ca.crt" ] || die "$ROOT/supabase-ca.crt missing (runbook step 5)"
  # Read inside the API container by its non-root user: must be world-readable (it is a public certificate).
  [ "$(( 0$(stat -c %a "$ROOT/supabase-ca.crt") & 4 ))" -ne 0 ] || die "$ROOT/supabase-ca.crt must be readable by others: chmod 644 $ROOT/supabase-ca.crt"
  DEPLOY_BRANCH="$(sed -n 's/^DEPLOY_BRANCH=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' ')"
  [ -n "$DEPLOY_BRANCH" ] || die "DEPLOY_BRANCH is not set in $ENV_FILE"
  [[ "$DEPLOY_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "DEPLOY_BRANCH has unexpected characters"
}

compose() { # compose <release-sha> <args…>
  local sha="$1"; shift
  local files=(-f "$RELEASES/$sha/turvio/deploy/staging/compose.yml")
  # Local end-to-end tests only (deploy/staging/test): an extra compose file outside the release.
  [ -n "${DEPLOY_COMPOSE_OVERRIDE:-}" ] && files+=(-f "$DEPLOY_COMPOSE_OVERRIDE")
  TURVIO_RELEASE="$sha" TURVIO_ROOT="$ROOT" COMPOSE_BAKE=false docker compose -p "$PROJECT" \
    --env-file "$ENV_FILE" "${files[@]}" "$@"
}

value_of() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 | tr -d '"'"'"; }

# ---------------------------------------------------------------- release export
fetch_and_export() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "give the full 40-character commit SHA (got '$sha')"
  [ -d "$REPO/.git" ] || die "$REPO is not a git clone (runbook step 4)"
  log "fetching origin/$DEPLOY_BRANCH"
  git -C "$REPO" fetch --quiet --prune origin "+refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
  git -C "$REPO" cat-file -e "$sha^{commit}" 2>/dev/null || die "commit $sha not found on the remote"
  git -C "$REPO" merge-base --is-ancestor "$sha" "origin/$DEPLOY_BRANCH" || die "commit $sha is not on origin/$DEPLOY_BRANCH"
  if [ "${DEPLOY_REQUIRE_SIGNED:-false}" = "true" ]; then
    git -C "$REPO" verify-commit "$sha" >/dev/null 2>&1 || die "commit $sha has no valid signature"
  fi
  if [ -d "$RELEASES/$sha" ]; then log "release $sha already exported"; return; fi
  local tmp="$RELEASES/.tmp-$sha"
  rm -rf "$tmp"; mkdir -p "$tmp"
  # Only the TURVIO project – the rest of the repository (e.g. the JARBOU website) is not exported.
  # --no-same-permissions: modes follow the umask (077) for every user, so images must set
  # their own runtime permissions explicitly (as on the server).
  git -C "$REPO" archive --format=tar "$sha" turvio | tar --no-same-permissions -x -C "$tmp"
  [ -f "$tmp/turvio/deploy/staging/compose.yml" ] || { rm -rf "$tmp"; die "commit $sha has no deploy/staging/compose.yml"; }
  echo "$sha" > "$tmp/turvio/RELEASE"
  mv "$tmp" "$RELEASES/$sha"
  chmod -R go-w "$RELEASES/$sha"
  log "exported $sha"
}

# ---------------------------------------------------------------- health
smoke() { # end-to-end through Caddy (TLS) on this host, independent of public DNS
  local host path code _
  local curl_tls=()
  [ "$(value_of TURVIO_TLS)" = "internal" ] && curl_tls=(-k)
  for pair in "TURVIO_API_HOST:/health" "TURVIO_DISPATCH_HOST:/login" "TURVIO_ADMIN_HOST:/login"; do
    host="$(value_of "${pair%%:*}")"; path="${pair#*:}"
    for _ in $(seq 1 20); do
      # --noproxy: always talk to the local Caddy directly, even if a proxy is configured.
      code=$(curl "${curl_tls[@]}" --noproxy '*' -s -o /dev/null -w '%{http_code}' --max-time 10 \
        --resolve "$host:443:127.0.0.1" "https://$host$path" || true)
      [[ "$code" =~ ^(200|30[0-9])$ ]] && break
      sleep 6
    done
    [[ "$code" =~ ^(200|30[0-9])$ ]] || { log "smoke check failed: https://$host$path -> $code"; return 1; }
    log "smoke ok: https://$host$path -> $code"
  done
}

start_release() { # start_release <sha>: up + wait for healthchecks + smoke test
  local sha="$1"
  compose "$sha" up -d --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" && smoke
}

osrm_ready() {
  local sha="$1"
  compose "$sha" run --rm --no-deps --entrypoint test osrm-prepare -e /data/current/map.osrm.properties >/dev/null 2>&1
}

# ---------------------------------------------------------------- commands
build_images() { # build_images <sha>: export + validate + build; the running release is not touched
  local sha="$1" s
  fetch_and_export "$sha"
  # Validate before touching anything: the running release stays untouched on errors.
  compose "$sha" config --quiet || die "compose configuration of $sha is invalid – nothing changed"
  log "building $sha (one service at a time – 4 GB RAM)"
  for s in "${SERVICES[@]}"; do
    # Tags are commit-pinned: an existing image for this exact commit is reused (fast rollback/redeploy).
    if docker image inspect "turvio/$s:$sha" >/dev/null 2>&1 && [ "${DEPLOY_REBUILD:-false}" != "true" ]; then
      log "image turvio/$s:$sha exists – not rebuilding"
    else
      compose "$sha" build "$s"
    fi
  done
}

build_only() {
  build_images "$1"
  log "BUILT $1 – nothing started; deploy with: deploy.sh $1"
}

deploy() {
  local sha="$1" current
  current="$(cat "$STATE/current" 2>/dev/null || true)"
  [ "$sha" != "$current" ] || log "re-deploying the current release $sha"
  build_images "$sha"
  if ! osrm_ready "$sha"; then
    log "no routing graph yet – preparing Region Hannover (one-off, a few minutes)"
    compose "$sha" run --rm osrm-prepare
  fi
  log "starting $sha"
  if start_release "$sha"; then
    if [ -n "$current" ] && [ "$current" != "$sha" ]; then echo "$current" > "$STATE/previous"; fi
    echo "$sha" > "$STATE/current"
    log "DEPLOYED $sha"
    osrm_check "$sha" || log "WARNING: the routing graph does not cover all required cities – optimizations there fail with routing_out_of_coverage (deploy.sh --osrm-import / --osrm-refresh)"
    prune
    return 0
  fi
  log "release $sha is unhealthy"
  compose "$sha" ps >&2 || true
  compose "$sha" logs --tail 80 >&2 || true
  if [ -n "$current" ] && [ "$current" != "$sha" ]; then
    log "ROLLING BACK to $current"
    start_release "$current" || die "rollback to $current is unhealthy as well – manual intervention needed"
    log "rolled back to $current"
  else
    log "no previous release – stopping the failed one"
    compose "$sha" stop || true
  fi
  exit 1
}

rollback() {
  local current previous
  current="$(cat "$STATE/current" 2>/dev/null || true)"
  previous="$(cat "$STATE/previous" 2>/dev/null || true)"
  [ -n "$previous" ] || die "no previous release recorded"
  [ -d "$RELEASES/$previous" ] || die "release directory for $previous is gone"
  log "rolling back $current -> $previous"
  start_release "$previous" || die "previous release $previous is unhealthy"
  echo "$previous" > "$STATE/current"; echo "$current" > "$STATE/previous"
  log "ROLLED BACK to $previous"
}

prune() { # keep the current and previous releases (directories + images)
  local keep=("$(cat "$STATE/current" 2>/dev/null || true)" "$(cat "$STATE/previous" 2>/dev/null || true)")
  local d sha
  for d in "$RELEASES"/*/; do
    sha="$(basename "$d")"
    [[ " ${keep[*]} " == *" $sha "* ]] && continue
    rm -rf "$d"; log "removed release dir $sha"
  done
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^turvio/(api|optimizer|osrm|geodb|dispatch|admin):[0-9a-f]{40}$' | while read -r img; do
    [[ " ${keep[*]} " == *" ${img##*:} "* ]] || docker image rm "$img" >/dev/null 2>&1 || true
  done
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
}

status() {
  echo "current:  $(cat "$STATE/current" 2>/dev/null || echo none)"
  echo "previous: $(cat "$STATE/previous" 2>/dev/null || echo none)"
  local cur; cur="$(cat "$STATE/current" 2>/dev/null || true)"
  [ -n "$cur" ] && compose "$cur" ps
}

current_release() {
  local cur; cur="$(cat "$STATE/current" 2>/dev/null || true)"
  [ -n "$cur" ] || die "deploy a release first"
  echo "$cur"
}

osrm_restart() { compose "$1" up -d --no-deps --force-recreate --wait --wait-timeout "$WAIT_TIMEOUT" osrm; }

osrm_check() { # osrm_check <release>: real road routes for the required cities
  compose "$1" exec -T osrm /opt/osrm/check.sh
}

# After a new graph: verify it; if the required cities are not covered, go back to the previous graph.
verify_new_graph() {
  local cur="$1"
  if osrm_restart "$cur" && osrm_check "$cur"; then log "routing graph active and verified"; return 0; fi
  if [ "${OSRM_CHECK_REQUIRED:-$(value_of OSRM_CHECK_REQUIRED)}" = "false" ]; then
    log "WARNING: routing check failed, kept anyway (OSRM_CHECK_REQUIRED=false)"; return 0
  fi
  log "routing check failed – reverting to the previous graph"
  compose "$cur" run --rm --no-deps --entrypoint /opt/osrm/revert.sh osrm-prepare && osrm_restart "$cur" || true
  die "new routing graph rejected (see check output above)"
}

osrm_refresh() {
  local cur; cur="$(current_release)"
  compose "$cur" run --rm osrm-prepare || die "routing graph preparation failed or was refused (see preflight above)"
  verify_new_graph "$cur"
}

osrm_import() { # osrm_import <file> <sha256>
  local cur file="$1" sum="$2"; cur="$(current_release)"
  [[ "$sum" =~ ^[0-9a-f]{64}$ ]] || die "give the SHA-256 of the archive (64 hex characters)"
  [ -f "$file" ] || die "$file not found"
  log "verifying $file"
  echo "$sum  $file" | sha256sum -c --quiet - || die "SHA-256 mismatch – archive not imported"
  local cat_cmd=(cat "$file")
  case "$file" in *.zst) cat_cmd=(zstd -dc "$file") ;; *.gz) cat_cmd=(gzip -dc "$file") ;; esac
  "${cat_cmd[@]}" | compose "$cur" run --rm -T --no-deps --entrypoint /opt/osrm/import.sh osrm-prepare || die "import failed"
  verify_new_graph "$cur"
}

osrm_revert() {
  local cur; cur="$(current_release)"
  compose "$cur" run --rm --no-deps --entrypoint /opt/osrm/revert.sh osrm-prepare || die "revert failed"
  osrm_restart "$cur"
  log "routing graph reverted"
}

geodb_refresh() {
  local cur; cur="$(current_release)"
  log "loading addresses into geodb (GEODB_REGIONS; download + import, ~10-30 min)"
  compose "$cur" run --rm geodb-prepare | tee -a "$STATE/deploy.log" || die "address import failed or was refused – the previous address data stays active"
  log "address import finished – set GEOCODER=postgres and ADDRESS_DATA_VERSION (printed above) in $ENV_FILE, then redeploy the current release"
}

geodb_status() {
  local cur; cur="$(current_release)"
  compose "$cur" exec -T geodb psql -U postgres -d geo -XAt -c "select version, regions, rows, imported_at from geo.meta order by imported_at desc limit 3" \
    -c "select pg_size_pretty(pg_database_size('geo'))" || die "geodb is not running"
}

server_check() {
  echo "== host"; free -m; nproc | sed 's/^/vCPUs: /'
  echo "== disk (Docker data: $(docker info --format '{{.DockerRootDir}}'))"; df -h "$(docker info --format '{{.DockerRootDir}}')" "$ROOT"
  local cur; cur="$(cat "$STATE/current" 2>/dev/null || true)"
  if [ -n "$cur" ]; then
    echo "== routing graph"
    compose "$cur" run --rm --no-deps --entrypoint sh osrm-prepare -c 'cat /data/current/META 2>/dev/null || echo "no META (prepared before this version)"; du -sh /data/current/ 2>/dev/null; readlink /data/current; readlink /data/previous || true'
    echo "== container memory"; docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' | grep "^$PROJECT-" || true
  fi
  echo "Germany (estimates, docs/MAP_DATA_PLAN.md): prepare >= 16 GB RAM (CH) / 12 GB (MLD), ~25 GB free disk;"
  echo "serve: graph files ~6-10 GB on disk; with OSRM_MMAP=true RAM use stays small."
}

main() {
  [ $# -ge 1 ] || { sed -n '3,17p' "$0"; exit 2; }
  preflight
  exec 9>"$STATE/deploy.lock"
  flock -n 9 || die "another deployment is running"
  case "$1" in
    --build) [ $# -eq 2 ] || die "usage: deploy.sh --build <commit-sha>"; build_only "$2" ;;
    --rollback) rollback ;;
    --status) status ;;
    --osrm-refresh) osrm_refresh ;;
    --osrm-import) [ $# -eq 3 ] || die "usage: --osrm-import FILE SHA256"; osrm_import "$2" "$3" ;;
    --osrm-check) osrm_check "$(current_release)" ;;
    --osrm-revert) osrm_revert ;;
    --server-check) server_check ;;
    --geodb-refresh) geodb_refresh ;;
    --geodb-status) geodb_status ;;
    -*) die "unknown option $1" ;;
    *) [ $# -eq 1 ] || die "usage: deploy.sh <commit-sha>"; deploy "$1" ;;
  esac
}

main "$@"
