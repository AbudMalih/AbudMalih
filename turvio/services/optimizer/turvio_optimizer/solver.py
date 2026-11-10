"""Vehicle routing with time windows (VRPTW) on Google OR-Tools.

Model
-----
* One start node and one end node per vehicle (depot, current position or "open end": a vehicle
  without `end` finishes at its last stop – arcs into its end node cost nothing).
* Objective: road driving time in seconds (OSRM matrix) – the thing a driver feels.
  Everything else is a constraint or a penalty that only comes into play when needed.
* "Time" dimension in absolute seconds since midnight: transit = travel + service time at the
  origin node; waiting (slack) is allowed so a driver can wait for a pickup window to open.
* Time windows: the start is hard (service never begins early). The end is a deadline: by
  default it is soft with a penalty far above any driving saving (a late stop is only chosen
  when no on-time sequence exists) and every late stop is reported. `strict_time_windows`
  drops such a stop instead.
* Shift: hard limit (stops that do not fit become unassigned – multi-vehicle planning), or,
  with `overtime_penalty_per_minute`, allowed overtime that is reported (a driver's own tour:
  every parcel stays on the route instead of silently disappearing).
* Priority/express: a much larger drop and lateness penalty. There is deliberately NO
  "as early as possible" cost: it made express parcels with a 12:00 deadline drag the whole
  tour into a zig-zag (benchmark: +10–15 % driving on 90-stop Hannover tours, no deadline gain).
* Pickup → delivery pairs: same vehicle, pickup first.
* Capacity: optional parcel capacity per vehicle.

The solver uses guided local search within a time limit. The result is a feasible, usually
very good solution; it is NOT proven optimal. Violations are listed, never hidden.

Time budget (`time_limit_seconds`) covers the whole request: matrix, VROOM warm start, re-insertion
of stops VROOM left out, OR-Tools search and building the response. Each phase gets what is left
of one deadline; if the search finds nothing in time, the warm-start routes are validated and
returned instead (never an unvalidated or silently incomplete plan).
"""

from __future__ import annotations

import os
import time

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .matrix import Matrix, RoutingError, build_matrix
from .models import OptimizeRequest, OptimizeResponse, Route, Timings, Violation, Visit

DAY_SECONDS = 24 * 3600
UNROUTABLE = 10**7  # matrix value for pairs OSRM cannot connect (see matrix.py)
DROP_PENALTY = 1_000_000_000
PRIORITY_DROP_PENALTY = 100_000_000_000
# Per second late. 100/s: one minute late costs as much as 100 minutes of driving.
LATE_COST = 100
PRIORITY_LATE_COST = 1_000
# Tuning knobs (see bench/hannover.py). SPAN_COST charges the whole route duration (driving a
# second time + service + waiting); SLACK_COST charges only idle waiting.
SPAN_COST = 1
SLACK_COST = 0
ARC_SCALE = 1  # driving-cost multiplier relative to the span/slack weights


# Warm start (default; measured in bench/hannover.py, docs/ROUTE_OPTIMIZATION.md): VROOM (BSD-2,
# pyvroom) builds first routes on the same matrix within ~0.1–6 s; stops it leaves out (hard
# deadlines/shift there) are inserted where they cause the least lateness; OR-Tools continues
# with the full TURVIO model (soft deadlines, overtime, pairs) in the remaining budget.
# "none" = OR-Tools construction only. Falls back to that when pyvroom is missing or the start
# is not valid for the OR-Tools model.
WARM_START = os.environ.get("TURVIO_WARM_START", "vroom")

