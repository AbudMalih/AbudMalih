#!/usr/bin/env bash
# Builds the OSRM car graph for Region Hannover into /data (the osrm-data volume).
# Runs inside the osrm image:  docker compose ... run --rm osrm-prepare
# - downloads the BBBike "Hannover" extract (© OpenStreetMap contributors, ODbL)
# - verifies it against BBBike's CHECKSUM.txt (MD5, fetched over HTTPS)
# - extracts + contracts (CH) into a new directory, then atomically repoints
#   /data/current. The previous build is kept for rollback; older ones are removed.
# Measured locally for Region Hannover (~80 MB PBF): well below 1 GB RAM, ~1 min on 4 vCPU.
set -euo pipefail
SRC_URL="${OSRM_PBF_URL:-https://download.bbbike.org/osm/bbbike/Hannover/Hannover.osm.pbf}"
SUM_URL="${OSRM_CHECKSUM_URL:-https://download.bbbike.org/osm/bbbike/Hannover/CHECKSUM.txt}"
THREADS="${OSRM_THREADS:-2}"
cd /data
build="build-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$build"
trap 'rm -rf "/data/$build"' ERR
echo "downloading $SRC_URL"
curl -fsSL --retry 3 --max-time 900 -o "$build/map.osm.pbf" "$SRC_URL"
expected=$(curl -fsSL --retry 3 --max-time 60 "$SUM_URL" | awk -v f="$(basename "$SRC_URL")" '$2 == f && length($1) == 32 { print $1; exit }')
actual=$(md5sum "$build/map.osm.pbf" | cut -d' ' -f1)
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "checksum mismatch (expected '${expected:-none}', got '$actual')" >&2
  exit 1
fi
echo "checksum ok ($actual)"
osrm-extract -t "$THREADS" -p /opt/osrm/profiles/car.lua "$build/map.osm.pbf"
osrm-contract -t "$THREADS" "$build/map.osrm"
rm -f "$build/map.osm.pbf"
date -u +%FT%TZ > "$build/BUILT_AT"; echo "$actual" > "$build/SOURCE_MD5"
trap - ERR
previous=$(readlink current 2>/dev/null || true)
ln -sfn "$build" current.next && mv -T current.next current
echo "current -> $build (previous: ${previous:-none})"
# Keep the previous build for rollback, remove anything older.
for d in build-*; do
  [ "$d" = "$build" ] || [ "$d" = "$previous" ] || rm -rf "$d"
done
echo "done – restart the osrm service to load the new graph"
