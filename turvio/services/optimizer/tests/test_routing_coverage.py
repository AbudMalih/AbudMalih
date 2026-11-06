"""Road-routing coverage: points outside the OSRM data must never yield a 'successful'
optimization with zero distances (the Suhl-vs-Hannover-graph staging incident)."""

import os

import httpx
import pytest
from fastapi.testclient import TestClient

from turvio_optimizer import matrix as m
from turvio_optimizer.app import app
from turvio_optimizer.models import GeoPoint

# Depot + 5 stops in Suhl (Thuringia).
SUHL = [(50.6106, 10.6936), (50.6040, 10.7012), (50.6180, 10.6850), (50.6155, 10.7105), (50.6060, 10.6790), (50.6230, 10.6960)]
HANNOVER = [(52.3759, 9.7320), (52.3170, 9.8045), (52.3920, 9.6990)]


def osrm_snapping_everything_to_one_node(snap_m: float):
    """What OSRM with a Region Hannover graph answers for Suhl: Ok, all zeros, ~165 km snaps."""
    def handler(request: httpx.Request) -> httpx.Response:
        n = len(request.url.path.split("/")[-1].split(";"))
        wp = [{"distance": snap_m, "location": [10.1535, 52.0656]} for _ in range(n)]
        return httpx.Response(200, json={"code": "Ok", "durations": [[0.0] * n for _ in range(n)], "distances": [[0.0] * n for _ in range(n)], "sources": wp, "destinations": wp})
    return handler


def pts(coords):
    return [GeoPoint(lat=a, lng=b) for a, b in coords]


def test_points_far_from_any_road_are_out_of_coverage():
    client = httpx.Client(transport=httpx.MockTransport(osrm_snapping_everything_to_one_node(165_000)))
    with pytest.raises(m.RoutingError) as e:
        m.osrm_matrix(pts(SUHL), "http://osrm.test", client)
    assert e.value.code == "routing_out_of_coverage"
    assert [i for i, _ in e.value.point_snaps] == list(range(6))
    assert "165.0 km" in e.value.message


def test_zero_durations_between_distinct_points_are_rejected():
    # Snaps look fine, but every travel time is 0 – never accept that as a road matrix.
    client = httpx.Client(transport=httpx.MockTransport(osrm_snapping_everything_to_one_node(3)))
    with pytest.raises(m.RoutingError) as e:
        m.osrm_matrix(pts(SUHL), "http://osrm.test", client)
    assert e.value.code == "routing_degenerate"


def test_without_routing_required_the_fallback_is_labelled(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://osrm.test")
    monkeypatch.delenv("ROUTING_REQUIRED", raising=False)
    monkeypatch.setattr(m, "osrm_matrix", lambda points, base: (_ for _ in ()).throw(m.RoutingError("routing_out_of_coverage", "6 location(s) are outside the road-routing area", [(0, 1.0)])))
    res = m.build_matrix(pts(SUHL[:2]) + [GeoPoint(lat=50.6, lng=10.7)])
    assert res.source == "haversine_estimate"
    assert res.note and "outside the road-routing area" in res.note


def _request():
    return {
        "vehicles": [{"id": "veh-1", "start": {"lat": SUHL[0][0], "lng": SUHL[0][1]}, "shiftStart": 480, "maxShiftMinutes": 600}],
        "stops": [{"id": f"stop-{i}", "location": {"lat": a, "lng": b}, "serviceSeconds": 120} for i, (a, b) in enumerate(SUHL[1:], 1)],
        "timeLimitSeconds": 1,
    }


def test_optimize_answers_422_with_the_affected_stops_when_routing_is_required(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://osrm.test")
    monkeypatch.setenv("ROUTING_REQUIRED", "true")
    m._CACHE.clear()
    real = m.osrm_matrix
    monkeypatch.setattr(m, "osrm_matrix", lambda points, base: real(points, base, httpx.Client(transport=httpx.MockTransport(osrm_snapping_everything_to_one_node(165_000)))))
    r = TestClient(app).post("/optimize", json=_request())
    assert r.status_code == 422
    d = r.json()["detail"]
    assert d["code"] == "routing_out_of_coverage"
    assert {p["stopId"] for p in d["points"] if p["kind"] == "stop"} == {f"stop-{i}" for i in range(1, 6)}
    assert any(p["kind"] == "vehicle_start" and p["vehicleId"] == "veh-1" for p in d["points"])


def test_optimize_answers_503_when_routing_is_required_but_unavailable(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("ROUTING_REQUIRED", "true")
    monkeypatch.setattr(m, "TIMEOUT_S", 0.5)
    m._CACHE.clear()
    r = TestClient(app).post("/optimize", json=_request())
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "routing_unavailable"


@pytest.mark.skipif(not os.environ.get("OSRM_TEST_URL"), reason="needs a real OSRM (OSRM_TEST_URL)")
def test_against_a_real_osrm():
    url = os.environ["OSRM_TEST_URL"]
    expect = os.environ.get("OSRM_TEST_EXPECT_SUHL", "out_of_coverage")  # "routable" with a Germany graph
    h = m.osrm_matrix(pts(HANNOVER), url)
    assert h.source == "osrm" and max(max(r) for r in h.durations_s) > 300
    if expect == "routable":
        s = m.osrm_matrix(pts(SUHL), url)
        assert max(max(r) for r in s.distances_m) > 1000
    else:
        with pytest.raises(m.RoutingError) as e:
            m.osrm_matrix(pts(SUHL), url)
        assert e.value.code == "routing_out_of_coverage"
