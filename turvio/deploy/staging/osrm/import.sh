#!/usr/bin/env bash
# import.sh: read a prepared graph (tar, optionally gzip/zstd-compressed) from stdin into a
# new build directory and switch to it. The archive must contain map.osrm.* plus META and
# ALGORITHM at its top level (made by prepare-offline.sh). Checksums are verified by deploy.sh.
set -euo pipefail
cd /data
build="build-$(date -u +%Y%m%dT%H%M%SZ)-import"
mkdir "$build"
# Remove the half-unpacked graph on ANY failure (also the explicit refusals below, which an ERR
# trap would not catch).
done_ok=0
trap '[ "$done_ok" = 1 ] || rm -rf "/data/$build"' EXIT
tar -x -C "$build" --no-same-owner --no-same-permissions -f -
[ -f "$build/map.osrm.properties" ] && [ -f "$build/META" ] && [ -f "$build/ALGORITHM" ] || { echo "archive is not a prepared TURVIO OSRM graph" >&2; exit 1; }
grep -qx "OSRM_VERSION=$(osrm-routed --version)" "$build/META" || { echo "graph was built with a different OSRM version: $(grep OSRM_VERSION "$build/META")" >&2; exit 1; }
cat "$build/META"
done_ok=1
/opt/osrm/switch.sh "$build"
