"""Route-quality benchmark on real Hannover addresses and the real OSRM road network.

  OSRM_URL=http://localhost:5000 .venv/bin/python -m bench.hannover [--sizes 10,25,50,80,100,150,200] [--out ../../docs/benchmarks]

Data: public OpenStreetMap addresses (© OpenStreetMap contributors, ODbL) from
tools/osm_addresses.py (default /opt/turvio-osm/hannover-addresses.csv). Recipients are not
modelled; only positions, time windows, service times and stop types.

Every method is scored by the SAME evaluator on the SAME OSRM duration/distance matrix:
drive time, distance, arrival simulation with service time and waiting, deadline / window
violations, and "backtracking" (re-entering a postcode or street that was already left).
Nothing here is estimated: if OSRM is unavailable the benchmark stops.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from turvio_optimizer.matrix import Matrix, osrm_matrix
from turvio_optimizer.models import GeoPoint, OptimizeRequest, Stop, TimeWindow, Vehicle

ADDRESSES = os.environ.get("TURVIO_ADDRESSES", "/opt/turvio-osm/hannover-addresses.csv")
# Courier delivery districts (List, Vahrenwald, Oststadt, Groß-Buchholz, Bothfeld …); larger
# tours add neighbouring districts, as a real courier area would.
AREAS = [
    ["30161", "30163", "30165", "30177"],
    ["30161", "30163", "30165", "30177", "30655", "30657"],
    ["30161", "30163", "30165", "30177", "30655", "30657", "30159", "30175", "30171"],
]
# Depot: a position in the Hannover-Lahe commercial area (illustrative, not a real company site).
DEPOT = GeoPoint(lat=52.4117, lng=9.8296)
SHIFT_START = 8 * 60  # 08:00
SERVICE_BASE_S = 90
SERVICE_PER_EXTRA_PARCEL_S = 30


@dataclass
class BStop:
    id: str
    street: str
    house: str
    postcode: str
    lat: float
    lng: float
    kind: str = "delivery"  # delivery | pickup
    parcels: int = 1
    tw: tuple[int, int] | None = None  # minutes since midnight
    priority: bool = False

    @property
    def service_s(self) -> int:
        return SERVICE_BASE_S + SERVICE_PER_EXTRA_PARCEL_S * (self.parcels - 1)


def load_addresses() -> list[dict]:
    with open(ADDRESSES, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f, delimiter=";")]


def make_tour(rows: list[dict], n: int, seed: int) -> list[BStop]:
    """n stops with realistic structure: same-building groups, express deadlines, pickups."""
    rnd = random.Random(seed)
    area = AREAS[0] if n <= 80 else AREAS[1] if n <= 120 else AREAS[2]
    pool = [r for r in rows if r["postcode"] in area]
    stops: list[BStop] = []
    used: set[tuple[str, str]] = set()
    while len(stops) < n:
        r = rnd.choice(pool)
        key = (r["street"], r["house_number"])
        if key in used:
            continue
        used.add(key)
        base = BStop(f"s{len(stops)}", r["street"], r["house_number"], r["postcode"], float(r["lat"]), float(r["lng"]))
        base.parcels = 1 + (rnd.random() < 0.15) + (rnd.random() < 0.05)
        stops.append(base)
        # ~6 %: a second recipient in the same building (separate stop, identical position).
        if len(stops) < n and rnd.random() < 0.06:
            stops.append(BStop(f"s{len(stops)}", base.street, base.house, base.postcode, base.lat, base.lng))
    # Express (~10 %): deliver by 10:30, or by 12:00 (half of them).
    for s in rnd.sample(stops, max(1, n // 10)):
        s.tw = (SHIFT_START, 10 * 60 + 30 if rnd.random() < 0.5 else 12 * 60)
        s.priority = True
    # Business pickups (~4 %, at least 1 from 25 stops): window 14:00–17:00.
    free = [s for s in stops if s.tw is None]
    for s in rnd.sample(free, max(1 if n >= 25 else 0, n // 25)):
        s.kind, s.tw = "pickup", (14 * 60, 17 * 60)
    rnd.shuffle(stops)  # imported manifest order
    return stops


# ---------------------------------------------------------------- evaluation


@dataclass
class Eval:
    drive_s: int
    distance_m: int
    finish_minute: float
    late_stops: int
    late_minutes: float
    wait_minutes: float
    postcode_reentries: int
    street_reentries: int
    split_buildings: int
    served: int
    unassigned: int


def evaluate(order: list[int], stops: list[BStop], m: Matrix, unassigned: int = 0) -> Eval:
    """order: indices into stops. Node 0 = depot (start and end)."""
    dur, dist = m.durations_s, m.distances_m
    t = SHIFT_START * 60
    prev = 0
    drive = d = late = 0
    late_min = wait = 0.0
    for i in order:
        node = i + 1
        drive += dur[prev][node]
        d += dist[prev][node]
        t += dur[prev][node]
        s = stops[i]
        if s.tw:
            if t < s.tw[0] * 60:
                wait += s.tw[0] * 60 - t
                t = s.tw[0] * 60
            if t > s.tw[1] * 60:
                late += 1
                late_min += (t - s.tw[1] * 60) / 60
        t += s.service_s
        prev = node
    drive += dur[prev][0]
    d += dist[prev][0]
    t += dur[prev][0]

    def reentries(key) -> int:
        seen, cur, count = set(), None, 0
        for i in order:
            k = key(stops[i])
            if k != cur:
                if k in seen:
                    count += 1
                seen.add(k)
                cur = k
        return count

    pos = {i: p for p, i in enumerate(order)}
    groups: dict[tuple, list[int]] = {}
    for i, s in enumerate(stops):
        if i in pos:
            groups.setdefault((s.lat, s.lng), []).append(pos[i])
    split = sum(1 for g in groups.values() if len(g) > 1 and max(g) - min(g) != len(g) - 1)
    return Eval(
        drive_s=drive,
        distance_m=d,
        finish_minute=t / 60,
        late_stops=late,
        late_minutes=round(late_min, 1),
        wait_minutes=round(wait / 60, 1),
        postcode_reentries=reentries(lambda s: s.postcode),
        street_reentries=reentries(lambda s: (s.postcode, s.street)),
        split_buildings=split,
        served=len(order),
        unassigned=unassigned,
    )


# ---------------------------------------------------------------- baselines


def nearest_neighbour(m: Matrix, n: int) -> list[int]:
    dur = m.durations_s
    left, cur, out = set(range(1, n + 1)), 0, []
    while left:
        nxt = min(left, key=lambda j: dur[cur][j])
        out.append(nxt - 1)
        left.remove(nxt)
        cur = nxt
    return out


def local_search(order: list[int], m: Matrix, max_seconds: float = 30.0) -> list[int]:
    """2-opt + or-opt (segments of 1–3) on drive time, first improvement, asymmetric-aware."""
    dur = m.durations_s
    route = [0] + [i + 1 for i in order] + [0]

    def cost(r):
        return sum(dur[r[k]][r[k + 1]] for k in range(len(r) - 1))

    best = cost(route)
    deadline = time.monotonic() + max_seconds
    improved = True
    while improved and time.monotonic() < deadline:
        improved = False
        n = len(route)
        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):
                cand = route[:i] + route[i : j + 1][::-1] + route[j + 1 :]
                c = cost(cand)
                if c < best:
                    route, best, improved = cand, c, True
                    break
            if improved:
                break
        if improved:
            continue
        for seg in (1, 2, 3):
            for i in range(1, n - seg):
                piece = route[i : i + seg]
                rest = route[:i] + route[i + seg :]
                for k in range(1, len(rest)):
                    cand = rest[:k] + piece + rest[k:]
                    c = cost(cand)
                    if c < best:
                        route, best, improved = cand, c, True
                        break
                if improved:
                    break
            if improved:
                break
    return [x - 1 for x in route[1:-1]]


def sorted_by_address(stops: list[BStop]) -> list[int]:
    def hn(h: str) -> tuple:
        digits = "".join(ch for ch in h if ch.isdigit())
        return (int(digits) if digits else 0, h)

    return sorted(range(len(stops)), key=lambda i: (stops[i].postcode, stops[i].street, hn(stops[i].house)))


def turvio_solver(stops: list[BStop], m: Matrix, seconds: int, max_shift: int, solve_fn, overtime: int | None = None) -> tuple[list[int], int, float]:
    req = OptimizeRequest(
        overtime_penalty_per_minute=overtime,
        vehicles=[Vehicle(id="v", start=DEPOT, end=DEPOT, shift_start=SHIFT_START, max_shift_minutes=max_shift)],
        stops=[
            Stop(
                id=s.id,
                location=GeoPoint(lat=s.lat, lng=s.lng),
                service_seconds=s.service_s,
                time_window=TimeWindow(start=s.tw[0], end=s.tw[1]) if s.tw else None,
                priority=s.priority,
                demand=s.parcels,
            )
            for s in stops
        ],
        time_limit_seconds=seconds,
    )
    # Solver node layout: [vehicle start, vehicle end, stops…]; ours is [depot, stops…].
    def dup(rows: list[list[int]]) -> list[list[int]]:
        r = [[row[0]] + row for row in rows]
        return [r[0]] + r

    sm = Matrix(dup(m.distances_m), dup(m.durations_s), m.source)
    t0 = time.monotonic()
    res = solve_fn(req, matrix=sm)
    elapsed = time.monotonic() - t0
    idx = {s.id: i for i, s in enumerate(stops)}
    order = [idx[v.stop_id] for v in res.routes[0].visits] if res.routes else []
    return order, len(res.unassigned_stop_ids), elapsed


# ---------------------------------------------------------------- runner


@dataclass
class Row:
    size: int
    method: str
    seconds: float
    ev: Eval
    extra: dict = field(default_factory=dict)


def run(sizes: list[int], seeds: list[int], methods: list[str], solver_seconds: dict[str, int], max_shift: int, solve_fn) -> list[Row]:
    rows = load_addresses()
    out: list[Row] = []
    base_url = os.environ["OSRM_URL"]
    for n in sizes:
        for seed in seeds:
            stops = make_tour(rows, n, seed)
            points = [DEPOT] + [GeoPoint(lat=s.lat, lng=s.lng) for s in stops]
            t0 = time.monotonic()
            m = osrm_matrix(points, base_url)
            matrix_s = time.monotonic() - t0
            for meth in methods:
                t0 = time.monotonic()
                unassigned = 0
                if meth == "import_order":
                    order = list(range(n))
                elif meth == "address_sort":
                    order = sorted_by_address(stops)
                elif meth == "nearest_neighbour":
                    order = nearest_neighbour(m, n)
                elif meth == "nn_2opt_oropt":
                    order = local_search(nearest_neighbour(m, n), m)
                elif meth.startswith("legacy_"):
                    from bench import legacy_solver

                    order, unassigned, _ = turvio_solver(stops, m, solver_seconds[meth], max_shift, legacy_solver.solve)
                elif meth.startswith("turvio_"):
                    # A driver's own tour: overtime is reported, never "solved" by dropping parcels.
                    order, unassigned, _ = turvio_solver(stops, m, solver_seconds[meth], max_shift, solve_fn, overtime=600)
                else:
                    raise SystemExit(f"unknown method {meth}")
                el = time.monotonic() - t0
                ev = evaluate(order, stops, m, unassigned)
                out.append(Row(n, meth, round(el, 2), ev, {"seed": seed, "matrix_seconds": round(matrix_s, 2)}))
                print(f"n={n:3d} seed={seed} {meth:22s} {el:6.2f}s drive={ev.drive_s/60:6.1f}min dist={ev.distance_m/1000:6.1f}km late={ev.late_stops} unassigned={ev.unassigned} pc-reentry={ev.postcode_reentries} street-reentry={ev.street_reentries} split={ev.split_buildings}", flush=True)
    return out


def summarize(rows: list[Row]) -> str:
    lines = [
        "| Stops | Method | Runtime s | Drive min | Distance km | vs import | Late stops | Unassigned | Street re-entries | Split buildings |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    by = {}
    for r in rows:
        by.setdefault((r.size, r.method), []).append(r)
    sizes = sorted({r.size for r in rows})
    methods = list(dict.fromkeys(r.method for r in rows))
    for n in sizes:
        base = statistics.mean(r.ev.drive_s for r in by[(n, "import_order")]) if (n, "import_order") in by else None
        for meth in methods:
            rs = by.get((n, meth))
            if not rs:
                continue
            drive = statistics.mean(r.ev.drive_s for r in rs)
            imp = f"{(1 - drive / base) * 100:.0f} %" if base else "–"
            lines.append(
                f"| {n} | {meth} | {statistics.mean(r.seconds for r in rs):.2f} | {drive/60:.1f} | {statistics.mean(r.ev.distance_m for r in rs)/1000:.1f} | {imp} | "
                f"{statistics.mean(r.ev.late_stops for r in rs):.1f} | {statistics.mean(r.ev.unassigned for r in rs):.1f} | {statistics.mean(r.ev.street_reentries for r in rs):.1f} | {statistics.mean(r.ev.split_buildings for r in rs):.1f} |"
            )
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", default="10,25,50,80,100,150,200")
    ap.add_argument("--seeds", default="1,2,3")
    ap.add_argument("--methods", default="import_order,address_sort,nearest_neighbour,nn_2opt_oropt,legacy_prod,turvio_prod,turvio_30s")
    ap.add_argument("--max-shift", type=int, default=600)
    ap.add_argument("--solver", default="turvio_optimizer.solver")
    ap.add_argument("--out", default=None)
    ap.add_argument("--label", default="baseline")
    a = ap.parse_args()
    if not os.environ.get("OSRM_URL"):
        sys.exit("OSRM_URL is required (real road network only)")
    mod = __import__(a.solver, fromlist=["solve"])
    sizes = [int(x) for x in a.sizes.split(",")]
    seeds = [int(x) for x in a.seeds.split(",")]
    # Production limits (apps/api/src/routes/tours.ts): 5 s, 10 s above 60 located stops.
    secs = {"legacy_prod": 0, "turvio_prod": 0, "turvio_30s": 30, "turvio_60s": 60, "turvio_5s": 5, "turvio_2s": 2}
    rows_out: list[Row] = []
    for n in sizes:
        secs["turvio_prod"] = secs["legacy_prod"] = 10 if n > 60 else 5
        rows_out += run([n], seeds, a.methods.split(","), secs, a.max_shift, mod.solve)
    table = summarize(rows_out)
    print(table)
    if a.out:
        out = Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        (out / f"hannover-{a.label}.json").write_text(
            json.dumps([{"size": r.size, "method": r.method, "seconds": r.seconds, **r.ev.__dict__, **r.extra} for r in rows_out], indent=1)
        )
        (out / f"hannover-{a.label}.md").write_text(table + "\n")


if __name__ == "__main__":
    main()
