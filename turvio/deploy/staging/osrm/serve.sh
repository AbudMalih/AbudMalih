#!/bin/sh
# Container entrypoint: serve /data/current with the algorithm it was prepared for.
# OSRM_MMAP=true memory-maps the graph instead of loading it into RAM (for servers whose
# RAM is smaller than the graph, e.g. Germany on 4 GB; slower on cold caches).
set -e
D=/data/current
if [ ! -f "$D/map.osrm.properties" ]; then echo "no routing graph in $D – run: deploy.sh --osrm-refresh or --osrm-import" >&2; exit 1; fi
ALGO=$(cat "$D/ALGORITHM" 2>/dev/null || echo ch)
[ -f "$D/META" ] && sed 's/^/graph: /' "$D/META"
if [ "${OSRM_MMAP:-false}" = true ]; then
  exec osrm-routed --algorithm "$ALGO" --mmap --max-table-size 1000 --max-viaroute-size 1000 --port 5000 "$D/map.osrm"
fi
exec osrm-routed --algorithm "$ALGO" --max-table-size 1000 --max-viaroute-size 1000 --port 5000 "$D/map.osrm"
