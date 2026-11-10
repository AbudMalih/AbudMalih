"""Road-network matrix: chunking, caching and the labelled fallback (OSRM mocked)."""

import httpx
import pytest

from turvio_optimizer import matrix as m
from turvio_optimizer.models import GeoPoint

PTS = [GeoPoint(lat=52.37 + i * 0.001, lng=9.73 + i * 0.001) for i in range(7)]


def fake_osrm(calls):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        n = len(request.url.path.split("/")[-1].split(";"))
        sources = request.url.params.get("sources")
        rows = [int(x) for x in sources.split(";")] if sources else list(range(n))
        return httpx.Response(200, json={
            "code": "Ok",
            "durations": [[float(abs(i - j) * 60) for j in range(n)] for i in rows],
            "distances": [[float(abs(i - j) * 500) if (i, j) != (0, 6) else None for j in range(n)] for i in rows],
        })
    return handler


def test_chunks_large_tables_and_marks_unroutable_pairs(monkeypatch):
    calls: list[httpx.Request] = []
    monkeypatch.setattr(m, "TABLE_CHUNK", 3)
    client = httpx.Client(transport=httpx.MockTransport(fake_osrm(calls)))
    res = m.osrm_matrix(PTS, "http://osrm.test", client)
    assert len(calls) == 3  # 7 sources in chunks of 3
    assert res.source == "osrm"
    assert res.durations_s[2][5] == 180
    assert res.distances_m[0][6] == 10**7  # null = unroutable -> forbidden


def test_falls_back_to_a_labelled_estimate_when_osrm_fails(monkeypatch):
    monkeypatch.setenv("OSRM_URL", "http://127.0.0.1:9")  # nothing listens here
    monkeypatch.setattr(m, "TIMEOUT_S", 0.5)
    res = m.build_matrix(PTS)
    assert res.source == "haversine_estimate"
    assert res.note and "OSRM unavailable" in res.note


def test_caches_identical_requests(monkeypatch):
    calls: list[httpx.Request] = []
    monkeypatch.setenv("OSRM_URL", "http://osrm.test")
    m._CACHE.clear()
    def counting(pts, url, **_kw):
        calls.append(1)
        return m.Matrix([[0]], [[0]], "osrm")

    monkeypatch.setattr(m, "osrm_matrix", counting)
    m.build_matrix(PTS)
    m.build_matrix(PTS)
    assert len(calls) == 1
