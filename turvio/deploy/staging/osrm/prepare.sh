#!/usr/bin/env bash
# Builds an OSRM car graph into /data (the osrm-data volume) and switches /data/current to it.
# Runs inside the osrm image:  deploy.sh --osrm-refresh   (or docker compose … run --rm osrm-prepare)
#
#   OSRM_REGION     hannover (default, BBBike, ~80 MB) | germany (Geofabrik, ~4.5 GB) | custom
#   OSRM_PBF_URL / OSRM_CHECKSUM_URL   only for OSRM_REGION=custom (checksum file: "<md5>  <file>")
#   OSRM_ALGORITHM  ch (default; fastest distance matrices) | mld (lighter preparation)
#   OSRM_THREADS    default 2
#   OSRM_SKIP_RESOURCE_CHECK=true      bypass the RAM/disk preflight (not recommended)
#
# Resource preflight: Germany needs far more memory than a 4 GB server has (OSRM maintainers:
# "Germany should fit into 16 GB"). Prepare it on a bigger machine and use import.sh instead.
# Data: © OpenStreetMap contributors, ODbL. The previous build is kept for revert.sh.
set -euo pipefail
REGION="${OSRM_REGION:-hannover}"
ALGO="${OSRM_ALGORITHM:-ch}"
THREADS="${OSRM_THREADS:-2}"
case "$ALGO" in ch|mld) ;; *) echo "OSRM_ALGORITHM must be ch or mld" >&2; exit 2 ;; esac
case "$REGION" in
  hannover)
    SRC_URL="https://download.bbbike.org/osm/bbbike/Hannover/Hannover.osm.pbf"
    SUM_URL="https://download.bbbike.org/osm/bbbike/Hannover/CHECKSUM.txt"
    NEED_RAM_MB=1200; NEED_DISK_MB=1500 ;;
  germany)
    SRC_URL="https://download.geofabrik.de/europe/germany-latest.osm.pbf"
    SUM_URL="$SRC_URL.md5"
    # Estimates (see docs/MAP_DATA_PLAN.md); replace with measured values after the first run.
    if [ "$ALGO" = ch ]; then NEED_RAM_MB=16000; else NEED_RAM_MB=12000; fi
    NEED_DISK_MB=25000 ;;
  custom)
    SRC_URL="${OSRM_PBF_URL:?set OSRM_PBF_URL}"; SUM_URL="${OSRM_CHECKSUM_URL:?set OSRM_CHECKSUM_URL}"
    NEED_RAM_MB="${OSRM_NEED_RAM_MB:-4000}"; NEED_DISK_MB="${OSRM_NEED_DISK_MB:-10000}" ;;
  *) echo "unknown OSRM_REGION '$REGION' (hannover | germany | custom)" >&2; exit 2 ;;
esac

# ---- preflight: memory (container limit and host) and disk ------------------------------
mem_kb() { awk -v k="$1:" '$1 == k { print $2 }' /proc/meminfo; }
avail_mb=$(( ($(mem_kb MemAvailable) + $(mem_kb SwapFree)) / 1024 ))
limit_mb=$avail_mb
cg=""
if [ -r /sys/fs/cgroup/memory.max ]; then cg=$(cat /sys/fs/cgroup/memory.max)                       # cgroup v2
elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then cg=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes); fi  # v1
if [ -n "$cg" ] && [ "$cg" != max ] && [ "$cg" -lt $(( avail_mb * 1024 * 1024 )) ]; then limit_mb=$(( cg / 1024 / 1024 )); fi
ram_mb=$(( avail_mb < limit_mb ? avail_mb : limit_mb ))
disk_mb=$(df -Pm /data | awk 'NR == 2 { print $4 }')
echo "preflight: region=$REGION algorithm=$ALGO usable RAM ${ram_mb} MB (host avail+swap ${avail_mb}, container limit ${limit_mb}), free disk ${disk_mb} MB; needs ~${NEED_RAM_MB} MB RAM, ~${NEED_DISK_MB} MB disk"
if [ "${OSRM_SKIP_RESOURCE_CHECK:-false}" != true ]; then
  if [ "$ram_mb" -lt "$NEED_RAM_MB" ] || [ "$disk_mb" -lt "$NEED_DISK_MB" ]; then
    echo "REFUSED: not enough resources to prepare '$REGION' here. Prepare it on a machine with" >&2
    echo "  >= ${NEED_RAM_MB} MB RAM and import the result (deploy.sh --osrm-import, see docs/STAGING_DEPLOYMENT.md)." >&2
    exit 3
  fi
fi

cd /data
build="build-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$build"
trap 'rm -rf "/data/$build"' ERR
echo "downloading $SRC_URL"
curl -fSL --retry 3 --max-time 7200 -o "$build/map.osm.pbf" "$SRC_URL"
fname=$(basename "$SRC_URL")
expected=$(curl -fsSL --retry 3 --max-time 60 "$SUM_URL" | awk -v f="$fname" '(NF == 1 || $2 == f || $2 == "*" f) && length($1) == 32 { print $1; exit }')
actual=$(md5sum "$build/map.osm.pbf" | cut -d' ' -f1)
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "checksum mismatch (expected '${expected:-none}', got '$actual')" >&2
  exit 1
fi
echo "checksum ok ($actual)"
/usr/bin/time -v osrm-extract -t "$THREADS" -p /opt/osrm/profiles/car.lua "$build/map.osm.pbf" 2> >(grep -E "Maximum resident|Elapsed" >&2)
if [ "$ALGO" = ch ]; then
  osrm-contract -t "$THREADS" "$build/map.osrm"
else
  osrm-partition -t "$THREADS" "$build/map.osrm"
  osrm-customize -t "$THREADS" "$build/map.osrm"
fi
rm -f "$build/map.osm.pbf"
{
  echo "REGION=$REGION"; echo "ALGORITHM=$ALGO"; echo "SOURCE_URL=$SRC_URL"; echo "SOURCE_MD5=$actual"
  echo "BUILT_AT=$(date -u +%FT%TZ)"; echo "OSRM_VERSION=$(osrm-routed --version)"
} > "$build/META"
echo "$ALGO" > "$build/ALGORITHM"
trap - ERR
/opt/osrm/switch.sh "$build"
echo "done – restart the osrm service to load the new graph"