# Shares of the total budget (measured on 200–500 stops, see docs/ROUTE_OPTIMIZATION.md).
RESPONSE_RESERVE_S = 0.1  # kept free for building and validating the response (measured ~2 ms for 500 stops)
WARM_START_SHARE = 0.4  # VROOM's own timeout: at most this share of the budget
REINSERT_SHARE = 0.15  # exact re-insertion until this share is used, then cheapest position
# The OSRM matrix may use at most this share of the budget (and never more than leaves
# MIN_SEARCH_S): a slow or hung routing service fails the request in time instead of overrunning.
MATRIX_SHARE = 0.5
MIN_SEARCH_S = 0.2  # below this, OR-Tools is skipped and the validated warm start is returned
# VROOM's timeout stops its search but not its construction heuristics (measured: 1.4–2.0 s for a
# 1 s timeout on one 500-stop route). Asking for less leaves room for that; the worker process is
# stopped at the full warm-start share regardless (warmstart.py).
VROOM_OVERRUN_S_PER_STOP = 0.002
# One driver with more than 200 stops: VROOM's search on one huge route keeps running long past its
# timeout; asked for 3 s it returns usable routes in ~4 s (500 stops: 920 min driving in 15 s vs 912
# min after 365 s unbounded; uncapped it was stopped and the result was 1,087–1,123 min).
SINGLE_ROUTE_LARGE_STOPS = 200
SINGLE_ROUTE_VROOM_TIMEOUT_S = 3.0


def _vroom_routes(
    req: OptimizeRequest, dur: list[list[int]], stop_offset: int, timeout_s: float | None = None, hard_deadline: float | None = None
) -> list[list[int]] | None:
    """Initial routes (stop node numbers per vehicle) from VROOM, or None. VROOM runs in a worker
    process that is stopped at `hard_deadline` (see warmstart.py). Stops VROOM leaves out are NOT
    re-inserted here (see _reinsert)."""
    if req.pickup_deliveries:
        return None
    if timeout_s is not None and timeout_s < 0.05:
        return None
    try:
        import vroom  # type: ignore[import-not-found]  # noqa: F401 – installed?
    except ImportError:
        return None
    from . import warmstart

    soft_shift = req.overtime_penalty_per_minute is not None
    with_capacity = any(v.capacity is not None for v in req.vehicles)
    payload = {
        "durations": dur,
        "vehicles": [
            {
                "id": i + 1,
                "start": 2 * i,
                "end": 2 * i + 1,
                "tw": [v.shift_start * 60, DAY_SECONDS * 2 - 1 if soft_shift else v.shift_start * 60 + v.max_shift_minutes * 60],
                "capacity": v.capacity,
            }
            for i, v in enumerate(req.vehicles)
        ],
        "jobs": [
            {
                "id": k + 1,
                "location": stop_offset + k,
                "service": s.service_seconds,
                "priority": 100 if s.priority else 0,
                "tw": [s.time_window.start * 60, s.time_window.end * 60] if s.time_window else None,
                "delivery": s.demand if with_capacity else None,
            }
            for k, s in enumerate(req.stops)
        ],
        "timeout": timeout_s,
        # Measured (bench/hannover.py): level 2 matches level 5 on 150–200 stops at a third of
        # the time, leaving most of the budget to OR-Tools. Above 200 stops level 0: its first
        # routes arrive within the time budget (500 stops: −1.5 % driving for 1 driver, −8 % for 5
        # drivers vs level 2 in the same 15 s; 2026-11-10).
        "level": 5 if len(req.stops) <= 100 else 2 if len(req.stops) <= 200 else 0,
        "threads": 4,
    }
    jobs = warmstart.run(payload, hard_deadline if hard_deadline is not None else time.monotonic() + 3600)
    if jobs is None:
        return None
    return [[stop_offset + jid - 1 for jid in route] for route in jobs]


def _nearest_neighbour_routes(req: OptimizeRequest, dur: list[list[int]], stop_offset: int) -> list[list[int]] | None:
    """Fallback first route when VROOM is not available in time: one driver's tour only (O(n²)).
    Stops with a time window are left out here and placed by _reinsert (least lateness first)."""
    if len(req.vehicles) != 1 or req.pickup_deliveries or req.strict_time_windows or req.overtime_penalty_per_minute is None:
        return None
    left = {stop_offset + k for k, s in enumerate(req.stops) if not s.time_window}
    route, cur = [], 0
    while left:
        nxt = min(left, key=lambda n: (dur[cur][n], n))
        route.append(nxt)
        left.remove(nxt)
        cur = nxt
    return [route]


