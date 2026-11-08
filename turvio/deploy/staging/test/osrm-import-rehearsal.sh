#!/usr/bin/env bash
# Local rehearsal of the staging graph import with the REPOSITORY's own scripts (import.sh,
# switch.sh, revert.sh, check.sh), unmodified except for the /data path and the OSRM URL.
# Volume layout as on the server: /data/current -> build-…, /data/previous -> build-…
#   TURVIO_GRAPH_PARTS_DIR=<dir with the 9 archive parts> deploy/staging/test/osrm-import-rehearsal.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../osrm" && pwd)"
PARTS="${TURVIO_GRAPH_PARTS_DIR:?set to the directory with turvio-osrm-germany-2026-11-07.tar.gz.part-*}"
HANNOVER="${TURVIO_HANNOVER_GRAPH:-/opt/turvio-osrm}"  # map.osrm.* of Region Hannover + bin/osrm-routed (scripts/osrm-local.sh)
T=$(mktemp -d /opt/turvio-rehearsal.XXXX)
trap 'pkill -f "osrm-routed.*-p 5010" || true' EXIT
export PATH="$HANNOVER/bin:$PATH"
mkdir -p "$T/bin" "$T/data"
for f in import.sh switch.sh revert.sh check.sh; do
  sed -e "s#/data#$T/data#g" -e "s#/opt/osrm/switch.sh#$T/bin/switch.sh#g" "$REPO/$f" > "$T/bin/$f"; chmod +x "$T/bin/$f"
done
step() { printf '\n=== %s\n' "$*"; }
serve() { pkill -f "osrm-routed.*-p 5010" || true; sleep 1; ( cd "$T/data/current" && setsid nohup osrm-routed --algorithm "$(cat ALGORITHM 2>/dev/null || echo ch)" --max-table-size 1000 --max-viaroute-size 1000 -p 5010 map.osrm > "$T/routed.log" 2>&1 & ); local t=0; until curl -s --noproxy '*' -o /dev/null http://127.0.0.1:5010/nearest/v1/driving/9.7409,52.3766; do sleep 1; t=$((t+1)); [ $t -lt 120 ] || { echo "osrm did not start"; return 1; }; done; echo "osrm up after ${t}s, RSS $(ps -o rss= -p "$(pgrep -f 'osrm-routed.*-p 5010')" | awk '{printf "%.1f GB", $1/1048576}')"; }
check() { NO_PROXY='*' no_proxy='*' sh "$T/bin/check.sh" http://127.0.0.1:5010 || true; }

step "1. current graph = Region Hannover (as on staging today)"
mkdir "$T/data/build-20261106T000000Z"
cp -al "$HANNOVER"/map.osrm* "$T/data/build-20261106T000000Z/"
ln -s build-20261106T000000Z "$T/data/current"
serve; check

step "2. checksum of the archive (deploy.sh refuses the import on a mismatch)"
cat "$PARTS"/turvio-osrm-germany-2026-11-07.tar.gz.part-0* | sha256sum | tee "$T/sum"
grep -q '^e227cd8f2b9da8aba44945e1b880d1370fd071bda0b56086e3322cb608aaa986 ' "$T/sum" && echo "checksum OK"

step "3. a graph from another OSRM version is refused and leaves nothing behind"
mkdir "$T/fake" && echo x > "$T/fake/map.osrm.properties" && printf 'OSRM_VERSION=v0.0.1\n' > "$T/fake/META" && echo ch > "$T/fake/ALGORITHM"
if tar -C "$T/fake" -cf - . | "$T/bin/import.sh"; then echo "UNEXPECTED: accepted"; exit 1; else echo "refused as expected"; fi
ls "$T/data"; echo "current -> $(readlink "$T/data/current")"

step "4. import Germany (import.sh: unpack, META/version check, switch)"
time (cat "$PARTS"/turvio-osrm-germany-2026-11-07.tar.gz.part-0* | gzip -dc | "$T/bin/import.sh")
echo "current  -> $(readlink "$T/data/current")"; echo "previous -> $(readlink "$T/data/previous")"; du -sh "$T/data/$(readlink "$T/data/current")"

step "5. serve Germany, routing check (Suhl, Hannover, Kassel, Bremen, Cologne, Suhl -> Hannover)"
serve; check

step "6. rollback: revert.sh -> Hannover again, Germany kept as previous"
"$T/bin/revert.sh"
echo "current  -> $(readlink "$T/data/current")"; echo "previous -> $(readlink "$T/data/previous")"
serve; check

step "7. roll forward again (switch back to the Germany build)"
"$T/bin/switch.sh" "$(readlink "$T/data/previous")"
echo "current  -> $(readlink "$T/data/current")"
serve; check
rm -rf "$T"
echo; echo "REHEARSAL DONE"
