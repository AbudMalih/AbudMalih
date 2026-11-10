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
  /** Where each point lands on the road network (location checks). Optional. */
  snapPoints?(points: GeoPoint[]): Promise<SnapPoint[]>;
  /** Nearest road with motorways excluded (approach suggestion). Optional. */
  nearestNonMotorway?(point: GeoPoint): Promise<{ location: GeoPoint; roadName: string; distanceMeters: number } | null>;
  /** Road connection origin → point and point → origin for each point. Optional. */
  reachability?(origin: GeoPoint, points: GeoPoint[]): Promise<{ fromOrigin: boolean; toOrigin: boolean }[]>;
}

export interface SnapPoint {
  distanceMeters: number;
  roadName: string;
  roadRef: string;
  /** OSRM classes of the snapped road; null when they could not be read (fallback lookup). */
  classes: string[] | null;
  snapped: GeoPoint;
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
  /** Location checks: snap route requests, single-point nearest requests, cache hits. */
  snapRequests?: number;
  nearestRequests?: number;
  snapCacheHits?: number;
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
  private readonly counters: Required<RoutingStats> = { cacheHits: 0, sharedInFlight: 0, routeRequests: 0, tableRequests: 0, failures: 0, snapRequests: 0, nearestRequests: 0, snapCacheHits: 0 };
  /** Location-check results per coordinate (the road data does not change while the API runs). */
  private readonly snapCache = new Map<string, { at: number; snap: SnapPoint }>();
  private readonly reachCache = new Map<string, { at: number; reach: { fromOrigin: boolean; toOrigin: boolean } }>();
  private readonly altCache = new Map<string, { at: number; alt: { location: GeoPoint; roadName: string; distanceMeters: number } | null }>();

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

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private async getJson<T>(url: string): Promise<T> {
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000) });
      return (await res.json()) as T;
    } catch (e) {
      this.counters.failures++;
      throw new RoutingUnavailable(`Routing service unavailable: ${(e as Error).message}`);
    }
  }

  private remember<V>(map: Map<string, { at: number } & V>, key: string, value: V) {
    map.set(key, { at: Date.now(), ...value } as { at: number } & V);
    if (map.size > 20_000) map.delete(map.keys().next().value!);
  }

  /**
   * Snap points to the road network with the road's name, ref and OSRM classes (motorway,
   * restricted, …). One route request per 99 points through all of them (each leg's departure
   * step lies on the snapped road); if that route fails (a point without road connection), the
   * points are looked up one by one with /nearest – then the classes are unknown (null).
   */
  async snapPoints(points: GeoPoint[]): Promise<SnapPoint[]> {
    const key = (p: GeoPoint) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
    const ttl = 60 * 60_000;
    const out: (SnapPoint | undefined)[] = points.map((p) => {
      const hit = this.snapCache.get(key(p));
      if (hit && Date.now() - hit.at < ttl) {
        this.counters.snapCacheHits++;
        return hit.snap;
      }
      return undefined;
    });
    const missing = [...new Set(points.filter((_, i) => !out[i]).map(key))];
    for (let i = 0; i < missing.length; i += 99) {
      const chunk = missing.slice(i, i + 99);
      const snaps = await this.snapChunk(chunk);
      chunk.forEach((k, j) => this.remember(this.snapCache, k, { snap: snaps[j]! }));
    }
    return points.map((p, i) => out[i] ?? this.snapCache.get(key(p))!.snap);
  }

  private async snapChunk(coords: string[]): Promise<SnapPoint[]> {
    type Wp = { distance?: number; name?: string; location: [number, number] };
    type Step = { ref?: string; intersections?: { classes?: string[] }[] };
    // Back to the first point at the end, so every point is the start of one leg.
    const chain = coords.length === 1 ? [coords[0]!, coords[0]!] : [...coords, coords[0]!];
    this.counters.snapRequests++;
    const data = await this.getJson<{ code?: string; waypoints?: Wp[]; routes?: { legs: { steps: Step[] }[] }[] }>(
      this.url(`/route/v1/driving/${chain.join(";")}?steps=true&overview=false&continue_straight=false`),
    );
    const legs = data.routes?.[0]?.legs;
    if (data.code === "Ok" && legs && data.waypoints) {
      return coords.map((_, i) => {
        const w = data.waypoints![i]!;
        const dep = legs[i]?.steps[0];
        return {
          distanceMeters: w.distance ?? 0,
          roadName: w.name ?? "",
          roadRef: dep?.ref ?? "",
          classes: dep ? (dep.intersections?.[0]?.classes ?? []) : null,
          snapped: { lat: w.location[1], lng: w.location[0] },
        };
      });
    }
    // No route through all points (e.g. one without road connection to the others): each point on
    // its own (a route from the point to itself still lies on its road, classes included); if even
    // that fails, /nearest – then the classes are unknown. At most 8 requests at a time.
    const one = async (c: string): Promise<SnapPoint> => {
      this.counters.snapRequests++;
      const r = await this.getJson<{ code?: string; waypoints?: Wp[]; routes?: { legs: { steps: Step[] }[] }[] }>(this.url(`/route/v1/driving/${c};${c}?steps=true&overview=false`));
      const w = r.waypoints?.[0];
      const dep = r.routes?.[0]?.legs[0]?.steps[0];
      if (r.code === "Ok" && w && dep)
        return { distanceMeters: w.distance ?? 0, roadName: w.name ?? "", roadRef: dep.ref ?? "", classes: dep.intersections?.[0]?.classes ?? [], snapped: { lat: w.location[1], lng: w.location[0] } };
      this.counters.nearestRequests++;
      const n = await this.getJson<{ code?: string; waypoints?: Wp[] }>(this.url(`/nearest/v1/driving/${c}?number=1`));
      const nw = n.waypoints?.[0];
      if (n.code !== "Ok" || !nw) throw new RoutingUnavailable(`Routing failed: ${n.code ?? "?"}`);
      return { distanceMeters: nw.distance ?? 0, roadName: nw.name ?? "", roadRef: "", classes: null, snapped: { lat: nw.location[1], lng: nw.location[0] } };
    };
    const out: SnapPoint[] = new Array(coords.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, coords.length) }, async () => {
        while (next < coords.length) {
          const i = next++;
          out[i] = await one(coords[i]!);
        }
      }),
    );
    return out;
  }

  /** Nearest road with motorways excluded (OSRM `exclude=motorway`); null if none or unsupported. */
  async nearestNonMotorway(point: GeoPoint): Promise<{ location: GeoPoint; roadName: string; distanceMeters: number } | null> {
    const k = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
    const hit = this.altCache.get(k);
    if (hit && Date.now() - hit.at < 60 * 60_000) return hit.alt;
    this.counters.nearestRequests++;
    const n = await this.getJson<{ code?: string; waypoints?: { distance?: number; name?: string; location: [number, number] }[] }>(this.url(`/nearest/v1/driving/${k}?number=1&exclude=motorway`));
    const w = n.code === "Ok" ? n.waypoints?.[0] : undefined;
    const alt = w ? { location: { lat: w.location[1], lng: w.location[0] }, roadName: w.name ?? "", distanceMeters: w.distance ?? 0 } : null;
    this.remember(this.altCache, k, { alt });
    return alt;
  }

  /** Road connection from the origin to each point and back (one table request per 99 points). */
  async reachability(origin: GeoPoint, points: GeoPoint[]): Promise<{ fromOrigin: boolean; toOrigin: boolean }[]> {
    const o = `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`;
    const key = (p: GeoPoint) => `${o}>${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
    const ttl = 60 * 60_000;
    const missing = [...new Set(points.filter((p) => !((this.reachCache.get(key(p))?.at ?? 0) > Date.now() - ttl)).map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`))];
    for (let i = 0; i < missing.length; i += 99) {
      const chunk = missing.slice(i, i + 99);
      const n = chunk.length;
      this.counters.tableRequests += 2;
      const all = Array.from({ length: n }, (_, j) => j + 1).join(";");
      // Two small tables: origin → points and points → origin.
      const [fwd, back] = await Promise.all([
        this.getJson<{ code?: string; durations?: (number | null)[][] }>(this.url(`/table/v1/driving/${o};${chunk.join(";")}?sources=0&destinations=${all}`)),
        this.getJson<{ code?: string; durations?: (number | null)[][] }>(this.url(`/table/v1/driving/${o};${chunk.join(";")}?sources=${all}&destinations=0`)),
      ]);
      if (fwd.code !== "Ok" || back.code !== "Ok" || !fwd.durations || !back.durations) {
        this.counters.failures++;
        throw new RoutingUnavailable(`Routing failed: ${fwd.code ?? back.code ?? "?"}`);
      }
      chunk.forEach((c, j) => this.remember(this.reachCache, `${o}>${c}`, { reach: { fromOrigin: fwd.durations![0]![j] != null, toOrigin: back.durations![j]![0] != null } }));
    }
    return points.map((p) => this.reachCache.get(key(p))!.reach);
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
