#!/usr/bin/env bash
# revert.sh: switch /data/current back to the previous graph.
set -euo pipefail
cd /data
prev=$(readlink previous 2>/dev/null || true)
[ -n "$prev" ] && [ -d "$prev" ] || { echo "no previous graph to revert to" >&2; exit 1; }
exec /opt/osrm/switch.sh "$prev"
