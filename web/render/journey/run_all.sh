#!/bin/sh
# Full render of both compositions (mobile first, even frames before odd
# ones so a usable sequence exists early). Safe to re-run: existing frames
# are skipped.
cd "$(dirname "$0")"
OUT=${OUT:-/tmp/journey}
mkdir -p $OUT
for cam in mobile desktop; do
  /opt/bl/bin/python render.py --cam $cam --count 120 --frames 0-119:2,1-119:2 --samples ${SAMPLES:-16} \
    --out $OUT/raw/$cam --skip-existing >> $OUT/$cam.log 2>&1
done
