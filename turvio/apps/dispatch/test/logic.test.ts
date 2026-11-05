import { createDispatchDataset, summarizeTours } from "@turvio/shared";
import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, applyDraft, createDraftTour, draftChangeCount, driverBusy, nextTourCode, vehicleBusy } from "../lib/draft";
import { getDevSession, loadDispatchData } from "../lib/session";

const NOW = new Date("2026-11-05T10:00:00Z");
const base = createDispatchDataset(NOW);

describe("planning draft", () => {
  it("returns the base dataset untouched without changes", () => {
    expect(applyDraft(base, EMPTY_DRAFT)).toBe(base);
    expect(draftChangeCount(EMPTY_DRAFT)).toBe(0);
  });

  it("creates tours with the next depot code and assigns driver/vehicle", () => {
    expect(nextTourCode(base, "dep_hannover")).toBe("HAN-04");
    const t = createDraftTour(base, { depotId: "dep_hannover", startMinute: 780, driverId: null, vehicleId: null });
    const free = base.drivers.find((d) => d.depotId === "dep_hannover" && d.active && !driverBusy(base, d.id))!;
    const data = applyDraft(base, { ...EMPTY_DRAFT, newTours: [t], assignments: { [t.id]: { driverId: free.id } } });
    const created = data.tours.find((x) => x.id === t.id)!;
    expect(created.name).toBe("HAN-04");
    expect(created.driverId).toBe(free.id);
    expect(driverBusy(data, free.id)?.id).toBe(t.id);
  });

  it("moves unassigned stops onto a tour at the end of its sequence", () => {
    const u = base.unassigned.find((x) => x.depotId === "dep_kassel")!;
    const tour = base.tours.find((x) => x.name === "KAS-01")!;
    const before = base.stops.filter((s) => s.tourId === tour.id).length;
    const data = applyDraft(base, { ...EMPTY_DRAFT, moved: { [u.id]: tour.id } });
    expect(data.unassigned.find((x) => x.id === u.id)).toBeUndefined();
    const moved = data.stops.find((s) => s.id === u.id)!;
    expect(moved.tourId).toBe(tour.id);
    expect(moved.sequence).toBe(before);
  });

  it("applies optimized order to pending stops only and keeps sequences contiguous", () => {
    const tour = base.tours.find((x) => x.name === "HAN-01")!;
    const own = base.stops.filter((s) => s.tourId === tour.id).sort((a, b) => a.sequence - b.sequence);
    const pending = own.filter((s) => s.status === "pending").map((s) => s.id).reverse();
    const data = applyDraft(base, { ...EMPTY_DRAFT, order: { [tour.id]: pending } });
    const after = data.stops.filter((s) => s.tourId === tour.id).sort((a, b) => a.sequence - b.sequence);
    expect(after.filter((s) => s.status !== "pending").map((s) => s.id)).toEqual(own.filter((s) => s.status !== "pending").map((s) => s.id));
    expect(after.filter((s) => s.status === "pending").map((s) => s.id)).toEqual(pending);
    expect(after.map((s) => s.sequence)).toEqual(after.map((_, i) => i));
  });

  it("overrides priority for assigned and unassigned stops", () => {
    const a = base.stops[0]!;
    const u = base.unassigned[0]!;
    const data = applyDraft(base, { ...EMPTY_DRAFT, priority: { [a.id]: !a.priority, [u.id]: !u.priority } });
    expect(data.stops.find((s) => s.id === a.id)!.priority).toBe(!a.priority);
    expect(data.unassigned.find((s) => s.id === u.id)!.priority).toBe(!u.priority);
  });

  it("detects busy vehicles", () => {
    const t = base.tours.find((x) => x.status === "in_progress" && x.vehicleId)!;
    expect(vehicleBusy(base, t.vehicleId!)?.id).toBe(t.id);
    expect(vehicleBusy(base, t.vehicleId!, t.id)).toBeUndefined();
  });
});

describe("server-side session scoping", () => {
  it("gives the default admin every depot", () => {
    const s = getDevSession({});
    expect(s.membership.role).toBe("admin");
    expect(s.companyWide).toBe(true);
    expect(loadDispatchData(s, NOW).depots).toHaveLength(4);
  });

  it("limits a scoped dispatcher before data leaves the server", () => {
    const s = getDevSession({ DISPATCH_DEV_ROLE: "dispatcher", DISPATCH_DEV_DEPOTS: "dep_bremen" });
    expect(s.companyWide).toBe(false);
    const d = loadDispatchData(s, NOW);
    expect(d.depots.map((x) => x.id)).toEqual(["dep_bremen"]);
    expect(d.tours.every((t) => t.depotId === "dep_bremen")).toBe(true);
    expect(d.drivers.every((x) => x.depotId === "dep_bremen")).toBe(true);
    expect(summarizeTours(d).length).toBe(3);
  });

  it("returns no dispatch data for a driver role", () => {
    const d = loadDispatchData(getDevSession({ DISPATCH_DEV_ROLE: "driver" }), NOW);
    expect(d.tours).toHaveLength(0);
    expect(d.depots).toHaveLength(0);
  });
});