def _search_allowed(remaining_s: float) -> bool:
    """Enough time left for the OR-Tools search (tests switch the search off here)."""
    return remaining_s >= MIN_SEARCH_S


def _windows_and_service(req: OptimizeRequest, stop_offset: int) -> tuple[list[int], list[tuple[int, int] | None]]:
    service = [0] * stop_offset + [s.service_seconds for s in req.stops]
    windows = [None] * stop_offset + [(s.time_window.start * 60, s.time_window.end * 60) if s.time_window else None for s in req.stops]
    return service, windows


def _profile(v: int, route: list[int], req: OptimizeRequest, dur: list[list[int]], service: list[int], windows: list) -> tuple[list[int], list[int], list[int]]:
    """Service start, departure and lateness at every position of [start, *route] (start = index 0)."""
    t = req.vehicles[v].shift_start * 60
    start, dep, late = [t], [t], [0]
    prev = 2 * v
    for n in route:
        t = dep[-1] + dur[prev][n]
        w = windows[n]
        lt = 0
        if w:
            t = max(t, w[0])
            lt = max(0, t - w[1])
        start.append(t)
        late.append(lt)
        dep.append(t + service[n])
        prev = n
    return start, dep, late


def _reinsert(
    req: OptimizeRequest, dur: list[list[int]], stop_offset: int, routes: list[list[int]], deadline: float | None = None
) -> tuple[list[list[int]], list[int], bool]:
    """Put every stop VROOM left out where it causes the least lateness, then the least extra
    driving (VROOM treats deadlines and the shift as hard; in TURVIO the parcel stays on the route
    and the delay is reported). Same choice as the exhaustive search – including ties: candidates
    are visited in order of a lower bound on lateness and only simulated while they can still win.
    After `deadline` the remaining stops go to the position with the lowest bound (cheapest detour)
    and OR-Tools repairs the rest.

    Returns (routes, inserted nodes in insertion order, truncated)."""
    routes = [list(r) for r in routes]
    service, windows = _windows_and_service(req, stop_offset)
    placed = {n for route in routes for n in route}
    missing = [n for n in range(stop_offset, stop_offset + len(req.stops)) if n not in placed]
    profiles = [_profile(v, r, req, dur, service, windows) for v, r in enumerate(routes)]
    inserted: list[int] = []
    truncated = False
    for node in missing:
        w = windows[node]
        cands = []  # (lower bound, extra, vehicle, position, own lateness, departure at node)
        for v, route in enumerate(routes):
            start, dep, late = profiles[v]
            total = sum(late)
            prefix = 0
            seq_len = len(route)
            for k in range(seq_len + 1):
                prefix += late[k]
                a = 2 * v if k == 0 else route[k - 1]
                b = route[k] if k < seq_len else 2 * v + 1
                extra = dur[a][node] + dur[node][b] - dur[a][b]
                tx = dep[k] + dur[a][node]
                own = 0
                if w:
                    tx = max(tx, w[0])
                    own = max(0, tx - w[1])
                dx = tx + service[node]
                if k < seq_len:
                    tb = dx + dur[node][b]
                    wb = windows[b]
                    if wb:
                        tb = max(tb, wb[0])
                    # Later arrivals can only increase the suffix lateness; earlier ones (the road
                    # matrix need not obey the triangle inequality) only the prefix counts.
                    lb = total + own if tb >= start[k + 1] else prefix + own
                else:
                    lb = total + own
                cands.append((lb, extra, v, k, own, dx))
        if not cands:
            continue
        cands.sort(key=lambda c: c[:4])
        if deadline is not None and time.monotonic() > deadline:
            truncated = True
            best = cands[0][:4]
        else:
            best = None
            for lb, extra, v, k, own, dx in cands:
                if best is not None and (lb, extra, v, k) > best:
                    break
                start, dep, late = profiles[v]
                route = routes[v]
                # Exact lateness: prefix + own + suffix, simulated until the delay is absorbed.
                exact = sum(late[: k + 1]) + own
                t_dep, prev = dx, node
                j = k
                while j < len(route):
                    n = route[j]
                    t = t_dep + dur[prev][n]
                    wn = windows[n]
                    if wn:
                        t = max(t, wn[0])
                    if t == start[j + 1]:
                        exact += sum(late[j + 1 :])
                        break
                    if wn:
                        exact += max(0, t - wn[1])
                    t_dep, prev = t + service[n], n
                    j += 1
                key = (exact, extra, v, k)
                if best is None or key < best:
                    best = key
        _, _, v, k = best
        routes[v].insert(k, node)
        inserted.append(node)
        profiles[v] = _profile(v, routes[v], req, dur, service, windows)
    return routes, inserted, truncated


