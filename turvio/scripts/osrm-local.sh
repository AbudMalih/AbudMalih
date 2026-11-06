#!/usr/bin/env bash
# Local OSRM for development (production: see docs/HOSTING.md).
#   scripts/osrm-local.sh prepare <file.osm.pbf>   real extract, e.g. niedersachsen-latest.osm.pbf (Geofabrik)
#   scripts/osrm-local.sh prepare --synthetic      SYNTHETIC grid (integration tests only – not real road times)
#   scripts/osrm-local.sh start | stop
# Binaries: npm package @project-osrm/osrm (prebuilt for Linux x64; needs libtbb12).
set -euo pipefail
DIR="${TURVIO_OSRM_DIR:-/opt/turvio-osrm}"
VERSION="${OSRM_VERSION:-26.4.1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$DIR"
bin() {
  if [ ! -x "$DIR/bin/osrm-routed" ]; then
    local tmp; tmp=$(mktemp -d)
    (cd "$tmp" && npm init -y >/dev/null && npm install --no-audit --no-fund "@project-osrm/osrm@$VERSION" >/dev/null)
    cp -r "$tmp/node_modules/@project-osrm/osrm/lib/binding_napi_v8" "$DIR/bin"
    cp -r "$tmp/node_modules/@project-osrm/osrm/profiles" "$DIR/profiles"
    rm -rf "$tmp"
  fi
}
case "${1:-}" in
  prepare)
    bin
    if [ "${2:-}" = "--synthetic" ]; then python3 "$ROOT/tools/synthetic_road_grid.py" "$DIR/map.osm"; src="$DIR/map.osm"; else src="$DIR/map.osm.pbf"; cp "$2" "$src"; fi
    "$DIR/bin/osrm-extract" -p "$DIR/profiles/car.lua" "$src"
    "$DIR/bin/osrm-contract" "$DIR/map.osrm"
    echo "prepared $DIR/map.osrm"
    ;;
  start)
    (cd "$DIR" && setsid nohup ./bin/osrm-routed --algorithm ch --max-table-size 1000 --max-viaroute-size 1000 -p "${OSRM_PORT:-5000}" map.osrm >routed.log 2>&1 & echo $! >routed.pid)
    echo "OSRM on http://localhost:${OSRM_PORT:-5000}"
    ;;
  stop) [ -f "$DIR/routed.pid" ] && kill "$(cat "$DIR/routed.pid")" 2>/dev/null; rm -f "$DIR/routed.pid" ;;
  *) sed -n '2,7p' "$0"; exit 1 ;;
esac
