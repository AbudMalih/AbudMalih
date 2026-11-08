#!/usr/bin/env bash
# Route-quality gate on real roads: 4 cities x {back to depot, end at last stop} x 80/100 stops.
#   OSRM_URL=http://localhost:5001 bench/run_quality_gate.sh [seeds=1,2]
# Needs an OSRM graph covering Hannover, Kassel, Bremen and Suhl (Germany) and the city address
# file (TURVIO_CITY_ADDRESSES, see bench/hannover.py). Writes docs/benchmarks/<city>[-open-end]-gate-<date>.*
set -euo pipefail
cd "$(dirname "$0")/.."
: "${OSRM_URL:?set OSRM_URL (real road network only)}"
SEEDS="${1:-1,2}"
LABEL="gate-$(date -u +%F)"
OUT=../../docs/benchmarks
files=()
for end in depot open; do
  for city in Hannover Kassel Bremen Suhl; do
    echo "=== $city, end=$end"
    BENCH_CITY=$city BENCH_END=$end BENCH_PICKUPS=0 NO_PROXY='*' no_proxy='*' .venv/bin/python -m bench.hannover \
      --sizes 80,100 --seeds "$SEEDS" --methods import_order,nn_2opt_oropt,vroom,legacy_prod,turvio_prod --out "$OUT" --label "$LABEL" >/dev/null
    suffix=$([ "$end" = open ] && echo "-open-end" || true)
    files+=("$OUT/$(echo "$city" | tr '[:upper:]' '[:lower:]')$suffix-$LABEL.json")
  done
done
.venv/bin/python -m bench.quality_gate "${files[@]}"
