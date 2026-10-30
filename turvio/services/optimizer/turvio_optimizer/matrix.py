"""Travel distance/time matrices.

Two providers:
* OSRM table service (road network) when OSRM_URL is configured.
* Straight-line estimate (haversine x detour factor at an urban average speed)
  as a fallback. Values are estimates and are labelled as such in responses.
"""

from __future__ import annotations

import math
import os
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


def osrm_matrix(points: Sequence[GeoPoint], base_url: str, client: httpx.Client | None = None) -> Matrix:
    """Query an OSRM `table` endpoint. Note: OSRM's default --max-table-size is 100."""
    coords = ";".join(f"{p.lng:.6f},{p.lat:.6f}" for p in points)
    url = f"{base_url.rstrip('/')}/table/v1/driving/{coords}"
    own = client is None
    client = client or httpx.Client(timeout=30)
    try:
        res = client.get(url, params={"annotations": "duration,distance"})
        res.raise_for_status()
        data = res.json()
    finally:
        if own:
            client.close()
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM error: {data.get('code')} {data.get('message', '')}")
    durations = data["durations"]
    distances = data["distances"]
    n = len(points)
    if len(durations) != n or len(distances) != n:
        raise RuntimeError("OSRM returned a matrix of unexpected size")

    # Unroutable pairs come back as null; make them effectively forbidden.
    big = 10**7

    def clean(rows: list[list[float | None]]) -> list[list[int]]:
        return [[big if v is None else int(round(v)) for v in row] for row in rows]

    return Matrix(clean(distances), clean(durations), "osrm")


def build_matrix(points: Sequence[GeoPoint]) -> Matrix:
    base_url = os.environ.get("OSRM_URL", "").strip()
    if base_url:
        return osrm_matrix(points, base_url)
    return estimate_matrix(points)
