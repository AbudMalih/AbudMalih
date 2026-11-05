import { describe, expect, it } from "vitest";
import {
  accessibleDepotIds,
  createDispatchDataset,
  dispatchKpis,
  filterByDepot,
  isPickupConflict,
  pickupRows,
  scopeDispatchDataset,
  summarizeTours,
  tourTimeline,
  type DispatchDataset,
} from "../dispatch";
import { Stop } from "../schemas";

const NOW = new Date("2026-11-05T10:00:00Z");
const data = createDispatchDataset(NOW);

describe("dispatch dataset (synthetic pilot)", () => {
  it("is deterministic and covers the four pilot depots", () => {
    expect(createDispatchDataset(NOW)).toEqual(data);
    expect(data.depots.map((d) => d.name)).toEqual(["Hannover", "Bremen", "Kassel", "Haiger"]);
    expect(data.organizationId).toBe("org_jarbou");
  });
  it("produces valid stops scoped to the tenant and their tour's depot", () => {
    for (const s of data.stops) {
      expect(() => Stop.parse(s)).not.toThrow();
      expect(s.organizationId).toBe("org_jarbou");
    }
    for (const t of data.tours) {
      if (t.driverId) expect(data.drivers.find((d) => d.id === t.driverId)!.depotId).toBe(t.depotId);
      if (t.vehicleId) expect(data.vehicles.find((v) => v.id === t.vehicleId)!.depotId).toBe(t.depotId);
    }
  });
  it("never marks stops completed after the synthetic clock, and planned tours have no progress", () => {
    for (const s of data.stops.filter((x) => x.completedAt)) {
      const [h, m] = s.completedAt!.slice(11, 16).split(":").map(Number);
      expect(h! * 60 + m!).toBeLessThanOrEqual(data.asOfMinute);
    }
    const plannedIds = new Set(data.tours.filter((t) => t.status === "planned").map((t) => t.id));
    expect(data.stops.filter((s) => plannedIds.has(s.tourId)).every((s) => s.status === "pending")).toBe(true);
  });
});

describe("tour timeline", () => {
  const summaries = summarizeTours(data);
  it("projects pending stops in sequence, respecting window starts", () => {
    for (const s of summaries) {
      const pending = s.stops.filter((x) => x.status === "pending");
      const etas = pending.map((x) => s.timeline.projections.get(x.id)!.etaMinute);
      expect([...etas].sort((a, b) => a - b)).toEqual(etas);
      for (const x of pending) if (x.timeWindow) expect(s.timeline.projections.get(x.id)!.etaMinute).toBeGreaterThanOrEqual(x.timeWindow.start);
    }
  });
  it("flags the late-started slow tour as delayed with reasons, and on-time tours not", () => {
    const han2 = summaries.find((s) => s.tour.name === "HAN-02")!;
    expect(han2.status).toBe("delayed");
    expect(han2.timeline.delayReasons.length).toBeGreaterThan(0);
    expect(summaries.find((s) => s.tour.name === "BRE-01")!.status).toBe("in_progress");
    expect(summaries.find((s) => s.tour.name === "BRE-02")!.status).toBe("completed");
  });
  it("detects a projected shift overrun", () => {
    const s = summaries.find((x) => x.tour.name === "HAN-01")!;
    const tiny = { ...s.driver!, maxShiftMinutes: 60 };
    const tl = tourTimeline(s.tour, s.stops, s.depot, tiny, data.asOfMinute);
    expect(tl.delayed).toBe(true);
    expect(tl.delayReasons.join()).toMatch(/shift/);
  });
});

describe("pickups and KPIs", () => {
  it("lists every pickup with a state, ordered by urgency", () => {
    const rows = pickupRows(data);
    const expected = data.stops.filter((s) => s.type === "pickup").length + data.unassigned.filter((u) => u.type === "pickup").length;
    expect(rows).toHaveLength(expected);
    expect(rows[0]!.state).toBe("late");
    expect(rows.filter((r) => r.state === "unassigned").every((r) => r.tourId === null)).toBe(true);
    expect(rows.filter(isPickupConflict).length).toBeGreaterThan(0);
  });
  it("computes KPIs consistent with the summaries", () => {
    const k = dispatchKpis(data);
    const summaries = summarizeTours(data);
    expect(k.totalStops).toBe(summaries.reduce((n, s) => n + s.total, 0));
    expect(k.activeTours).toBe(data.tours.filter((t) => t.status === "in_progress" || t.status === "paused").length);
    expect(k.delayedTours).toBe(1);
    expect(k.availableVehicles).toBe(data.vehicles.length - data.tours.filter((t) => t.status !== "completed" && t.vehicleId).length);
    expect(k.completion).toBeGreaterThan(0.3);
    expect(k.completion).toBeLessThan(0.8);
  });
});

describe("depot scoping", () => {
  const m = (role: "owner" | "admin" | "dispatcher" | "driver", depotIds?: string[] | null, organizationId = "org_jarbou") => ({ organizationId, userId: "u", role, active: true, depotIds });
  it("gives owners/admins every depot and limits scoped dispatchers", () => {
    expect(accessibleDepotIds(m("admin", ["dep_bremen"]), data)).toHaveLength(4);
    expect(accessibleDepotIds(m("dispatcher"), data)).toHaveLength(4);
    expect(accessibleDepotIds(m("dispatcher", ["dep_bremen"]), data)).toEqual(["dep_bremen"]);
  });
  it("denies drivers, inactive members and other tenants", () => {
    expect(accessibleDepotIds(m("driver"), data)).toEqual([]);
    expect(accessibleDepotIds({ ...m("owner"), active: false }, data)).toEqual([]);
    expect(accessibleDepotIds(m("owner", null, "org_muster"), data)).toEqual([]);
    const other: DispatchDataset = scopeDispatchDataset(data, m("owner", null, "org_muster"));
    expect(other.tours).toHaveLength(0);
    expect(other.unassigned).toHaveLength(0);
  });
  it("filters every collection to the allowed depots", () => {
    const scoped = scopeDispatchDataset(data, m("dispatcher", ["dep_kassel"]));
    expect(new Set(scoped.tours.map((t) => t.depotId))).toEqual(new Set(["dep_kassel"]));
    expect(scoped.drivers.every((d) => d.depotId === "dep_kassel")).toBe(true);
    expect(scoped.vehicles.every((v) => v.depotId === "dep_kassel")).toBe(true);
    const tourIds = new Set(scoped.tours.map((t) => t.id));
    expect(scoped.stops.every((s) => tourIds.has(s.tourId))).toBe(true);
    expect(scoped.unassigned.every((u) => u.depotId === "dep_kassel")).toBe(true);
    expect(filterByDepot(data, "dep_haiger").tours.every((t) => t.depotId === "dep_haiger")).toBe(true);
    expect(filterByDepot(data, null)).toBe(data);
  });
});
