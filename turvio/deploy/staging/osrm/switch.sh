#!/usr/bin/env bash
# switch.sh <build-dir-name>: atomically point /data/current to it, keep the previous one,
# remove older builds.
set -euo pipefail
cd /data
new="$1"
[ -f "$new/map.osrm.properties" ] || { echo "$new is not a complete OSRM graph" >&2; exit 1; }
previous=$(readlink current 2>/dev/null || true)
[ "$previous" = "$new" ] && { echo "already current: $new"; exit 0; }
ln -sfn "$new" current.next && mv -T current.next current
[ -n "$previous" ] && ln -sfn "$previous" previous.next && mv -T previous.next previous
for d in build-*; do
  [ "$d" = "$new" ] || [ "$d" = "$previous" ] || rm -rf "$d"
done
echo "current -> $new (previous: ${previous:-none})"
