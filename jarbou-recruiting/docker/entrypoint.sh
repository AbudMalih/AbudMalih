#!/bin/sh
# Make sure the persistent NAS folders are writable, then drop root privileges.
set -e
for d in /data/uploads /backups; do
  mkdir -p "$d"
  chown -R node:node "$d" 2>/dev/null || echo "Note: could not change owner of $d (continuing)"
  chmod 750 "$d" 2>/dev/null || true
done
exec su-exec node "$@"
