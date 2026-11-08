import httpx
from fastapi.testclient import TestClient

from turvio_optimizer.app import app
from turvio_optimizer.matrix import Matrix, estimate_matrix, osrm_matrix
from turvio_optimizer.models import GeoPoint, OptimizeRequest
from turvio_optimizer.solver import solve

DEPOT = {"lat": 51.0095, "lng": 11.0405}
ERFURT = [
    ("a", 50.9762, 11.0329),
    ("b", 50.9790, 11.0395),
    ("c", 50.9805, 11.0352),
    ("d", 50.9701, 11.0315),
    ("e", 50.9925, 11.0402),
    ("f", 50.9918, 11.0151),
]


def req(stops=None, vehicles=None, **kw):
    return OptimizeRequest.model_validate(
        {
            "vehicles": vehicles
            or [{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480}],
            "stops": stops
            or [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT],
            "timeLimitSeconds": 1,
            **kw,
        }
    )


def visit_ids(res, vehicle=0):
    return [v.stop_id for v in res.routes[vehicle].visits]


def test_visits_every_stop_once():
    res = solve(req())
    assert res.status == "feasible"
    assert sorted(visit_ids(res)) == sorted(i for i, *_ in ERFURT)
    assert res.unassigned_stop_ids == []
    assert res.matrix_source == "haversine_estimate"
    assert res.routes[0].distance_meters > 0


def test_respects_time_windows():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    stops[0]["timeWindow"] = {"start": 600, "end": 620}  # 10:00-10:20
    stops[1]["timeWindow"] = {"start": 480, "end": 500}  # 08:00-08:20
    res = solve(req(stops))
    arrivals = {v.stop_id: v.arrival_minute for v in res.routes[0].visits}
    assert 600 <= arrivals["a"] <= 620
    assert 480 <= arrivals["b"] <= 500
    assert visit_ids(res).index("b") < visit_ids(res).index("a")


def test_unmeetable_deadline_is_served_late_and_reported():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    # Window closes before the shift starts -> cannot be met; the parcel still has to be delivered.
    stops[2]["timeWindow"] = {"start": 300, "end": 330}
    res = solve(req(stops))
    assert res.status == "feasible"
    assert res.unassigned_stop_ids == []
    late = [v for v in res.violations if v.kind == "late"]
    assert [v.stop_id for v in late] == ["c"] and late[0].minutes >= 150
    assert {v.stop_id: v.late_minutes for v in res.routes[0].visits}["c"] == late[0].minutes


def test_strict_time_windows_drop_instead():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    stops[2]["timeWindow"] = {"start": 300, "end": 330}
    res = solve(req(stops, strictTimeWindows=True))
    assert res.unassigned_stop_ids == ["c"]
    assert [(v.kind, v.stop_id) for v in res.violations] == [("unassigned_infeasible", "c")]


def test_shift_limit_is_enforced():
    # 30 minutes of service per stop, but only a 60-minute shift.
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 1800} for i, la, ln in ERFURT]
    res = solve(req(stops, vehicles=[{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 60}]))
    assert res.routes[0].duration_seconds <= 3600
    assert len(res.unassigned_stop_ids) >= 4


def test_express_deadline_is_met_before_cheaper_order():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    # "f" (far west) must be served within the first 15 minutes of the shift.
    stops[5].update(priority=True, timeWindow={"start": 480, "end": 495})
    res = solve(req(stops))
    arrivals = {v.stop_id: v.arrival_minute for v in res.routes[0].visits}
    assert arrivals["f"] <= 495
    assert res.violations == []
    # With a return to the depot the cheapest on-time order starts at "f" itself.
    depot_end = solve(req(stops, vehicles=[{"id": "v1", "start": DEPOT, "end": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480}]))
    assert visit_ids(depot_end)[0] == "f" and depot_end.violations == []


def test_express_without_tight_deadline_does_not_distort_the_route():
    # Priority alone (no deadline) must not force the stop first: no "as early as possible" cost.
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    plain = solve(req(stops))
    stops[5]["priority"] = True
    flagged = solve(req(stops))
    assert flagged.routes[0].drive_seconds <= plain.routes[0].drive_seconds * 1.001


