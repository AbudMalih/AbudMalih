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


def test_drops_infeasible_stop_instead_of_failing():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    # Window closes before the shift starts -> cannot be served.
    stops[2]["timeWindow"] = {"start": 300, "end": 330}
    res = solve(req(stops))
    assert res.status == "feasible"
    assert res.unassigned_stop_ids == ["c"]


def test_shift_limit_is_enforced():
    # 30 minutes of service per stop, but only a 60-minute shift.
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 1800} for i, la, ln in ERFURT]
    res = solve(req(stops, vehicles=[{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 60}]))
    assert res.routes[0].duration_seconds <= 3600
    assert len(res.unassigned_stop_ids) >= 4


def test_priority_stop_is_served_early():
    stops = [{"id": i, "location": {"lat": la, "lng": ln}, "serviceSeconds": 120} for i, la, ln in ERFURT]
    stops[5]["priority"] = True  # "f" is the far west stop
    res = solve(req(stops))
    assert visit_ids(res)[0] == "f"


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
    assert set(data) == {"routes", "unassignedStopIds", "matrixSource", "matrixNote", "status", "engine"}
    assert len(data["routes"][0]["visits"]) == 3


def test_http_api_rejects_invalid_input():
    client = TestClient(app)
    body = {
        "vehicles": [{"id": "v1", "start": DEPOT, "shiftStart": 480, "maxShiftMinutes": 480}],
        "stops": [{"id": "a", "location": {"lat": 95, "lng": 11}, "serviceSeconds": 60}],
    }
    assert client.post("/optimize", json=body).status_code == 422
