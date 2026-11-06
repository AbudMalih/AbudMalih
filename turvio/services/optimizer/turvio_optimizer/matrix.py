"""Travel distance/time matrices.

Two providers:
* OSRM table service (road network) when OSRM_URL is configured.
* Straight-line estimate (haversine x detour factor at an urban average speed)
  as a fallback. Values are estimates and are labelled as such in responses.
"""

from __future__ import annotations

import math
import os
from collections import OrderedDict
from dataclasses import dataclass
from typing import Literal, Sequence

import httpx

from .models import GeoPoint

EARTH_RADIUS_M = 6_371_008.8
# Keep in sync with packages/shared/src/geo.ts
ESTIMATE_DETOUR_FACTOR = 1.35
ESTIMATE_SPEED_KMH = 30.0


@dataclass(frozen=True)
class Matrix:
    distances_m: list[list[int]]
    durations_s: list[list[int]]
    source: Literal["osrm", "haversine_estimate"]
    # Why the estimate was used although OSRM is configured (None when not applicable).
    note: str | None = None


def haversine_m(a: GeoPoint, b: GeoPoint) -> float:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def estimate_matrix(points: Sequence[GeoPoint]) -> Matrix:
    speed_ms = ESTIMATE_SPEED_KMH * 1000 / 3600
    dist: list[list[int]] = []
    dur: list[list[int]] = []
    for a in points:
        drow, trow = [], []
        for b in points:
            m = haversine_m(a, b) * ESTIMATE_DETOUR_FACTOR
            drow.append(int(round(m)))
            trow.append(int(round(m / speed_ms)))
        dist.append(drow)
        dur.append(trow)
    return Matrix(dist, dur, "haversine_estimate")


# OSRM's default --max-table-size is 100; larger requests are split into source chunks.
TABLE_CHUNK = int(os.environ.get("OSRM_TABLE_CHUNK", "100"))
TIMEOUT_S = float(os.environ.get("OSRM_TIMEOUT_SECONDS", "10"))
_CACHE: "OrderedDict[tuple, Matrix]" = OrderedDict()
_CACHE_MAX = 128


def _cache_key(points: Sequence[GeoPoint]) -> tuple:
    # ~1 m precision is enough for identical stop sets to hit the cache.
    return tuple((round(p.lat, 5), round(p.lng, 5)) for p in points)


def osrm_matrix(points: Sequence[GeoPoint], base_url: str, client: httpx.Client | None = None) -> Matrix:
    """Road-network matrix from an OSRM `table` endpoint (chunked by sources)."""
    coords = ";".join(f"{p.lng:.6f},{p.lat:.6f}" for p in points)
    url = f"{base_url.rstrip('/')}/table/v1/driving/{coords}"
    n = len(points)
    own = client is None
    client = client or httpx.Client(timeout=TIMEOUT_S)
    durations: list[list[float | None]] = []
    distances: list[list[float | None]] = []
    try:
        for start in range(0, n, TABLE_CHUNK):
            sources = list(range(start, min(n, start + TABLE_CHUNK)))
            params = {"annotations": "duration,distance"}
            if n > TABLE_CHUNK:
                params["sources"] = ";".join(map(str, sources))
            res = client.get(url, params=params)
            res.raise_for_status()
            data = res.json()
            if data.get("code") != "Ok":
                raise RuntimeError(f"OSRM error: {data.get('code')} {data.get('message', '')}")
            durations.extend(data["durations"])
            distances.extend(data["distances"])
    finally:
        if own:
            client.close()
    if len(durations) != n or len(distances) != n or any(len(r) != n for r in durations):
        raise RuntimeError("OSRM returned a matrix of unexpected size")

    # Unroutable pairs come back as null; make them effectively forbidden.
    big = 10**7

    def clean(rows: list[list[float | None]]) -> list[list[int]]:
        return [[big if v is None else int(round(v)) for v in row] for row in rows]

    return Matrix(clean(distances), clean(durations), "osrm")


def build_matrix(points: Sequence[GeoPoint]) -> Matrix:
    """Road matrix when OSRM_URL is set; on any OSRM failure a labelled straight-line estimate."""
    base_url = os.environ.get("OSRM_URL", "").strip()
    if not base_url:
        return estimate_matrix(points)
    key = _cache_key(points)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    try:
        m = osrm_matrix(points, base_url)
    except Exception as e:  # timeout, connection refused, bad response
        est = estimate_matrix(points)
        return Matrix(est.distances_m, est.durations_s, est.source, f"OSRM unavailable ({type(e).__name__}): straight-line estimate used")
    _CACHE[key] = m
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return m
