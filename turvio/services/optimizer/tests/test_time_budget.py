"""Time budget of the whole optimization (matrix, VROOM, re-insertion, OR-Tools, response) and the
validated warm-start fallback. No OSRM needed: straight-line matrices or synthetic ones."""

from __future__ import annotations

import math
import random
import time

import pytest

from turvio_optimizer import solver as S
from turvio_optimizer.matrix import Matrix, estimate_matrix
from turvio_optimizer.models import GeoPoint, OptimizeRequest

pytest.importorskip("vroom")

DEPOT = {"lat": 52.4117, "lng": 9.8296}


def city_stops(n: int, seed: int, express: float = 0.10, windows=(8 * 60, 10 * 60 + 30)) -> list[dict]:
    """n stops spread over ~10 x 10 km around Hannover, ~10 % express deadlines."""
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        s = {"id": f"s{i}", "location": {"lat": 52.33 + rnd.random() * 0.1, "lng": 9.66 + rnd.random() * 0.16}, "serviceSeconds": 90 + 30 * (rnd.random() < 0.15)}
        if rnd.random() < express:
            s["timeWindow"] = {"start": windows[0], "end": windows[1] if rnd.random() < 0.5 else 12 * 60}
            s["priority"] = True
        out.append(s)
    return out


def request(stops, vehicles=1, seconds=5, **kw) -> OptimizeRequest:
    return OptimizeRequest.model_validate(
        {
            "vehicles": [{"id": f"v{i}", "start": DEPOT, "end": DEPOT, "shiftStart": 480, "maxShiftMinutes": kw.pop("max_shift", 600), **({"capacity": kw["capacity"]} if "capacity" in kw else {})} for i in range(vehicles)],
            "stops": stops,
            "timeLimitSeconds": seconds,
            **{k: v for k, v in kw.items() if k != "capacity"},
        }
    )


def accounted_once(req: OptimizeRequest, res) -> bool:
    on = [v.stop_id for r in res.routes for v in r.visits]
    return len(on) == len(set(on)) and not (set(on) & set(res.unassigned_stop_ids)) and set(on) | set(res.unassigned_stop_ids) == {s.id for s in req.stops}


# ------------------------------------------------------------------ re-insertion: fast == exhaustive


def reinsert_exhaustive(req, dur, stop_offset, routes):
    """The implementation before 2026-11-10 (re-simulates every position), kept as the reference."""
    routes = [list(r) for r in routes]
    service = [0] * stop_offset + [s.service_seconds for s in req.stops]
    windows = [None] * stop_offset + [(s.time_window.start * 60, s.time_window.end * 60) if s.time_window else None for s in req.stops]

    def lateness(v, route):
        t, prev, late = req.vehicles[v].shift_start * 60, 2 * v, 0
        for n in route:
            t += service[prev] + dur[prev][n]
            w = windows[n]
            if w:
                t = max(t, w[0])
                late += max(0, t - w[1])
            prev = n
        return late

    placed = {n for route in routes for n in route}
    for node in range(stop_offset, stop_offset + len(req.stops)):
        if node in placed:
            continue
        best = None
        for v, route in enumerate(routes):
            seq = [2 * v, *route, 2 * v + 1]
            for k in range(len(seq) - 1):
                a, b = seq[k], seq[k + 1]
                cand = (lateness(v, route[:k] + [node] + route[k:]), dur[a][node] + dur[node][b] - dur[a][b], v, k)
                if best is None or cand[:2] < best[:2]:
                    best = cand
        if best is not None:
            routes[best[2]].insert(best[3], node)
    return routes


