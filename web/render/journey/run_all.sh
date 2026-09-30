#!/bin/sh
# Full render of both compositions (even frames first so a usable
# sequence exists early), then photographic finishing.
cd "$(dirname "$0")"
OUT=${OUT:-/tmp/journey}
THREADS=2 /opt/bl/bin/python render.py --cam desktop --frames 0-149:2,1-149:2 --samples ${SAMPLES:-20} --out $OUT/raw/desktop --skip-existing > $OUT/desktop.log 2>&1 &
THREADS=2 /opt/bl/bin/python render.py --cam mobile --frames 0-149:2,1-149:2 --samples ${SAMPLES:-20} --out $OUT/raw/mobile --skip-existing > $OUT/mobile.log 2>&1 &
wait
