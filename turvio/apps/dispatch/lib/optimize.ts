import { OptimizeResponse, orderStopsLocally, type TourSummary } from "@turvio/shared";

export interface OptimizationResult {
  stopIds: string[];
  engine: "or-tools" | "local";
  note: string;
}

/**
 * Optimize the remaining stops of a tour. Uses the TURVIO API (OR-Tools)
 * when NEXT_PUBLIC_API_URL is configured; otherwise an in-browser heuristic
 * that ignores time windows – the returned note says which one ran.
 */
export async function optimizeTour(s: TourSummary, fetchImpl: typeof fetch = fetch): Promise<OptimizationResult> {
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  const pending = s.stops.filter((x) => x.status === "pending" && x.location);
  if (api && pending.length > 0) {
    const res = await fetchImpl(`${api}/v1/orgs/${encodeURIComponent(s.tour.organizationId)}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicles: [{ id: s.tour.id, start: s.depot.location, end: s.depot.location, shiftStart: s.tour.plannedStartMinute, maxShiftMinutes: s.driver?.maxShiftMinutes ?? 480 }],
        stops: pending.map((x) => ({ id: x.id, location: x.location, serviceSeconds: x.serviceSeconds, timeWindow: x.timeWindow, priority: x.priority, demand: Math.max(1, x.parcels.length) })),
        timeLimitSeconds: 5,
      }),
    });
    if (!res.ok) throw new Error(`Optimization service returned HTTP ${res.status}`);
    const data = OptimizeResponse.parse(await res.json());
    const ids = data.routes[0]?.visits.map((v) => v.stopId) ?? [];
    return {
      stopIds: ids,
      engine: "or-tools",
      note: `OR-Tools · ${data.matrixSource === "osrm" ? "road network" : "straight-line estimate"}${data.unassignedStopIds.length ? ` · ${data.unassignedStopIds.length} could not be scheduled` : ""}`,
    };
  }
  const local = orderStopsLocally(s.stops, s.depot.location, s.depot.location);
  return {
    stopIds: local.stops.filter((x) => x.status === "pending").map((x) => x.id),
    engine: "local",
    note: "In-browser heuristic (time windows not considered) – API not configured",
  };
}
