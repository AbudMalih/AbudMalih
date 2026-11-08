"""Route-quality gate over benchmark results (bench/hannover.py JSON output).

    .venv/bin/python -m bench.quality_gate ../../docs/benchmarks/*-gate-*.json

Fails (exit 1) when TURVIO's production setting ("turvio_prod") regresses on real OSRM tours:
  * any late or unplanned stop,
  * more driving than the independent VROOM baseline + 2 % (mean per city/size/end mode),
  * not clearly better than the previous solver (legacy_prod): mean must be ≤ 97 %,
  * less than 50 % saving against the import order,
  * a solve slower than its budget + 1.5 s,
  * a zero-length tour (0 km would mean a missing road matrix, never accepted).
The thresholds are deliberately below the measured margins (docs/ROUTE_OPTIMIZATION.md §4D), so
the gate catches regressions without failing on solver noise.
"""

from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

VS_VROOM = 1.02
VS_LEGACY = 0.97
VS_IMPORT = 0.50


def budget(n: int) -> float:
    return (15 if n > 150 else 10 if n > 60 else 5) + 1.5


def check(files: list[str]) -> list[str]:
    failures: list[str] = []
    for f in files:
        rows = json.loads(Path(f).read_text())
        by = defaultdict(list)
        for r in rows:
            by[(r["size"], r["method"])].append(r)
        for (n, meth), rs in sorted(by.items()):
            if meth != "turvio_prod":
                continue
            tag = f"{Path(f).stem} n={n}"
            mean = statistics.mean(r["drive_s"] for r in rs)
            for r in rs:
                if r["late_stops"] or r["unassigned"]:
                    failures.append(f"{tag} seed={r['seed']}: {r['late_stops']} late, {r['unassigned']} unplanned")
                if r["distance_m"] <= 0:
                    failures.append(f"{tag} seed={r['seed']}: zero distance")
                if r["seconds"] > budget(n):
                    failures.append(f"{tag} seed={r['seed']}: {r['seconds']:.1f} s > budget {budget(n):.1f} s")
            for other, limit in (("vroom", VS_VROOM), ("legacy_prod", VS_LEGACY), ("import_order", VS_IMPORT)):
                if (n, other) not in by:
                    continue
                ref = statistics.mean(r["drive_s"] for r in by[(n, other)])
                ratio = mean / ref
                ok = ratio <= limit
                print(f"{'ok  ' if ok else 'FAIL'} {tag}: turvio/{other} = {ratio:.3f} (limit {limit})")
                if not ok:
                    failures.append(f"{tag}: turvio/{other} drive {ratio:.3f} > {limit}")
    return failures


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fails = check(sys.argv[1:])
    for x in fails:
        print("FAIL", x)
    print("quality gate passed" if not fails else f"quality gate FAILED ({len(fails)})")
    sys.exit(1 if fails else 0)
