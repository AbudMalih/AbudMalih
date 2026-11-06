#!/usr/bin/env bash
# Prepare the Germany routing graph on a machine with enough memory (>= 16 GB for CH,
# >= 12 GB for MLD; e.g. a Mac with Docker Desktop set to >= 16 GB, or a temporary
# Linux server), verify it, and package it for `deploy.sh --osrm-import` on staging.
#
#   deploy/staging/osrm/prepare-offline.sh <output-dir>
#   OSRM_REGION=germany (default) | hannover   OSRM_ALGORITHM=ch (default) | mld   OSRM_THREADS=4
#
# Uses the same image (same OSRM version) as staging, as linux/amd64 (Apple Silicon: via
# Docker Desktop's emulation – slower). Output: osrm-graph.tar.gz + osrm-graph.tar.gz.sha256
set -euo pipefail
OUT="$(mkdir -p "${1:?usage: prepare-offline.sh <output-dir>}" && cd "$1" && pwd)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMG=turvio/osrm:offline VOL=turvio-osrm-offline NAME=turvio-osrm-offline-check
docker build --platform linux/amd64 -f "$ROOT/deploy/docker/osrm.Dockerfile" -t "$IMG" "$ROOT"
docker volume create "$VOL" >/dev/null
docker run --rm --platform linux/amd64 -v "$VOL:/data" \
  -e OSRM_REGION="${OSRM_REGION:-germany}" -e OSRM_ALGORITHM="${OSRM_ALGORITHM:-ch}" -e OSRM_THREADS="${OSRM_THREADS:-4}" \
  "$IMG" /opt/osrm/prepare.sh
echo "verifying the graph (Suhl, Hannover, Kassel, Bremen, Cologne)…"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --platform linux/amd64 -v "$VOL:/data:ro" "$IMG" >/dev/null
for _ in $(seq 1 120); do docker exec "$NAME" curl -fsS -o /dev/null http://127.0.0.1:5000/nearest/v1/driving/9.74,52.37 2>/dev/null && break; sleep 5; done
if ! docker exec "$NAME" /opt/osrm/check.sh; then docker rm -f "$NAME" >/dev/null; echo "graph check FAILED – not packaged" >&2; exit 1; fi
docker rm -f "$NAME" >/dev/null
docker run --rm --platform linux/amd64 -u 0 -v "$VOL:/data:ro" -v "$OUT:/out" --entrypoint sh "$IMG" \
  -c 'cd /data/current && tar -cf - . | gzip -1 > /out/osrm-graph.tar.gz && cat META'
(cd "$OUT" && sha256sum osrm-graph.tar.gz > osrm-graph.tar.gz.sha256 2>/dev/null || shasum -a 256 osrm-graph.tar.gz > osrm-graph.tar.gz.sha256)
ls -lh "$OUT/osrm-graph.tar.gz"; cat "$OUT/osrm-graph.tar.gz.sha256"
echo "Next: scp \"$OUT/osrm-graph.tar.gz\" turviodeploy@<vps>:/opt/turvio/  then on the server:"
echo "      /opt/turvio/bin/deploy --osrm-import /opt/turvio/osrm-graph.tar.gz $(cut -d' ' -f1 "$OUT/osrm-graph.tar.gz.sha256")"
echo "Remove the volume afterwards if not needed: docker volume rm $VOL"
