import {
  DEFAULT_LOCATION_THRESHOLDS,
  coordinateIssues,
  duplicateCoordinates,
  evaluateStopLocation,
  type AddressEvidence,
  type Evidence,
  type GeoPoint,
  type LocationThresholds,
  type ReachEvidence,
  type RoadSnapEvidence,
  type StopLocationCheck,
} from "@turvio/shared";
import { PostgresGeocoder, type Geocoder } from "./geocode";
import type { RoutingProvider, RoutingStats } from "./routing";

/**
 * Location checks for stops (P0-3.1): gathers evidence from OSRM (road snap with name, ref and
 * classes; nearest non-motorway road; road connection to the tour start) and from our own OSM
 * address data, then applies the shared rules (packages/shared/src/location/checks.ts).
 *
 * - Read-only: never changes a stop, its address or its coordinate.
 * - Bounded: a request waits at most `budgetMs`; unfinished checks are reported as "pending" and
 *   keep running in the background (results are cached per coordinate / address).
 * - Missing services are "unavailable" (status "partial"), never "checked".
 */

export interface CheckStop {
  id: string;
  location: GeoPoint | null;
  address: { street: string; houseNumber?: string | null; postalCode: string; city: string; countryCode?: string };
}

export interface CheckGroup {
  /** Tour start (or the depot for unassigned stops): road connection is checked from/to here. */
  origin: GeoPoint | null;
  stops: CheckStop[];
}

export interface LocationCheckReport {
  stops: number;
  ms: number;
  pending: number;
  routing?: Partial<RoutingStats>;
}

type Settled<T> = { state: "done"; value: T } | { state: "pending" } | { state: "unavailable"; reason: string };

/** A promise whose outcome can be read synchronously once settled. */
class Tracked<T> {
  outcome: Settled<T> = { state: "pending" };
  readonly promise: Promise<void>;
  /** `onFail` drops the cached entry so the next request tries again (transient OSRM/database errors). */
  constructor(p: Promise<T>, failReason: string, onFail?: () => void) {
    this.promise = p.then(
      (value) => void (this.outcome = { state: "done", value }),
      () => {
        this.outcome = { state: "unavailable", reason: failReason };
        onFail?.();
      },
    );
  }
}

const pointKey = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const addressKey = (a: CheckStop["address"]) => `${a.street}|${a.houseNumber ?? ""}|${a.postalCode}`.toLowerCase();

export class LocationChecker {
  private readonly snaps = new Map<string, Tracked<RoadSnapEvidence>>();
  private readonly reach = new Map<string, Tracked<ReachEvidence>>();
  private readonly addresses = new Map<string, Tracked<AddressEvidence>>();
  readonly thresholds: LocationThresholds;

  constructor(
    private readonly routing: RoutingProvider | undefined,
    private readonly geocoder: Geocoder | undefined,
    private readonly opts: { budgetMs?: number; addressConcurrency?: number; thresholds?: Partial<LocationThresholds> } = {},
  ) {
    this.thresholds = { ...DEFAULT_LOCATION_THRESHOLDS, ...opts.thresholds };
  }

  private get canSnap() {
    return !!this.routing?.snapPoints;
  }
  private get canAddress() {
    return this.geocoder instanceof PostgresGeocoder;
  }

  /** Start (or join) the checks for these points; returns at once. */
  private startSnaps(points: GeoPoint[]) {
    if (!this.canSnap) return;
    const todo = [...new Map(points.filter((p) => !this.snaps.has(pointKey(p))).map((p) => [pointKey(p), p])).values()];
    if (!todo.length) return;
    const batch = this.routing!.snapPoints!(todo);
    todo.forEach((p, i) => {
      const one = batch.then(async (all) => {
        const s = all[i]!;
        const nonMotorway = s.classes?.includes("motorway") && this.routing!.nearestNonMotorway ? await this.routing!.nearestNonMotorway(p).catch(() => null) : undefined;
        return { distanceMeters: s.distanceMeters, roadName: s.roadName, roadRef: s.roadRef, classes: s.classes, snapped: s.snapped, ...(nonMotorway !== undefined ? { nonMotorway } : {}) };
      });
      this.snaps.set(pointKey(p), new Tracked(one, "road routing unavailable", () => this.snaps.delete(pointKey(p))));
    });
    this.trim(this.snaps);
  }

  private startReach(origin: GeoPoint, points: GeoPoint[]) {
    if (!this.routing?.reachability) return;
    const k = (p: GeoPoint) => `${pointKey(origin)}>${pointKey(p)}`;
    const todo = [...new Map(points.filter((p) => !this.reach.has(k(p))).map((p) => [k(p), p])).values()];
    if (!todo.length) return;
    const batch = this.routing.reachability(origin, todo);
    todo.forEach((p, i) => this.reach.set(k(p), new Tracked(batch.then((r) => r[i]!), "road routing unavailable", () => this.reach.delete(k(p)))));
    this.trim(this.reach);
  }