def test_pickup_before_delivery_same_vehicle():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    # Pick up at "e" (north) and deliver to "d" (south), and pick up at "a" before delivering "c".
    res = solve(req(stops, pickupDeliveries=[{"pickupId": "e", "deliveryId": "d"}, {"pickupId": "a", "deliveryId": "c"}]))
    order = visit_ids(res)
    assert order.index("e") < order.index("d") and order.index("a") < order.index("c")
    assert res.unassigned_stop_ids == []


def test_pickup_delivery_pairs_are_validated():
    import pytest
    with pytest.raises(ValueError):
        req(pickupDeliveries=[{"pickupId": "a", "deliveryId": "zz"}])
    with pytest.raises(ValueError):
        req(pickupDeliveries=[{"pickupId": "a", "deliveryId": "b"}, {"pickupId": "a", "deliveryId": "c"}])


def test_soft_shift_keeps_every_stop_and_reports_overtime():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 1800} for i, la, ln in ERFURT]
    res = solve(req(stops, vehicles=[{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 60}], overtimePenaltyPerMinute=600))
    assert res.unassigned_stop_ids == []
    over = [v for v in res.violations if v.kind == "overtime"]
    assert len(over) == 1 and over[0].minutes >= 120
    assert res.routes[0].overtime_minutes == over[0].minutes


def test_route_time_breakdown_adds_up():
    res = solve(req())
    r = res.routes[0]
    assert r.drive_seconds > 0 and r.service_seconds == 120 * len(ERFURT)
    assert abs(r.drive_seconds + r.service_seconds + r.wait_seconds - r.duration_seconds) <= 1
    assert abs((r.end_minute - r.start_minute) - r.duration_seconds / 60) < 1e-6


