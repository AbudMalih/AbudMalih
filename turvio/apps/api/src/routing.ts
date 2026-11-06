import type { GeoPoint } from "@turvio/shared";

/**
 * Road-network routing (OSRM `route` service): distances, travel times and
 * geometry for an ordered list of points. Self-hosted OSRM with a Germany
 * extract (see docs/HOSTING.md). Without OSRM the API answers
 * `source: "none"` and the apps show labelled straight-line estimates.
 */
export interface RoadLeg {
  meters: number;
  seconds: number;
}

export interface RoadRoute {
  source: "osrm";
  legs: RoadLeg[];
  distanceMeters: number;
  durationSeconds: number;
  /** [lat, lng] pairs, simplified by OSRM ("overview=simplified"). */
  geometry: [number, number][];
}

export interface RoutingProvider {
  readonly name: string;
  route(points: GeoPoint[]): Promise<RoadRoute>;
}

export class RoutingUnavailable extends Error {}

export class OsrmRouting implements RoutingProvider {
  readonly name = "osrm";
  private readonly cache = new Map<string, { at: number; route: RoadRoute }>();
  constructor(
    private readonly baseUrl: string,
    private readonly opts: { timeoutMs?: number; cacheTtlMs?: number; cacheSize?: number; fetchImpl?: typeof fetch } = {},
  ) {}

  async route(points: GeoPoint[]): Promise<RoadRoute> {
    if (points.length < 2) return { source: "osrm", legs: [], distanceMeters: 0, durationSeconds: 0, geometry: points.map((p) => [p.lat, p.lng]) };
    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const hit = this.cache.get(coords);
    const ttl = this.opts.cacheTtlMs ?? 15 * 60_000;
    if (hit && Date.now() - hit.at < ttl) return hit.route;
    const url = `${this.baseUrl.replace(/\/$/, "")}/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=false&continue_straight=default`;
    let data: { code?: string; message?: string; routes?: { distance: number; duration: number; legs: { distance: number; duration: number }[]; geometry: { coordinates: [number, number][] } }[] };
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
      data = (await res.json()) as typeof data;
      if (!res.ok && !data.code) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      throw new RoutingUnavailable(`Routing service unavailable: ${(e as Error).message}`);
    }
    const r = data.routes?.[0];
    if (data.code !== "Ok" || !r) throw new RoutingUnavailable(`Routing failed: ${data.code ?? "?"} ${data.message ?? ""}`.trim());
    const route: RoadRoute = {
      source: "osrm",
      legs: r.legs.map((l) => ({ meters: l.distance, seconds: l.duration })),
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
    this.cache.set(coords, { at: Date.now(), route });
    if (this.cache.size > (this.opts.cacheSize ?? 300)) this.cache.delete(this.cache.keys().next().value!);
    return route;
  }
}
