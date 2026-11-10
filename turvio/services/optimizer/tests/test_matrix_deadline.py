"""#16: the OSRM matrix respects the optimizer's time budget (timeout, cancellation, fallback)."""

import socket
import threading
import time

import httpx
import pytest

from turvio_optimizer import matrix as m
from turvio_optimizer.models import GeoPoint, OptimizeRequest
from turvio_optimizer.solver import solve

PTS = [GeoPoint(lat=52.37 + i * 0.001, lng=9.73) for i in range(4)]


def table(n: int) -> dict:
    return {"code": "Ok", "durations": [[0 if i == j else 60 for j in range(n)] for i in range(n)], "distances": [[0 if i == j else 500 for j in range(n)] for i in range(n)], "destinations": [{"distance": 5}] * n}


def slow_client(delay_s: float, n: int = 4) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        time.sleep(delay_s)
        return httpx.Response(200, json=table(n))

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_matrix_returns_before_its_deadline_on_a_slow_server():
    t0 = time.monotonic()
    with pytest.raises(m.MatrixDeadline):
        m.osrm_matrix(PTS, "http://osrm.test", slow_client(3.0), deadline=time.monotonic() + 0.3)
    assert time.monotonic() - t0 < 0.6


def test_deadline_already_passed_sends_nothing():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=table(4))

    with pytest.raises(m.MatrixDeadline):
        m.osrm_matrix(PTS, "http://osrm.test", httpx.Client(transport=httpx.MockTransport(handler)), deadline=time.monotonic() - 1)
    assert calls == []


def test_chunked_matrix_stops_at_the_deadline(monkeypatch):
    """First chunk fast, the second slow: the whole matrix is bounded, not each request."""
    monkeypatch.setattr(m, "TABLE_CHUNK", 2)
    seen = []

    def handler(request):
        seen.append(request.url.params.get("sources"))
        if len(seen) > 1:
            time.sleep(2.0)
        rows = table(4)
        rows["durations"] = rows["durations"][:2]
        rows["distances"] = rows["distances"][:2]
        return httpx.Response(200, json=rows)

    t0 = time.monotonic()
    with pytest.raises(m.MatrixDeadline):
        m.osrm_matrix(PTS, "http://osrm.test", httpx.Client(transport=httpx.MockTransport(handler)), deadline=time.monotonic() + 0.4)
    assert time.monotonic() - t0 < 0.7
    assert seen == ["0;1", "2;3"]


def test_hung_socket_is_cancelled_in_time():
    """A real TCP server that accepts and never answers: the request is aborted at the deadline."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    conns = []
    threading.Thread(target=lambda: conns.append(srv.accept()), daemon=True).start()
    t0 = time.monotonic()
    with pytest.raises(m.MatrixDeadline):
        m.osrm_matrix(PTS, f"http://127.0.0.1:{port}", deadline=time.monotonic() + 0.5)
    assert time.monotonic() - t0 < 0.9
    srv.close()


def test_build_matrix_required_routing_fails_in_time_with_routing_unavailable(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://osrm.test")
    monkeypatch.setenv("ROUTING_REQUIRED", "true")
    m._CACHE.clear()
    monkeypatch.setattr(m, "osrm_matrix", lambda pts, url, deadline=None: (_ for _ in ()).throw(m.MatrixDeadline("slow")))
    with pytest.raises(m.RoutingError) as e:
        m.build_matrix(PTS, deadline=time.monotonic() + 0.1)
    assert e.value.code == "routing_unavailable"
    assert "time budget" in e.value.message


def test_build_matrix_without_required_routing_falls_back_labelled(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://osrm.test")
    monkeypatch.delenv("ROUTING_REQUIRED", raising=False)
    m._CACHE.clear()
    monkeypatch.setattr(m, "osrm_matrix", lambda pts, url, deadline=None: (_ for _ in ()).throw(m.MatrixDeadline("slow")))
    res = m.build_matrix(PTS, deadline=time.monotonic() + 0.1)
    assert res.source == "haversine_estimate"
    assert "too slow for the time budget" in res.note


def test_solve_with_a_hung_osrm_stays_within_the_budget(monkeypatch):
    """End to end: a 2 s request against a hung OSRM ends within the budget."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(4)
    port = srv.getsockname()[1]
    monkeypatch.setenv("OSRM_URL", f"http://127.0.0.1:{port}")
    m._CACHE.clear()
    req = OptimizeRequest.model_validate(
        {
            "vehicles": [{"id": "v", "start": {"lat": 52.37, "lng": 9.73}, "shiftStart": 480, "maxShiftMinutes": 480}],
            "stops": [{"id": f"s{i}", "location": {"lat": 52.37 + i * 0.002, "lng": 9.74}, "serviceSeconds": 60} for i in range(12)],
            "timeLimitSeconds": 2,
        }
    )
    # Required routing: a clean error well before the budget ends.
    monkeypatch.setenv("ROUTING_REQUIRED", "true")
    t0 = time.monotonic()
    with pytest.raises(m.RoutingError) as e:
        solve(req)
    assert e.value.code == "routing_unavailable"
    assert time.monotonic() - t0 < 1.3  # matrix share 50 % of 2 s, plus scheduling slack
    # Optional routing: labelled estimate, the whole request inside the budget.
    monkeypatch.delenv("ROUTING_REQUIRED")
    m._CACHE.clear()
    t0 = time.monotonic()
    res = solve(req)
    assert time.monotonic() - t0 <= 2.1
    assert res.matrix_source == "haversine_estimate"
    assert res.timings.matrix_seconds <= 1.1
    srv.close()
