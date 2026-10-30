import {
  OptimizeResponse,
  orderStopsLocally,
  resequence,
  type Depot,
  type OptimizeRequest,
  type Stop,
  type Tour,
} from "@turvio/shared";

export interface OptimizationOutcome {
  stops: Stop[];
  /** "server" = OR-Tools via the TURVIO API, "local" = on-device heuristic. */
  engine: "server" | "local";
  matrixSource?: "osrm" | "haversine_estimate";
  unassignedStopIds: string[];
  unlocatedStopIds: string[];
  /** Set when the server was configured but could not be used. */
  fallbackReason?: string;
}

export interface OptimizeTourInput {
  tour: Tour;
  depot: Depot;
  stops: Stop[];
  maxShiftMinutes: number;
  /** Supabase access token; absent until driver login is implemented (API in AUTH_MODE=dev). */
  accessToken?: string;
  /** Current position for re-optimization; defaults to tour start / depot. */
  from?: { lat: number; lng: number };
}

export function apiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function buildOptimizeRequest(input: OptimizeTourInput): OptimizeRequest {
  const start = input.from ?? input.tour.startLocation ?? input.depot.location;
  const pending = input.stops.filter((s) => s.status === "pending" && s.location);
  const shiftStart = input.tour.status === "planned" ? input.tour.plannedStartMinute : minutesNow();
  return {
    vehicles: [
      {
        id: input.tour.id,
        start,
        end: input.tour.endLocation ?? input.depot.location,
        shiftStart,
        maxShiftMinutes: input.maxShiftMinutes,
      },
    ],
    stops: pending.map((s) => ({
      id: s.id,
      location: s.location!,
      serviceSeconds: s.serviceSeconds,
      timeWindow: s.timeWindow,
      priority: s.priority,
      demand: Math.max(1, s.parcels.length),
    })),
    timeLimitSeconds: 5,
  };
}

/** Apply a server route to the stop list: done stops first, then route order, then the rest. */
export function applyServerRoute(stops: Stop[], response: OptimizeResponse): Stop[] {
  const byId = new Map(stops.map((s) => [s.id, s]));
  const done = stops.filter((s) => s.status !== "pending");
  const routed = (response.routes[0]?.visits ?? [])
    .map((v) => byId.get(v.stopId))
    .filter((s): s is Stop => !!s && s.status === "pending");
  const routedIds = new Set(routed.map((s) => s.id));
  const rest = stops.filter((s) => s.status === "pending" && !routedIds.has(s.id));
  return resequence([...done, ...routed, ...rest]);
}

export async function optimizeTour(
  input: OptimizeTourInput,
  fetchImpl: typeof fetch = fetch,
): Promise<OptimizationOutcome> {
  const start = input.from ?? input.tour.startLocation ?? input.depot.location;
  const unlocatedStopIds = input.stops.filter((s) => s.status === "pending" && !s.location).map((s) => s.id);
  const base = apiBaseUrl();
  let fallbackReason: string | undefined;

  const pendingLocated = input.stops.filter((s) => s.status === "pending" && s.location);
  if (base && pendingLocated.length > 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      // The tenant is always explicit in the URL; the API checks membership + role.
      const url = `${base}/v1/orgs/${encodeURIComponent(input.tour.organizationId)}/optimize`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (input.accessToken) headers.Authorization = `Bearer ${input.accessToken}`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildOptimizeRequest(input)),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = OptimizeResponse.parse(await res.json());
      if (parsed.status === "no_solution") throw new Error("no feasible solution");
      return {
        stops: applyServerRoute(input.stops, parsed),
        engine: "server",
        matrixSource: parsed.matrixSource,
        unassignedStopIds: parsed.unassignedStopIds,
        unlocatedStopIds,
      };
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
  }

  const local = orderStopsLocally(input.stops, start, input.tour.endLocation ?? input.depot.location);
  return {
    stops: local.stops,
    engine: "local",
    matrixSource: "haversine_estimate",
    unassignedStopIds: [],
    unlocatedStopIds: local.unlocatedStopIds,
    fallbackReason,
  };
}