def test_multiple_vehicles_and_capacity():
    vehicles = [
        {"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480, "capacity": 3},
        {"id": "v2", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480, "capacity": 3},
    ]
    res = solve(req(vehicles=vehicles))
    assert res.unassigned_stop_ids == []
    assert all(len(r.visits) <= 3 for r in res.routes)
    assert sum(len(r.visits) for r in res.routes) == len(ERFURT)


def test_separate_end_depot():
    vehicles = [{"id": "v1", "start": DEPOT, "end": {"lat": 50.9608, "lng": 11.0262}, "shiftStart": 480, "maxShiftMinutes": 480}]
    res = solve(req(vehicles=vehicles))
    assert len(res.routes[0].visits) == len(ERFURT)


def _line_problem(stop_x, end=None, warm_start=None, monkeypatch=None):
    """Depot at x=0, stops on a straight road at the given x (1 unit = 1 km = 60 s)."""
    xs = [0, 0] + list(stop_x)  # [start, end placeholder, stops…]
    dur = [[abs(a - b) * 60 for b in xs] for a in xs]
    dist = [[abs(a - b) * 1000 for b in xs] for a in xs]
    if end is not None:  # an explicit end at x=end
        xs[1] = end
        dur = [[abs(a - b) * 60 for b in xs] for a in xs]
        dist = [[abs(a - b) * 1000 for b in xs] for a in xs]
    if warm_start is not None:
        import turvio_optimizer.solver as S

        monkeypatch.setattr(S, "WARM_START", warm_start)
    vehicle = {"id": "v", "start": {"lat": 0, "lng": 0}, "shiftStart": 480, "maxShiftMinutes": 480}
    if end is not None:
        vehicle["end"] = {"lat": 0, "lng": 0.01}
    stops = [{"id": f"s{x}", "location": {"lat": 0, "lng": 0}, "serviceSeconds": 0} for x in stop_x]
    return solve(req(stops=stops, vehicles=[vehicle]), Matrix(dist, dur, "osrm"))


import pytest  # noqa: E402


@pytest.mark.parametrize("warm_start", ["vroom", "none"])
def test_open_end_finishes_at_the_last_stop(monkeypatch, warm_start):
    # Stops at x=-1 and x=+3. Round trip: either order is 8 km. Open end: -1 first, then +3 = 5 km
    # (+3 first would be 7 km). Before the fix the open end was planned (and reported) as a round trip.
    res = _line_problem([-1, 3], warm_start=warm_start, monkeypatch=monkeypatch)
    r = res.routes[0]
    assert visit_ids(res) == ["s-1", "s3"]
    assert r.distance_meters == 5000
    assert r.drive_seconds == 300
    assert r.end_minute == 480 + 5  # ends when the last stop is done, not after driving back


def test_open_end_does_not_change_a_round_trip():
    # Same stops, explicit end back at the depot: 8 km, the return leg is counted.
    res = _line_problem([-1, 3], end=0)
    assert res.routes[0].distance_meters == 8000


def test_open_end_on_a_one_way_street_line():
    # All stops ahead of the start: open end drives out once (4 km), a round trip twice (8 km).
    open_res = _line_problem([1, 2, 3, 4])
    assert visit_ids(open_res) == ["s1", "s2", "s3", "s4"] and open_res.routes[0].distance_meters == 4000
    assert _line_problem([1, 2, 3, 4], end=0).routes[0].distance_meters == 8000


def test_open_end_does_not_mutate_the_callers_matrix():
    xs = [0, 0, 5]
    dur = [[abs(a - b) * 60 for b in xs] for a in xs]
    m = Matrix([row[:] for row in dur], dur, "osrm")
    solve(req(stops=[{"id": "x", "location": {"lat": 0, "lng": 0}, "serviceSeconds": 0}],
              vehicles=[{"id": "v", "start": {"lat": 0, "lng": 0}, "shiftStart": 480, "maxShiftMinutes": 480}]), m)
    assert m.durations_s[2][1] == 300


def test_uses_given_matrix():
    pts = [GeoPoint(lat=0, lng=0)] * 4
    m = estimate_matrix(pts)
    custom = Matrix(m.distances_m, m.durations_s, "osrm")
    r = req(stops=[{"id": "x", "location": {"lat": 0, "lng": 0}, "serviceSeconds": 0},
                   {"id": "y", "location": {"lat": 0, "lng": 0}, "serviceSeconds": 0}],
            vehicles=[{"id": "v", "start": {"lat": 0, "lng": 0}, "shiftStart": 0, "maxShiftMinutes": 60}])
    assert solve(r, custom).matrix_source == "osrm"


def test_osrm_client_parses_table_and_nulls():
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/table/v1/driving/11.000000,50.000000;11.100000,50.100000" in str(request.url)
        return httpx.Response(200, json={"code": "Ok", "durations": [[0, 60.4], [None, 0]], "distances": [[0, 500], [510, 0]]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    m = osrm_matrix([GeoPoint(lat=50, lng=11), GeoPoint(lat=50.1, lng=11.1)], "http://osrm.test/", client)
    assert m.source == "osrm"
    assert m.durations_s[0][1] == 60
    assert m.durations_s[1][0] == 10**7


def test_http_api_roundtrip_uses_camel_case():
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    body = {
        "vehicles": [{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480}],
        "stops": [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 60} for i, la, ln in ERFURT[:3]],
        "timeLimitSeconds": 1,
    }
    res = client.post("/optimize", json=body)
    assert res.status_code == 200
    data = res.json()
    assert set(data) == {"routes", "unassignedStopIds", "matrixSource", "matrixNote", "status", "engine", "violations", "solveSeconds"}
    assert len(data["routes"][0]["visits"]) == 3


def test_http_api_rejects_invalid_input():
    client = TestClient(app)
    body = {
        "vehicles": [{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480}],
        "stops": [{"id": "a", "location": {"lat": 95, "lng": 11}, "serviceSeconds": 60}],
    }
    assert client.post("/optimize", json=body).status_code == 422


def test_vroom_warm_start_gives_a_complete_valid_route(monkeypatch):
    import pytest

    pytest.importorskip("vroom")
    from turvio_optimizer import solver as S

    monkeypatch.setattr(S, "WARM_START", "vroom")
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    stops[1]["timeWindow"] = {"start": 480, "end": 500}
    res = S.solve(req(stops))
    assert sorted(visit_ids(res)) == sorted(i for i, *_ in ERFURT)
    assert res.violations == []
    # Pairs are not passed to VROOM: the model must still honour them (plain OR-Tools path).
    res = S.solve(req(stops, pickupDeliveries=[{"pickupId": "e", "deliveryId": "d"}]))
    order = visit_ids(res)
    assert order.index("e") < order.index("d")
