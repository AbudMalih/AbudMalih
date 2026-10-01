#!/bin/sh
# Renders the in-between frames that double the film to 239 frames.
# With --count 239, even indices 2j land exactly on the existing 120-frame
# set (design frame j*149/119), so only odd indices need rendering.
cd "$(dirname "$0")"
OUT=${OUT:-/tmp/journey2}
mkdir -p $OUT
for cam in ${CAMS:-desktop mobile}; do
  /opt/bl/bin/python render.py --cam $cam --count 239 --frames 1-237:2 --samples ${SAMPLES:-16} \
    --out $OUT/raw/$cam --skip-existing >> $OUT/$cam.log 2>&1
done
