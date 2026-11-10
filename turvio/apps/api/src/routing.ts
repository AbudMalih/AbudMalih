import { haversineMeters, type GeoPoint } from "@turvio/shared";

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
  /** Road leg for each (from, to) pair – one request for all pairs (OSRM table). Optional. */
  pairLegs?(pairs: { from: GeoPoint; to: GeoPoint }[]): Promise<RoadLeg[]>;
  /** Counters for monitoring and benchmarks. Optional. */
  stats?(): RoutingStats;
}

export interface RoutingStats {
  /** route() calls answered from the cache. */
  cacheHits: number;
  /** route() calls that joined an identical request already in flight. */
  sharedInFlight: number;
  /** HTTP requests sent to OSRM: route + table. */
  routeRequests: number;
  tableRequests: number;
  failures: number;
}

export class RoutingUnavailable extends Error {}

/** OSRM answered, but some points are far from any road in its data (wrong/too small region). */
export class RoutingOutOfCoverage extends RoutingUnavailable {
  constructor(
    message: string,
    /** Indexes into the requested points with the snap distance in metres. */
    readonly points: { index: number; snapMeters: number }[],
  ) {
    super(message);
  }
}

export class OsrmRouting implements RoutingProvider {
  readonly name = "osrm";
  private readonly cache = new Map<string, { at: number; route: RoadRoute }>();
  private readonly inFlight = new Map<string, Promise<RoadRoute>>();
  /** "Outside the road data" answers, so a tour with such a stop is not re-requested on every page load. */
  private readonly outOfCoverage = new Map<string, { at: number; error: RoutingOutOfCoverage }>();
  private readonly counters: RoutingStats = { cacheHits: 0, sharedInFlight: 0, routeRequests: 0, tableRequests: 0, failures: 0 };

  stats(): RoutingStats {
    return { ...this.counters };
  }
  constructor(
    private readonly baseUrl: string,
    private readonly opts: { timeoutMs?: number; cacheTtlMs?: number; cacheSize?: number; fetchImpl?: typeof fetch; maxSnapMeters?: number } = {},
  ) {}

  async route(points: GeoPoint[]): Promise<RoadRoute> {
    if (points.length < 2) return { source: "osrm", legs: [], distanceMeters: 0, durationSeconds: 0, geometry: points.map((p) => [p.lat, p.lng]) };
    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const hit = this.cache.get(coords);
    const ttl = this.opts.cacheTtlMs ?? 15 * 60_000;
    if (hit && Date.now() - hit.at < ttl) {
      this.counters.cacheHits++;
      return hit.route;
    }
    const miss = this.outOfCoverage.get(coords);
    if (miss && Date.now() - miss.at < 5 * 60_000) {
      this.counters.cacheHits++;
      throw miss.error;
    }
    // The same route asked for twice at once (two dashboards, dataset + map): one request.
    const pending = this.inFlight.get(coords);
    if (pending) {
      this.counters.sharedInFlight++;
      return pending;
    }
    const p = this.fetchRoute(points, coords).finally(() => this.inFlight.delete(coords));
    this.inFlight.set(coords, p);
    return p;
  }

  private async fetchRoute(points: GeoPoint[], coords: string): Promise<RoadRoute> {
    this.counters.routeRequests++;
    // continue_straight=false: the vehicle may turn around at a stop (OSRM adds its U-turn
    // penalty). The car default (true) forbids that and loops around a block at every waypoint –
    // measured +44 % drive time on a 100-stop Hannover tour – and would no longer match the
    // optimizer's matrix, which plans every stop as reachable and leavable in any direction.
    const url = `${this.baseUrl.replace(/\/$/, "")}/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=false&continue_straight=false`;
    let data: { code?: string; message?: string; waypoints?: { distance?: number }[]; routes?: { distance: number; duration: number; legs: { distance: number; duration: number }[]; geometry: { coordinates: [number, number][] } }[] };
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
      data = (await res.json()) as typeof data;
      if (!res.ok && !data.code) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      this.counters.failures++;
      throw new RoutingUnavailable(`Routing service unavailable: ${(e as Error).message}`);
    }
    const r = data.routes?.[0];
    if (data.code !== "Ok" || !r) throw new RoutingUnavailable(`Routing failed: ${data.code ?? "?"} ${data.message ?? ""}`.trim());
    // OSRM snaps every point to the nearest road in its data, however far away. A point
    // outside the prepared region therefore comes back "Ok" with 0 m legs – reject that.
    const maxSnap = this.opts.maxSnapMeters ?? 1000;
    const far = (data.waypoints ?? []).map((w, index) => ({ index, snapMeters: Math.round(w.distance ?? 0) })).filter((w) => w.snapMeters > maxSnap);
    if (far.length) {
      const km = (Math.max(...far.map((f) => f.snapMeters)) / 1000).toFixed(1);
      const error = new RoutingOutOfCoverage(`${far.length} location(s) are outside the road-routing area (nearest road up to ${km} km away)`, far);
      this.outOfCoverage.set(coords, { at: Date.now(), error });
      if (this.outOfCoverage.size > 200) this.outOfCoverage.delete(this.outOfCoverage.keys().next().value!);
      throw error;
    }
    const spread = points.some((p, i) => i > 0 && haversineMeters(points[0]!, p) > 50);
    if (spread && r.distance === 0) throw new RoutingUnavailable("Routing returned 0 m between distinct locations");
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

  /** One OSRM table request: leg i = pairs[i].from -> pairs[i].to (live position -> next stop). Not cached. */
  async pairLegs(pairs: { from: GeoPoint; to: GeoPoint }[]): Promise<RoadLeg[]> {
    if (!pairs.length) return [];
    const pts = [...pairs.map((p) => p.from), ...pairs.map((p) => p.to)];
    const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const n = pairs.length;
    const sources = pairs.map((_, i) => i).join(";");
    const destinations = pairs.map((_, i) => n + i).join(";");
    const url = `${this.baseUrl.replace(/\/$/, "")}/table/v1/driving/${coords}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`;
    this.counters.tableRequests++;
    let data: { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][]; sources?: { distance?: number }[]; destinations?: { distance?: number }[] };
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
      data = (await res.json()) as typeof data;
    } catch (e) {
      this.counters.failures++;
      throw new RoutingUnavailable(`Routing service unavailable: ${(e as Error).message}`);
    }
    if (data.code !== "Ok" || !data.durations || !data.distances) {
      this.counters.failures++;
      throw new RoutingUnavailable(`Routing failed: ${data.code ?? "?"}`);
    }
    const maxSnap = this.opts.maxSnapMeters ?? 1000;
    return pairs.map((_, i) => {
      const sec = data.durations![i]?.[i];
      const m = data.distances![i]?.[i];
      const snapFar = (data.sources?.[i]?.distance ?? 0) > maxSnap || (data.destinations?.[i]?.distance ?? 0) > maxSnap;
      // Unroutable or off the road data: no leg (the caller then does not use the live position).
      return sec == null || m == null || snapFar ? { meters: NaN, seconds: NaN } : { meters: m, seconds: sec };
    });
  }
}