def random_case(rnd: random.Random):
    nv = rnd.randint(1, 3)
    n = rnd.randint(3, 40)
    stops = []
    for i in range(n):
        s = {"id": f"s{i}", "location": {"lat": 52.4, "lng": 9.7}, "serviceSeconds": rnd.choice([0, 60, 90, 120, 300])}
        r = rnd.random()
        if r < 0.25:  # express deadline, often tight
            s["timeWindow"] = {"start": 480, "end": 480 + rnd.randint(5, 180)}
        elif r < 0.32:  # opening window (waiting possible)
            st = 480 + rnd.randint(30, 300)
            s["timeWindow"] = {"start": st, "end": st + rnd.randint(10, 120)}
        stops.append(s)
    req = request(stops, nv, 1)
    size = 2 * nv + n
    # Asymmetric, small integers (many ties), triangle inequality deliberately NOT guaranteed.
    dur = [[0 if i == j else rnd.randint(1, 900) for j in range(size)] for i in range(size)]
    off = 2 * nv
    nodes = list(range(off, off + n))
    rnd.shuffle(nodes)
    k_out = rnd.randint(1, max(1, min(8, n - 1)))
    left_out, kept = nodes[:k_out], nodes[k_out:]
    routes = [[] for _ in range(nv)]
    for x in kept:
        routes[rnd.randrange(nv)].append(x)
    return req, dur, off, routes


@pytest.mark.parametrize("seed", range(400))
def test_fast_reinsertion_equals_exhaustive(seed):
    rnd = random.Random(seed)
    req, dur, off, routes = random_case(rnd)
    fast, inserted, truncated = S._reinsert(req, dur, off, routes)
    assert not truncated
    assert fast == reinsert_exhaustive(req, dur, off, routes)
    placed = sorted(n for r in fast for n in r)
    assert placed == list(range(off, off + len(req.stops)))  # nothing lost, nothing twice
    assert sorted(inserted) == sorted(set(placed) - {n for r in routes for n in r})


def test_fast_reinsertion_is_fast_on_500_stops():
    rnd = random.Random(7)
    stops = city_stops(500, 7)
    req = request(stops)
    m = estimate_matrix([GeoPoint(**DEPOT), GeoPoint(**DEPOT)] + [GeoPoint(**s["location"]) for s in stops])
    order = list(range(2, 502))
    rnd.shuffle(order)
    routes = [order[:460]]  # 40 stops left out, as VROOM does with hard deadlines
    t0 = time.monotonic()
    fast, inserted, _ = S._reinsert(req, m.durations_s, 2, routes)
    assert time.monotonic() - t0 < 3.0  # the exhaustive version took ~280 s on a 500-stop tour
    assert len(inserted) == 40 and sorted(fast[0]) == list(range(2, 502))


def test_truncated_reinsertion_still_places_every_stop():
    stops = city_stops(200, 3)
    req = request(stops)
    m = estimate_matrix([GeoPoint(**DEPOT), GeoPoint(**DEPOT)] + [GeoPoint(**s["location"]) for s in stops])
    routes = [list(range(2, 172))]
    fast, inserted, truncated = S._reinsert(req, m.durations_s, 2, routes, deadline=time.monotonic() - 1)
    assert truncated and len(inserted) == 30 and sorted(fast[0]) == list(range(2, 202))


# ------------------------------------------------------------------ whole solve within the budget


@pytest.mark.parametrize("vehicles", [1, 5])
def test_500_stops_within_budget(vehicles):
    stops = city_stops(500, 11)
    req = request(stops, vehicles, seconds=5, max_shift=600 if vehicles == 1 else 480, **({"overtimePenaltyPerMinute": 600} if vehicles == 1 else {}))
    t0 = time.monotonic()
    res = S.solve(req)  # straight-line matrix built inside (no OSRM in unit tests)
    wall = time.monotonic() - t0
    assert wall <= 5 + 1.0, f"took {wall:.1f} s for a 5 s budget"
    assert res.status == "feasible"
    assert res.timings is not None and res.timings.total_seconds <= 5 + 0.5
    assert accounted_once(req, res)
    if vehicles == 1:  # own tour: every parcel stays on the route, overtime/late is reported
        assert res.unassigned_stop_ids == []


def test_lateness_is_reported_exactly():
    # One express stop that cannot be on time: served late and reported with its real minutes.
    stops = city_stops(30, 5, express=0.0)
    stops[0]["timeWindow"] = {"start": 480, "end": 481}
    stops[0]["priority"] = True
    res = S.solve(request(stops, seconds=2, overtimePenaltyPerMinute=600))
    visit = next(v for r in res.routes for v in r.visits if v.stop_id == "s0")
    late = [v for v in res.violations if v.kind == "late"]
    assert [v.stop_id for v in late] == ["s0"] and visit.late_minutes == late[0].minutes > 0
    assert visit.late_minutes == pytest.approx(visit.arrival_minute - 481, abs=0.1)


