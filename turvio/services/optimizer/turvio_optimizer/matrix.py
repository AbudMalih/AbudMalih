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


class RoutingError(Exception):
    """Road routing could not produce trustworthy values for this request.

    code: routing_out_of_coverage | routing_degenerate | routing_unavailable | routing_not_configured
    point_snaps: (point index, metres OSRM had to move the point to reach a road)
    """

    def __init__(self, code: str, message: str, point_snaps: Sequence[tuple[int, float]] = ()):
        super().__init__(message)
        self.code = code
        self.message = message
        self.point_snaps = list(point_snaps)
        self.points: list[dict] = []  # filled by the solver with stop/vehicle ids


# A point further than this from the nearest routable road is outside the routing data
# (e.g. Suhl against a Region Hannover graph: OSRM still answers "Ok" but snaps every
# point ~165 km away onto the same edge node – all distances and durations become 0).
MAX_SNAP_M = float(os.environ.get("OSRM_MAX_SNAP_METERS", "1000"))


def routing_required() -> bool:
    """ROUTING_REQUIRED=true (staging/production): never fall back to straight-line estimates."""
    return os.environ.get("ROUTING_REQUIRED", "false").strip().lower() == "true"


def _check_coverage(waypoints: Sequence[dict]) -> None:
    far = [(i, float(w.get("distance") or 0)) for i, w in enumerate(waypoints) if float(w.get("distance") or 0) > MAX_SNAP_M]
    if far:
        worst = max(m for _, m in far)
        raise RoutingError(
            "routing_out_of_coverage",
            f"{len(far)} location(s) are outside the road-routing area (nearest routable road up to {worst / 1000:.1f} km away)",
            far,
        )


def _check_not_degenerate(points: Sequence[GeoPoint], durations: list[list[int]]) -> None:
    """Distinct locations with zero travel time everywhere mean the data is unusable."""
    n = len(points)
    spread = any(haversine_m(points[i], points[j]) > 50 for i in range(n) for j in range(i + 1, n))
    if spread and all(durations[i][j] == 0 for i in range(n) for j in range(n) if i != j):
        raise RoutingError("routing_degenerate", "Road routing returned zero distance and time between distinct locations")


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
            if start == 0:
                # `destinations` covers every point (no destinations parameter is sent).
                _check_coverage(data.get("destinations") or data.get("sources") or [])
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

    m = Matrix(clean(distances), clean(durations), "osrm")
    _check_not_degenerate(points, m.durations_s)
    return m


def build_matrix(points: Sequence[GeoPoint]) -> Matrix:
    """Road matrix when OSRM_URL is set.

    Without ROUTING_REQUIRED a failure falls back to a labelled straight-line estimate (`note`
    says why). With ROUTING_REQUIRED=true a RoutingError is raised instead, so an
    optimization never reports success on made-up travel times.
    """
    base_url = os.environ.get("OSRM_URL", "").strip()
    required = routing_required()
    if not base_url:
        if required:
            raise RoutingError("routing_not_configured", "Road routing is required but no routing service is configured")
        return estimate_matrix(points)
    key = _cache_key(points)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    try:
        m = osrm_matrix(points, base_url)
    except RoutingError as e:
        if required:
            raise
        est = estimate_matrix(points)
        return Matrix(est.distances_m, est.durations_s, est.source, f"{e.message}: straight-line estimate used")
    except Exception as e:  # timeout, connection refused, bad response
        if required:
            raise RoutingError("routing_unavailable", f"Road routing service unavailable ({type(e).__name__})") from e
        est = estimate_matrix(points)
        return Matrix(est.distances_m, est.durations_s, est.source, f"OSRM unavailable ({type(e).__name__}): straight-line estimate used")
    _CACHE[key] = m
    if len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return m
