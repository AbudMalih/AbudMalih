"""Vehicle routing with time windows (VRPTW) on Google OR-Tools.

Model
-----
* One start node and one end node per vehicle (configurable depots / current position).
* Arc cost = travel time in seconds.
* "Time" dimension in absolute seconds since midnight: transit = travel + service
  time at the origin node; waiting (slack) is allowed so drivers can wait for
  a time window to open.
* Shift limit: route span (start -> end, incl. waiting) <= max_shift_minutes.
* Time windows: the service at a stop must start inside its window.
* Capacity: optional parcel capacity per vehicle.
* Every stop is optional with a large drop penalty, so infeasible stops are
  reported as unassigned instead of failing the whole request. Priority stops
  have a much larger penalty and a soft "as early as possible" cost.

The solver uses guided local search within a time limit. The result is a
feasible, usually very good solution; it is NOT proven optimal.
"""

from __future__ import annotations

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .matrix import Matrix, RoutingError, build_matrix
from .models import OptimizeRequest, OptimizeResponse, Route, Visit

DAY_SECONDS = 24 * 3600
DROP_PENALTY = 10_000_000
PRIORITY_DROP_PENALTY = 1_000_000_000
PRIORITY_EARLINESS_COEFF = 2  # cost per second a priority stop is served after shift start


def solve(req: OptimizeRequest, matrix: Matrix | None = None) -> OptimizeResponse:
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

    service = [0] * stop_offset + [s.service_seconds for s in stops]

    def travel_cb(from_index: int, to_index: int) -> int:
        return dur[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    def time_cb(from_index: int, to_index: int) -> int:
        i = manager.IndexToNode(from_index)
        return dur[i][manager.IndexToNode(to_index)] + service[i]

    travel_idx = routing.RegisterTransitCallback(travel_cb)
    time_idx = routing.RegisterTransitCallback(time_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(travel_idx)

    routing.AddDimension(time_idx, DAY_SECONDS, 2 * DAY_SECONDS, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")

    for v_i, v in enumerate(vehicles):
        start_var = time_dim.CumulVar(routing.Start(v_i))
        start_var.SetRange(v.shift_start * 60, DAY_SECONDS)
        time_dim.SetSpanUpperBoundForVehicle(v.max_shift_minutes * 60, v_i)
        # Prefer leaving late rather than waiting on the road, and short shifts.
        routing.AddVariableMaximizedByFinalizer(start_var)
        routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.End(v_i)))
    time_dim.SetSpanCostCoefficientForAllVehicles(1)

    for s_i, s in enumerate(stops):
        index = manager.NodeToIndex(stop_offset + s_i)
        if s.time_window:
            time_dim.CumulVar(index).SetRange(s.time_window.start * 60, s.time_window.end * 60)
        if s.priority:
            earliest_shift = min(v.shift_start for v in vehicles) * 60
            time_dim.SetCumulVarSoftUpperBound(index, earliest_shift, PRIORITY_EARLINESS_COEFF)
        routing.AddDisjunction([index], PRIORITY_DROP_PENALTY if s.priority else DROP_PENALTY)

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
        )

    routes: list[Route] = []
    assigned: set[str] = set()
    for v_i, v in enumerate(vehicles):
        index = routing.Start(v_i)
        start_time = solution.Min(time_dim.CumulVar(index))
        visits: list[Visit] = []
        distance = 0
        while not routing.IsEnd(index):
            nxt = solution.Value(routing.NextVar(index))
            distance += dist[manager.IndexToNode(index)][manager.IndexToNode(nxt)]
            node = manager.IndexToNode(nxt)
            if node >= stop_offset:
                stop = stops[node - stop_offset]
                assigned.add(stop.id)
                visits.append(Visit(stop_id=stop.id, arrival_minute=solution.Min(time_dim.CumulVar(nxt)) / 60))
            index = nxt
        end_time = solution.Min(time_dim.CumulVar(index))
        routes.append(
            Route(
                vehicle_id=v.id,
                visits=visits,
                distance_meters=distance,
                duration_seconds=max(0, end_time - start_time) if visits else 0,
            )
        )

    return OptimizeResponse(
        routes=routes,
        unassigned_stop_ids=[s.id for s in stops if s.id not in assigned],
        matrix_source=matrix.source,
            matrix_note=matrix.note,
        status="feasible",
        engine="or-tools",
    )