# ------------------------------------------------------------------ validated warm-start fallback


@pytest.fixture
def no_search(monkeypatch):
    """Force the path 'search found nothing in time': OR-Tools is never started."""
    monkeypatch.setattr(S, "_search_allowed", lambda remaining_s: False)


def check_fallback(req, res):
    assert res.status == "feasible" and res.engine in ("vroom-warm-start", "nearest-neighbour-warm-start") and res.timings.warm_start_fallback
    assert accounted_once(req, res)
    stops = {s.id: s for s in req.stops}
    for veh, route in zip(req.vehicles, res.routes):
        if veh.capacity is not None:
            assert sum(stops[v.stop_id].demand for v in route.visits) <= veh.capacity
        prev = route.start_minute
        for v in route.visits:
            assert v.travel_arrival_minute >= prev - 1e-6 and v.arrival_minute >= v.travel_arrival_minute - 1e-6
            w = stops[v.stop_id].time_window
            if w:
                assert v.arrival_minute >= w.start - 1e-6
                assert v.late_minutes == pytest.approx(max(0, v.arrival_minute - w.end), abs=0.1)
            prev = v.arrival_minute
        if route.visits:
            assert route.duration_seconds == pytest.approx(route.drive_seconds + route.service_seconds + route.wait_seconds, abs=1)
            assert route.overtime_minutes == pytest.approx(max(0, route.end_minute - (veh.shift_start + veh.max_shift_minutes)), abs=0.1)
    late = {v.stop_id for v in res.violations if v.kind == "late"}
    assert late == {v.stop_id for r in res.routes for v in r.visits if v.late_minutes > 0}
    overtime = {v.vehicle_id for v in res.violations if v.kind == "overtime"}
    assert overtime == {r.vehicle_id for r in res.routes if r.overtime_minutes > 0}
    assert {v.stop_id for v in res.violations if v.kind.startswith("unassigned")} == set(res.unassigned_stop_ids)


def test_fallback_own_tour_keeps_every_stop_and_reports_lateness(no_search):
    stops = city_stops(120, 4, express=0.2, windows=(480, 500))
    req = request(stops, seconds=3, overtimePenaltyPerMinute=600)
    res = S.solve(req)
    check_fallback(req, res)
    assert res.unassigned_stop_ids == []


def test_fallback_respects_capacity_and_hard_shift(no_search):
    stops = city_stops(150, 9)
    req = request(stops, 3, seconds=3, max_shift=240, capacity=40)
    res = S.solve(req)
    check_fallback(req, res)
    for r in res.routes:
        assert r.duration_seconds <= 240 * 60  # hard shift: stops that do not fit are unassigned, not overtime
    assert all(v.kind != "overtime" for v in res.violations)


def test_fallback_strict_time_windows_never_late(no_search):
    stops = city_stops(80, 6, express=0.3, windows=(480, 510))
    req = request(stops, 2, seconds=3, strictTimeWindows=True)
    res = S.solve(req)
    check_fallback(req, res)
    assert all(v.kind != "late" for v in res.violations)


def test_fallback_open_end(no_search):
    stops = city_stops(60, 8)
    req = OptimizeRequest.model_validate({"vehicles": [{"id": "v0", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 600}], "stops": stops, "timeLimitSeconds": 2, "overtimePenaltyPerMinute": 600})
    res = S.solve(req)
    check_fallback(req, res)
    r = res.routes[0]
    last = r.visits[-1]
    # Ends at the last stop: end = last service start + its service time, no drive back.
    assert r.end_minute == pytest.approx(last.arrival_minute + req.stops[int(last.stop_id[1:])].service_seconds / 60, abs=0.02)


def test_invalid_warm_start_is_never_reported_as_feasible(no_search, monkeypatch):
    # A warm start that breaks capacity on its own (not fixable by removing re-inserted stops).
    stops = city_stops(10, 2, express=0.0)
    req = request(stops, 1, seconds=2, capacity=5)
    monkeypatch.setattr(S, "_vroom_routes", lambda req, dur, off, **kw: [list(range(off, off + 10))])
    res = S.solve(req)
    assert res.status == "no_solution"
    assert res.routes == [] and sorted(res.unassigned_stop_ids) == sorted(s["id"] for s in stops)