  private startAddresses(stops: CheckStop[]) {
    if (!this.canAddress) return;
    const geo = this.geocoder as PostgresGeocoder;
    const todo = [...new Map(stops.filter((s) => !this.addresses.has(addressKey(s.address))).map((s) => [addressKey(s.address), s])).values()];
    // Limited parallelism: the address data lives in the same database as everything else.
    const limit = this.opts.addressConcurrency ?? 4;
    let active = 0;
    const queue: (() => void)[] = [];
    const slot = <T>(fn: () => Promise<T>) =>
      new Promise<T>((resolve, reject) => {
        const run = () => {
          active++;
          fn()
            .then(resolve, reject)
            .finally(() => {
              active--;
              queue.shift()?.();
            });
        };
        if (active < limit) run();
        else queue.push(run);
      });
    for (const s of todo) {
      const p = slot(async (): Promise<AddressEvidence> => {
        const hit = await geo.exact({ street: s.address.street, houseNumber: s.address.houseNumber ?? undefined, postalCode: s.address.postalCode });
        return hit ? { precision: hit.precision, location: hit.location } : null;
      });
      this.addresses.set(addressKey(s.address), new Tracked(p, "address data unavailable", () => this.addresses.delete(addressKey(s.address))));
    }
    this.trim(this.addresses);
  }

  private trim(map: Map<string, unknown>) {
    while (map.size > 50_000) map.delete(map.keys().next().value!);
  }

  /** Warm the caches after stops were created or moved (no tour context needed). Never throws. */
  warm(stops: CheckStop[]): void {
    const located = stops.filter((s) => s.location && coordinateIssues(s.location, s.address.countryCode).length === 0);
    this.startSnaps(located.map((s) => s.location!));
    this.startAddresses(located);
  }

  async check(groups: CheckGroup[], budgetMs = this.opts.budgetMs ?? 1500): Promise<{ checks: StopLocationCheck[]; report: LocationCheckReport }> {
    const t0 = Date.now();
    const before = this.routing?.stats?.();
    const all = groups.flatMap((g) => g.stops);
    const valid = (s: CheckStop) => !!s.location && coordinateIssues(s.location, s.address.countryCode).length === 0;
    this.startSnaps(all.filter(valid).map((s) => s.location!));
    for (const g of groups) if (g.origin) this.startReach(g.origin, g.stops.filter(valid).map((s) => s.location!));
    this.startAddresses(all.filter(valid));

    const waiting: Promise<void>[] = [];
    for (const g of groups)
      for (const s of g.stops.filter(valid)) {
        const sn = this.snaps.get(pointKey(s.location!));
        const re = g.origin ? this.reach.get(`${pointKey(g.origin)}>${pointKey(s.location!)}`) : undefined;
        const ad = this.addresses.get(addressKey(s.address));
        for (const t of [sn, re, ad]) if (t && t.outcome.state === "pending") waiting.push(t.promise);
      }
    if (waiting.length) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([Promise.all(waiting), new Promise((r) => (timer = setTimeout(r, budgetMs)))]);
      clearTimeout(timer);
    }

    const dup = duplicateCoordinates(all.map((s) => ({ id: s.id, location: s.location, addressKey: addressKey(s.address) })));
    const ev = <T>(t: Tracked<T> | undefined, missing: string): Evidence<T> => (t ? t.outcome : { state: "unavailable", reason: missing });
    const checks = groups.flatMap((g) =>
      g.stops.map((s) =>
        evaluateStopLocation(
          {
            stopId: s.id,
            location: s.location,
            street: s.address.street,
            countryCode: s.address.countryCode,
            road: s.location ? ev(this.snaps.get(pointKey(s.location)), this.canSnap ? "road routing unavailable" : "no road routing configured") : { state: "unavailable", reason: "no location" },
            reach: s.location && g.origin ? ev(this.reach.get(`${pointKey(g.origin)}>${pointKey(s.location)}`), this.routing?.reachability ? "road routing unavailable" : "no road routing configured") : { state: "unavailable", reason: g.origin ? "no location" : "no tour start" },
            address: s.location ? ev(this.addresses.get(addressKey(s.address)), this.canAddress ? "address data unavailable" : "no local address data configured") : { state: "unavailable", reason: "no location" },
            duplicateOf: dup.get(s.id),
          },
          this.thresholds,
        ),
      ),
    );
    const after = this.routing?.stats?.();
    const delta = before && after ? (Object.fromEntries(Object.entries(after).map(([k, v]) => [k, (v as number) - ((before as unknown as Record<string, number>)[k] ?? 0)])) as Partial<RoutingStats>) : undefined;
    return { checks, report: { stops: all.length, ms: Date.now() - t0, pending: checks.filter((c) => c.status === "pending").length, ...(delta ? { routing: delta } : {}) } };
  }
}