def solve(req: OptimizeRequest, matrix: Matrix | None = None, started_at: float | None = None) -> OptimizeResponse:
    """`started_at` (time.monotonic()) lets the HTTP layer count from the moment the request arrived."""
    t_start = started_at if started_at is not None else time.monotonic()
    deadline = t_start + req.time_limit_seconds - RESPONSE_RESERVE_S
    phase = {"matrix": 0.0, "warm_start": 0.0, "reinsertion": 0.0, "search": 0.0}
    vehicles, stops = req.vehicles, req.stops
    n_vehicles = len(vehicles)

    # Node layout: [v0 start, v0 end, v1 start, v1 end, ..., stop0, stop1, ...]
    points = []
    for v in vehicles:
        points.append(v.start)
        points.append(v.end or v.start)
    stop_offset = len(points)
    points.extend(s.location for s in stops)

    if matrix is None:
        t0 = time.monotonic()
        try:
            matrix = build_matrix(points, deadline=min(deadline - MIN_SEARCH_S, t_start + MATRIX_SHARE * req.time_limit_seconds))
            phase["matrix"] = time.monotonic() - t0
        except RoutingError as e:
            # Name the affected depot positions / stops for the caller.
            for idx, snap in e.point_snaps:
                if idx < stop_offset:
                    e.points.append({"kind": "vehicle_end" if idx % 2 else "vehicle_start", "vehicleId": vehicles[idx // 2].id, "snapMeters": round(snap)})
                else:
                    e.points.append({"kind": "stop", "stopId": stops[idx - stop_offset].id, "snapMeters": round(snap)})
            raise
    dur, dist = matrix.durations_s, matrix.distances_m
    # Open end ("end at the last stop"): the end node is a placeholder at the start position, and
    # reaching it is free, so the route really ends at its last stop – no hidden trip back that
    # would distort the stop order, the distance and the end time. Copies: the caller's matrix
    # stays untouched.
    open_ends = [2 * i + 1 for i, v in enumerate(vehicles) if v.end is None]
    if open_ends:
        dur, dist = [row[:] for row in dur], [row[:] for row in dist]
        for e in open_ends:
            for row in (*dur, *dist):
                row[e] = 0

    starts = [2 * i for i in range(n_vehicles)]
    ends = [2 * i + 1 for i in range(n_vehicles)]
    manager = pywrapcp.RoutingIndexManager(len(points), n_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(manager)
    solver = routing.solver()

    service = [0] * stop_offset + [s.service_seconds for s in stops]

    def travel_cb(from_index: int, to_index: int) -> int:
        return ARC_SCALE * dur[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    def time_cb(from_index: int, to_index: int) -> int:
        i = manager.IndexToNode(from_index)
        return dur[i][manager.IndexToNode(to_index)] + service[i]

    travel_idx = routing.RegisterTransitCallback(travel_cb)
    time_idx = routing.RegisterTransitCallback(time_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(travel_idx)

    routing.AddDimension(time_idx, DAY_SECONDS, 2 * DAY_SECONDS, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")
    soft_shift = req.overtime_penalty_per_minute is not None

    for v_i, v in enumerate(vehicles):
        start_var = time_dim.CumulVar(routing.Start(v_i))
        start_var.SetRange(v.shift_start * 60, DAY_SECONDS)
        if soft_shift:
            # Overtime costs `overtime_penalty_per_minute` per minute; nothing is dropped for it.
            time_dim.SetCumulVarSoftUpperBound(
                routing.End(v_i), (v.shift_start + v.max_shift_minutes) * 60, max(1, round(req.overtime_penalty_per_minute / 60))
            )
        else:
            time_dim.SetSpanUpperBoundForVehicle(v.max_shift_minutes * 60, v_i)
        # Prefer leaving late rather than waiting on the road, and short shifts.
        routing.AddVariableMaximizedByFinalizer(start_var)
        routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.End(v_i)))
    if SPAN_COST:
        time_dim.SetSpanCostCoefficientForAllVehicles(SPAN_COST)
    if SLACK_COST:
        time_dim.SetSlackCostCoefficientForAllVehicles(SLACK_COST)

    for s_i, s in enumerate(stops):
        index = manager.NodeToIndex(stop_offset + s_i)
        cumul = time_dim.CumulVar(index)
        if s.time_window:
            if req.strict_time_windows:
                cumul.SetRange(s.time_window.start * 60, s.time_window.end * 60)
            else:
                cumul.SetMin(s.time_window.start * 60)
                time_dim.SetCumulVarSoftUpperBound(index, s.time_window.end * 60, PRIORITY_LATE_COST if s.priority else LATE_COST)
        routing.AddDisjunction([index], PRIORITY_DROP_PENALTY if s.priority else DROP_PENALTY)

    stop_index = {s.id: i for i, s in enumerate(stops)}
    for pd in req.pickup_deliveries:
        p = manager.NodeToIndex(stop_offset + stop_index[pd.pickup_id])
        d = manager.NodeToIndex(stop_offset + stop_index[pd.delivery_id])
        routing.AddPickupAndDelivery(p, d)
        solver.Add(routing.ActiveVar(p) == routing.ActiveVar(d))
        solver.Add(routing.VehicleVar(p) == routing.VehicleVar(d))
        solver.Add(time_dim.CumulVar(p) <= time_dim.CumulVar(d))

    if any(v.capacity is not None for v in vehicles):
        demands = [0] * stop_offset + [s.demand for s in stops]

        def demand_cb(from_index: int) -> int:
            return demands[manager.IndexToNode(from_index)]

        demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
        caps = [v.capacity if v.capacity is not None else 10**9 for v in vehicles]
        routing.AddDimensionWithVehicleCapacity(demand_idx, 0, caps, True, "Capacity")

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    budget = float(req.time_limit_seconds)

    def remaining() -> float:
        return deadline - time.monotonic()

    def set_limit(seconds: float) -> None:
        params.time_limit.FromMilliseconds(max(1, int(seconds * 1000)))

    def timings(fallback: bool = False, truncated: bool = False) -> Timings:
        return Timings(
            budget_seconds=budget,
            matrix_seconds=round(phase["matrix"], 3),
            warm_start_seconds=round(phase["warm_start"], 3),
            reinsertion_seconds=round(phase["reinsertion"], 3),
            search_seconds=round(phase["search"], 3),
            total_seconds=round(time.monotonic() - t_start, 3),
            reinsertion_truncated=truncated,
            warm_start_fallback=fallback,
        )

    solution = None
    initial: list[list[int]] | None = None
    vroom_routes: list[list[int]] | None = None
    reinserted: list[int] = []
    truncated = False
    warm_engine = "vroom-warm-start"
    if WARM_START == "vroom":
        t0 = time.monotonic()
        vroom_window = max(0.0, min(WARM_START_SHARE * budget, remaining() - MIN_SEARCH_S))
        allowance = VROOM_OVERRUN_S_PER_STOP * len(stops)
        vroom_timeout = max(0.0, vroom_window - allowance)
        if n_vehicles == 1 and len(stops) > SINGLE_ROUTE_LARGE_STOPS:
            vroom_timeout = min(vroom_timeout, SINGLE_ROUTE_VROOM_TIMEOUT_S)
        vroom_routes = _vroom_routes(req, dur, stop_offset, timeout_s=vroom_timeout, hard_deadline=time.monotonic() + vroom_window)
        if vroom_routes is None:
            vroom_routes = _nearest_neighbour_routes(req, dur, stop_offset)
            warm_engine = "nearest-neighbour-warm-start"
        phase["warm_start"] = time.monotonic() - t0
        if vroom_routes is not None:
            initial = vroom_routes
            if not req.strict_time_windows:
                t0 = time.monotonic()
                reinsert_deadline = min(deadline - MIN_SEARCH_S, time.monotonic() + REINSERT_SHARE * budget)
                initial, reinserted, truncated = _reinsert(req, dur, stop_offset, vroom_routes, reinsert_deadline)
                phase["reinsertion"] = time.monotonic() - t0
    t0 = time.monotonic()
    if initial is not None and _search_allowed(remaining()):
        set_limit(remaining())
        routing.CloseModelWithParameters(params)
        start_assignment = routing.ReadAssignmentFromRoutes([[manager.NodeToIndex(n) for n in r] for r in initial], True)
        if start_assignment is not None and remaining() > 0.05:
            set_limit(remaining())
            solution = routing.SolveFromAssignmentWithParameters(start_assignment, params)
    if solution is None and _search_allowed(remaining()):
        # No (valid) warm start: OR-Tools builds its own first solution in the time that is left.
        set_limit(remaining())
        solution = routing.SolveWithParameters(params)
    phase["search"] = time.monotonic() - t0
    if solution is None and initial is not None:
        # Out of time before the search returned anything: hand back the warm start, but only
        # after checking it against every hard constraint (see _validated_fallback).
        fb = _validated_fallback(req, dur, dist, stop_offset, initial, reinserted, matrix, t_start, warm_engine)
        if fb is not None:
            fb.timings = timings(fallback=True, truncated=truncated)
            _assert_complete(req, fb)
            return fb
    if solution is None:
        return OptimizeResponse(
            routes=[],
            unassigned_stop_ids=[s.id for s in stops],
            matrix_source=matrix.source,
            matrix_note=matrix.note,
            status="no_solution",
            engine="or-tools",
            violations=[Violation(kind="unassigned_infeasible", stop_id=s.id) for s in stops],
            solve_seconds=round(time.monotonic() - t_start, 3),
            timings=timings(truncated=truncated),
        )

    routes: list[Route] = []
    violations: list[Violation] = []
    assigned: set[str] = set()
    for v_i, v in enumerate(vehicles):
        index = routing.Start(v_i)
        start_time = solution.Min(time_dim.CumulVar(index))
        visits: list[Visit] = []
        distance = drive = service_total = 0
        prev_service_start, prev_node = start_time, manager.IndexToNode(index)
        while not routing.IsEnd(index):
            nxt = solution.Value(routing.NextVar(index))
            node = manager.IndexToNode(nxt)
            distance += dist[prev_node][node]
            drive += dur[prev_node][node]
            arrival = prev_service_start + service[prev_node] + dur[prev_node][node]
            service_start = solution.Min(time_dim.CumulVar(nxt))
            if node >= stop_offset:
                stop = stops[node - stop_offset]
                assigned.add(stop.id)
                late = max(0, service_start - stop.time_window.end * 60) / 60 if stop.time_window else 0
                visits.append(
                    Visit(stop_id=stop.id, arrival_minute=service_start / 60, travel_arrival_minute=arrival / 60, late_minutes=round(late, 1))
                )
                service_total += stop.service_seconds
                if late > 0:
                    violations.append(Violation(kind="late", stop_id=stop.id, vehicle_id=v.id, minutes=round(late, 1)))
            prev_service_start, prev_node = service_start, node
            index = nxt
        end_time = solution.Min(time_dim.CumulVar(index))
        duration = max(0, end_time - start_time) if visits else 0
        overtime = max(0, end_time - (v.shift_start + v.max_shift_minutes) * 60) / 60 if visits else 0
        if overtime > 0:
            violations.append(Violation(kind="overtime", vehicle_id=v.id, minutes=round(overtime, 1)))
        routes.append(
            Route(
                vehicle_id=v.id,
                visits=visits,
                distance_meters=distance,
                duration_seconds=duration,
                drive_seconds=drive if visits else 0,
                service_seconds=service_total,
                wait_seconds=max(0, duration - drive - service_total) if visits else 0,
                start_minute=start_time / 60,
                end_minute=end_time / 60,
                overtime_minutes=round(overtime, 1),
            )
        )

    unassigned = [s.id for s in stops if s.id not in assigned]
    violations.extend(_unassigned_violations(req, dur, stop_offset, unassigned))

    res = OptimizeResponse(
        routes=routes,
        unassigned_stop_ids=unassigned,
        matrix_source=matrix.source,
        matrix_note=matrix.note,
        status="feasible",
        engine="or-tools",
        violations=violations,
        solve_seconds=round(time.monotonic() - t_start, 3),
    )
    res.timings = timings(truncated=truncated)
    _assert_complete(req, res)
    return res


def _unassigned_violations(req: OptimizeRequest, dur: list[list[int]], stop_offset: int, unassigned: list[str]) -> list[Violation]:
    index = {s.id: i for i, s in enumerate(req.stops)}
    starts = [2 * i for i in range(len(req.vehicles))]
    ends = [2 * i + 1 for i in range(len(req.vehicles))]
    out = []
    for sid in unassigned:
        node = stop_offset + index[sid]
        unreachable = all(dur[st][node] >= UNROUTABLE for st in starts) or all(dur[node][e] >= UNROUTABLE for e in ends)
        out.append(Violation(kind="unassigned_unreachable" if unreachable else "unassigned_infeasible", stop_id=sid))
    return out


def _assert_complete(req: OptimizeRequest, res: OptimizeResponse) -> None:
    """Every requested stop exactly once: on one route or in unassigned_stop_ids – never lost."""
    on_routes = [v.stop_id for r in res.routes for v in r.visits]
    every = [s.id for s in req.stops]
    if len(on_routes) != len(set(on_routes)) or set(on_routes) & set(res.unassigned_stop_ids) or set(on_routes) | set(res.unassigned_stop_ids) != set(every) or len(res.unassigned_stop_ids) != len(set(res.unassigned_stop_ids)):
        raise RuntimeError("optimizer result does not account for every stop exactly once")


def _simulate(req: OptimizeRequest, v: int, route: list[int], dur: list[list[int]], dist: list[list[int]], stop_offset: int, service: list[int], windows: list):
    """Times of one route as OR-Tools reports them: start at shift start, wait for opening windows,
    deadlines late (soft). Returns (visits, end time s, drive s, distance m, service s, late visits)."""
    veh = req.vehicles[v]
    t = veh.shift_start * 60
    prev, drive, distance, serv = 2 * v, 0, 0, 0
    visits, late = [], []
    for n in route:
        arrival = t + service[prev] + dur[prev][n] if prev != 2 * v else t + dur[prev][n]
        start = arrival
        w = windows[n]
        if w:
            start = max(start, w[0])
        stop = req.stops[n - stop_offset]
        lt = max(0, start - w[1]) / 60 if w else 0
        visits.append(Visit(stop_id=stop.id, arrival_minute=start / 60, travel_arrival_minute=arrival / 60, late_minutes=round(lt, 1)))
        if lt > 0:
            late.append((stop.id, round(lt, 1)))
        drive += dur[prev][n]
        distance += dist[prev][n]
        serv += service[n]
        t, prev = start, n
    if route:
        end_node = 2 * v + 1
        end = t + service[prev] + dur[prev][end_node]
        drive += dur[prev][end_node]
        distance += dist[prev][end_node]
    else:
        end = t
    return visits, end, drive, distance, serv, late


def _validated_fallback(
    req: OptimizeRequest,
    dur: list[list[int]],
    dist: list[list[int]],
    stop_offset: int,
    routes: list[list[int]],
    reinserted: list[int],
    matrix: Matrix,
    t_start: float,
    engine: str = "vroom-warm-start",
) -> OptimizeResponse | None:
    """The warm-start routes as a result, checked against every hard constraint first.

    Hard: each stop at most once; capacity; strict time windows; the shift when overtime is not
    allowed. A stop that was re-inserted after VROOM and breaks a hard constraint is taken out
    again and reported as unassigned (as OR-Tools would drop it). Anything else that breaks a hard
    constraint means no valid fallback (None) – an infeasible plan is never reported as feasible."""
    service, windows = _windows_and_service(req, stop_offset)
    routes = [list(r) for r in routes]
    flat = [n for r in routes for n in r]
    if len(flat) != len(set(flat)) or any(not (stop_offset <= n < stop_offset + len(req.stops)) for n in flat):
        return None
    soft_shift = req.overtime_penalty_per_minute is not None
    removable = list(reinserted)

    def broken(v: int, route: list[int]) -> bool:
        veh = req.vehicles[v]
        if veh.capacity is not None and sum(req.stops[n - stop_offset].demand for n in route) > veh.capacity:
            return True
        visits, end, *_rest, late = _simulate(req, v, route, dur, dist, stop_offset, service, windows)
        if req.strict_time_windows and late:
            return True
        return not soft_shift and route and end - veh.shift_start * 60 > veh.max_shift_minutes * 60

    for v, route in enumerate(routes):
        while broken(v, route):
            candidates = [n for n in reversed(removable) if n in route]
            if not candidates:
                return None
            route.remove(candidates[0])
            removable.remove(candidates[0])

    out_routes: list[Route] = []
    violations: list[Violation] = []
    assigned: set[str] = set()
    for v, route in enumerate(routes):
        veh = req.vehicles[v]
        visits, end, drive, distance, serv, late = _simulate(req, v, route, dur, dist, stop_offset, service, windows)
        start = veh.shift_start * 60
        duration = max(0, end - start) if visits else 0
        overtime = max(0, end - (veh.shift_start + veh.max_shift_minutes) * 60) / 60 if visits else 0
        for sid, minutes in late:
            violations.append(Violation(kind="late", stop_id=sid, vehicle_id=veh.id, minutes=minutes))
        if overtime > 0:
            violations.append(Violation(kind="overtime", vehicle_id=veh.id, minutes=round(overtime, 1)))
        assigned.update(x.stop_id for x in visits)
        out_routes.append(
            Route(
                vehicle_id=veh.id,
                visits=visits,
                distance_meters=distance if visits else 0,
                duration_seconds=duration,
                drive_seconds=drive if visits else 0,
                service_seconds=serv,
                wait_seconds=max(0, duration - drive - serv) if visits else 0,
                start_minute=start / 60,
                end_minute=(end if visits else start) / 60,
                overtime_minutes=round(overtime, 1),
            )
        )
    unassigned = [s.id for s in req.stops if s.id not in assigned]
    violations.extend(_unassigned_violations(req, dur, stop_offset, unassigned))
    return OptimizeResponse(
        routes=out_routes,
        unassigned_stop_ids=unassigned,
        matrix_source=matrix.source,
        matrix_note=matrix.note,
        status="feasible",
        engine=engine,
        violations=violations,
        solve_seconds=round(time.monotonic() - t_start, 3),
    )
