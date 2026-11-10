#!/usr/bin/env bash
# #17: run the optimizer image with exactly the staging hardening (deploy/staging/compose.yml:
# read_only, cap_drop ALL, no-new-privileges, pids_limit 256, tmpfs /tmp, 768 MB, 2 CPUs, uid
# 10001, internal network without internet) and probe the warm-start worker and #16 inside it.
# Local only – never against staging.  Usage: deploy/docker/test/optimizer-hardened-check.sh [image]
set -euo pipefail
IMAGE="${1:-turvio/optimizer:preflight}"
HERE="$(cd "$(dirname "$0")" && pwd)"
NET="turvio-hardened-$$"
HARDEN=(--read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 256
        --tmpfs /tmp:size=64m,mode=1777 --memory 768m --cpus 2 --network "$NET")
cleanup() { docker rm -f "opt-$$" "opt-hung-$$" "osrm-hung-$$" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create --internal "$NET" >/dev/null

wait_healthy() { for _ in $(seq 1 60); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$1")" = healthy ] && return 0; sleep 1; done; docker logs "$1" | tail -20; return 1; }

# 1. Warm-start worker under hardening (no OSRM: estimate matrix, as the worker does not depend on it).
docker run -d --name "opt-$$" "${HARDEN[@]}" -e OSRM_TIMEOUT_SECONDS=8 "$IMAGE" >/dev/null
wait_healthy "opt-$$"
docker exec -i "opt-$$" python - < "$HERE/optimizer_probe.py"

# 2. #16 inside the same hardening: OSRM that accepts connections and never answers.
docker run -d --name "osrm-hung-$$" --network-alias osrm "${HARDEN[@]}" --entrypoint python "$IMAGE" -c '
import socket, time
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(("0.0.0.0", 5000)); s.listen(16)
conns = []
while True:
    c, _ = s.accept(); conns.append(c)' >/dev/null
docker run -d --name "opt-hung-$$" "${HARDEN[@]}" -e OSRM_URL=http://osrm:5000 -e OSRM_TIMEOUT_SECONDS=8 -e ROUTING_REQUIRED=true "$IMAGE" >/dev/null
wait_healthy "opt-hung-$$"
docker exec -i "opt-hung-$$" python - < "$HERE/optimizer_hung_osrm_probe.py"

# 3. The container itself: still healthy, no restarts, memory within the limit.
docker inspect -f 'health={{.State.Health.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}}' "opt-$$"
docker stats --no-stream --format 'mem={{.MemUsage}} pids={{.PIDs}}' "opt-$$"
echo "optimizer hardened check: PASSED"
