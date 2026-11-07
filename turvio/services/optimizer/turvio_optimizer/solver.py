"""Vehicle routing with time windows (VRPTW) on Google OR-Tools.

Model
-----
* One start node and one end node per vehicle (depot, current position or "open end").
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
"""

from __future__ import annotations

import time

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .matrix import Matrix, RoutingError, build_matrix
from .models import OptimizeRequest, OptimizeResponse, Route, Violation, Visit

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


def solve(req: OptimizeRequest, matrix: Matrix | None = None) -> OptimizeResponse:
    t_start = time.monotonic()
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
        try:
            matrix = build_matrix(points)
        except RoutingError as e:
            # Name the affected depot positions / stops for the caller.
            for idx, snap in e.point_snaps:
                if idx < stop_offset:
                    e.points.append({"kind": "vehicle_end" if idx % 2 else "vehicle_start", "vehicleId": vehicles[idx // 2].id, "snapMeters": round(snap)})
                else:
                    e.points.append({"kind": "stop", "stopId": stops[idx - stop_offset].id, "snapMeters": round(snap)})
            raise
    dur, dist = matrix.durations_s, matrix.distances_m

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
    params.time_limit.seconds = req.time_limit_seconds

    solution = routing.SolveWithParameters(params)
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
                    Visit(stop_id=stop.id, arrival_minute=arrival / 60, service_start_minute=service_start / 60, late_minutes=round(late, 1))
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
    for sid in unassigned:
        node = stop_offset + stop_index[sid]
        unreachable = all(dur[st][node] >= UNROUTABLE for st in starts) or all(dur[node][e] >= UNROUTABLE for e in ends)
        violations.append(Violation(kind="unassigned_unreachable" if unreachable else "unassigned_infeasible", stop_id=sid))

    return OptimizeResponse(
        routes=routes,
        unassigned_stop_ids=unassigned,
        matrix_source=matrix.source,
        matrix_note=matrix.note,
        status="feasible",
        engine="or-tools",
        violations=violations,
        solve_seconds=round(time.monotonic() - t_start, 3),
    )
