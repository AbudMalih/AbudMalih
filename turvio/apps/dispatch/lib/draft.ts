import { resequence, sortBySequence, type DispatchDataset, type Stop, type Tour } from "@turvio/shared";

/**
 * Local planning draft. Planning edits are applied on top of the server data
 * in the browser only – there is no write API for tours yet. The UI labels
 * this as an unsaved draft.
 */
export interface PlanDraft {
  newTours: Tour[];
  assignments: Record<string, { driverId?: string | null; vehicleId?: string | null }>;
  /** Unassigned stop id -> tour id. */
  moved: Record<string, string>;
  /** Stop id -> priority override. */
  priority: Record<string, boolean>;
  /** Tour id -> ordered pending stop ids (from optimization). */
  order: Record<string, string[]>;
}

export const EMPTY_DRAFT: PlanDraft = { newTours: [], assignments: {}, moved: {}, priority: {}, order: {} };

export function draftChangeCount(d: PlanDraft): number {
  return d.newTours.length + Object.keys(d.assignments).length + Object.keys(d.moved).length + Object.keys(d.priority).length + Object.keys(d.order).length;
}

export function applyDraft(base: DispatchDataset, draft: PlanDraft): DispatchDataset {
  if (draftChangeCount(draft) === 0) return base;
  const tours = [...base.tours, ...draft.newTours].map((t) => {
    const a = draft.assignments[t.id];
    return a ? { ...t, driverId: a.driverId !== undefined ? a.driverId : t.driverId, vehicleId: a.vehicleId !== undefined ? a.vehicleId : t.vehicleId } : t;
  });
  let stops: Stop[] = base.stops.map((s) => (s.id in draft.priority ? { ...s, priority: draft.priority[s.id]! } : s));
  const unassigned = base.unassigned
    .filter((u) => !(u.id in draft.moved))
    .map((u) => (u.id in draft.priority ? { ...u, priority: draft.priority[u.id]! } : u));
  for (const u of base.unassigned) {
    const tourId = draft.moved[u.id];
    if (!tourId) continue;
    const { depotId: _d, ...rest } = u;
    const next = stops.filter((s) => s.tourId === tourId).length;
    stops.push({ ...rest, priority: draft.priority[u.id] ?? u.priority, tourId, sequence: next });
  }
  for (const [tourId, ids] of Object.entries(draft.order)) {
    const own = sortBySequence(stops.filter((s) => s.tourId === tourId));
    const done = own.filter((s) => s.status !== "pending");
    const byId = new Map(own.map((s) => [s.id, s]));
    const ordered = ids.map((id) => byId.get(id)).filter((s): s is Stop => !!s && s.status === "pending");
    const rest = own.filter((s) => s.status === "pending" && !ids.includes(s.id));
    const reseq = resequence([...done, ...ordered, ...rest]);
    stops = [...stops.filter((s) => s.tourId !== tourId), ...reseq];
  }
  return { ...base, tours, stops, unassigned };
}

/** Tours (not completed) that already use this driver / vehicle. */
export function driverBusy(data: DispatchDataset, driverId: string, exceptTourId?: string): Tour | undefined {
  return data.tours.find((t) => t.driverId === driverId && t.status !== "completed" && t.id !== exceptTourId);
}
export function vehicleBusy(data: DispatchDataset, vehicleId: string, exceptTourId?: string): Tour | undefined {
  return data.tours.find((t) => t.vehicleId === vehicleId && t.status !== "completed" && t.id !== exceptTourId);
}

export function nextTourCode(data: DispatchDataset, depotId: string): string {
  const prefix = depotId.replace(/^dep_/, "").slice(0, 3).toUpperCase();
  const used = data.tours.filter((t) => t.name.startsWith(`${prefix}-`)).map((t) => Number(t.name.split("-")[1]) || 0);
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}

export function createDraftTour(data: DispatchDataset, input: { depotId: string; startMinute: number; driverId: string | null; vehicleId: string | null }): Tour {
  const name = nextTourCode(data, input.depotId);
  return {
    id: `draft_${name.toLowerCase().replace("-", "_")}`,
    organizationId: data.organizationId,
    name,
    date: data.date,
    depotId: input.depotId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    status: "planned",
    plannedStartMinute: input.startMinute,
  };
}

/** Distinct, accessible route colours (blue first = brand). */
export const ROUTE_COLORS = ["#2563EB", "#7C3AED", "#0D9488", "#D97706", "#DB2777", "#059669", "#EA580C", "#4F46E5", "#0891B2", "#BE123C", "#65A30D", "#9333EA"];

export function tourColor(data: Pick<DispatchDataset, "tours">, tourId: string): string {
  const i = data.tours.findIndex((t) => t.id === tourId);
  return ROUTE_COLORS[(i < 0 ? 0 : i) % ROUTE_COLORS.length]!;
}
