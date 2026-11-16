import type { Stop, Tour } from "@turvio/shared";
import { diffTours } from "../src/lib/tourChanges";

/** Remote changes are reported to the driver; the driver's own pending actions are not. */
const tour = (id: string, over: Partial<Tour> = {}): Tour =>
  ({ id, organizationId: "o", name: id.toUpperCase(), date: "2026-11-16", depotId: "d", driverId: "drv", vehicleId: null, status: "in_progress", plannedStartMinute: 480, origin: "dispatch", ...over }) as Tour;
const stop = (id: string, tourId: string, sequence: number, status: Stop["status"] = "pending"): Stop =>
  ({ id, organizationId: "o", tourId, type: "delivery", sequence, address: { street: "A", postalCode: "30159", city: "H", countryCode: "DE" }, location: null, serviceSeconds: 120, priority: false, parcels: [], status }) as Stop;

const prev = { tours: [tour("t1"), tour("t2", { status: "planned" })], stops: [stop("a", "t1", 0), stop("b", "t1", 1), stop("c", "t1", 2), stop("x", "t2", 0)] };

describe("dispatch changes since the last sync", () => {
  it("nothing changed → nothing reported", () => {
    expect(diffTours(prev, prev, [], "2026-11-16")).toEqual([]);
  });

  it("a tour gone from the list (withdrawn / cancelled / reassigned / moved)", () => {
    expect(diffTours(prev, { tours: [prev.tours[0]!], stops: prev.stops.filter((s) => s.tourId === "t1") }, [], "2026-11-16")).toEqual([{ kind: "removed", tourId: "t2", tourName: "T2" }]);
  });

  it("yesterday's tours leaving the list at midnight are not a change", () => {
    const old = { tours: [tour("t9", { date: "2026-11-15", status: "planned" })], stops: [] };
    expect(diffTours(old, { tours: [], stops: [] }, [], "2026-11-16")).toEqual([]);
  });

  it("finished by dispatch, with the reason", () => {
    const next = { tours: [tour("t1", { status: "completed", closedRemotely: true, closeReason: "Schicht beendet" }), prev.tours[1]!], stops: prev.stops };
    expect(diffTours(prev, next, [], "2026-11-16")).toEqual([{ kind: "finished", tourId: "t1", tourName: "T1", reason: "Schicht beendet" }]);
  });

  it("the driver finishing the tour themselves is not reported", () => {
    const next = { tours: [tour("t1", { status: "completed" }), prev.tours[1]!], stops: prev.stops };
    expect(diffTours(prev, next, [{ id: "1", kind: "tour_status", tourId: "t1", status: "completed", at: "x", orgId: "o" } as never], "2026-11-16")).toEqual([]);
  });

  it("stops added, and stops removed or cancelled (cancelled stops leave the feed)", () => {
    const next = { tours: prev.tours, stops: [stop("a", "t1", 0), stop("c", "t1", 1), stop("d", "t1", 2), stop("e", "t1", 3), stop("x", "t2", 0)] };
    expect(diffTours(prev, next, [], "2026-11-16")).toEqual([
      { kind: "stops_added", tourId: "t1", tourName: "T1", count: 2 },
      { kind: "stops_removed", tourId: "t1", tourName: "T1", count: 1 },
    ]);
  });

  it("stops the driver removed or added themselves are not dispatch changes", () => {
    const next = { tours: prev.tours, stops: [stop("a", "t1", 0), stop("c", "t1", 1), stop("n", "t1", 2), stop("x", "t2", 0)] };
    const own = [
      { id: "1", kind: "stop_remove", stopId: "b" },
      { id: "2", kind: "create_stops", tourId: "t1", stops: [{ id: "n" }] },
    ] as never[];
    expect(diffTours(prev, next, own, "2026-11-16")).toEqual([]);
  });

  it("dispatch re-ordered the open stops (re-optimization) – the driver's own re-order is not reported", () => {
    const next = { tours: prev.tours, stops: [stop("c", "t1", 0), stop("a", "t1", 1), stop("b", "t1", 2), stop("x", "t2", 0)] };
    expect(diffTours(prev, next, [], "2026-11-16")).toEqual([{ kind: "reordered", tourId: "t1", tourName: "T1" }]);
    expect(diffTours(prev, next, [{ id: "1", kind: "sequence", tourId: "t1", stopIds: [] } as never], "2026-11-16")).toEqual([]);
  });

  it("the driver's own personal routes are never reported", () => {
    const mine = { tours: [tour("p1", { origin: "driver" })], stops: [stop("q", "p1", 0)] };
    expect(diffTours(mine, { tours: [], stops: [] }, [], "2026-11-16")).toEqual([]);
  });
});
