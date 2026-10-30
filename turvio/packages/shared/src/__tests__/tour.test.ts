import { describe, expect, it } from "vitest";
import { addStop, addressKey, estimateRoute, canTransition, moveStop, searchStops, setStopStatus, tourProgress } from "../tour";
import { orderStopsLocally } from "../localHeuristic";
import { haversineMeters } from "../geo";
import { createSyntheticDataset } from "../synthetic";
import type { Stop } from "../schemas";

const data = createSyntheticDataset(new Date("2026-10-30T06:00:00Z"));
const tourA = data.stops.filter((s) => s.tourId === "tour_ef_a");
const depot = data.depots[0]!.location;
const TOUR_A = { id: "tour_ef_a", organizationId: "org_jarbou" };
const T = { id: "t", organizationId: "org_x" };

describe("geo", () => {
  it("computes haversine distance Erfurt–Weimar (~20 km)", () => {
    const d = haversineMeters(data.depots[0]!.location, data.depots[1]!.location);
    expect(d).toBeGreaterThan(18_000);
    expect(d).toBeLessThan(22_000);
  });
});

describe("stop status", () => {
  it("allows only valid transitions", () => {
    expect(canTransition("pending", "delivered")).toBe(true);
    expect(canTransition("delivered", "failed")).toBe(false);
    const delivered = setStopStatus(tourA[0]!, "delivered", new Date("2026-10-30T09:00:00Z"));
    expect(delivered.status).toBe("delivered");
    expect(delivered.completedAt).toBe("2026-10-30T09:00:00.000Z");
    expect(() => setStopStatus(delivered, "failed")).toThrow();
    expect(setStopStatus(delivered, "pending").completedAt).toBeUndefined();
  });

  it("refuses to mark a delivery as picked up", () => {
    expect(() => setStopStatus(tourA[0]!, "picked_up")).toThrow();
  });
});

describe("manual stops", () => {
  it("adds a new stop at the end of the sequence", () => {
    const { stops, stop, merged } = addStop(tourA, TOUR_A, {
      recipientName: "Test Person",
      address: { street: "Domplatz", houseNumber: "3", postalCode: "99084", city: "Erfurt" },
      trackingNumbers: ["TVO1"],
    });
    expect(merged).toBe(false);
    expect(stops).toHaveLength(tourA.length + 1);
    expect(stop.sequence).toBe(tourA.length);
    expect(stop.organizationId).toBe("org_jarbou");
    expect(stop.parcels.map((p) => p.trackingNumber)).toEqual(["TVO1"]);
  });

  it("merges parcels for the same address (normalised street spelling)", () => {
    const first = addStop([], T, {
      address: { street: "Krämpferstraße", houseNumber: "27", postalCode: "99084", city: "Erfurt" },
      trackingNumbers: ["A"],
    });
    const second = addStop(first.stops, T, {
      address: { street: "Krämpferstr.", houseNumber: "27", postalCode: "99084", city: "Erfurt" },
      trackingNumbers: ["A", "B"],
      priority: true,
    });
    expect(second.merged).toBe(true);
    expect(second.stops).toHaveLength(1);
    expect(second.stop.parcels.map((p) => p.trackingNumber)).toEqual(["A", "B"]);
    expect(second.stop.priority).toBe(true);
  });

  it("normalises address keys", () => {
    const a = addressKey({ street: "Schlösserstraße", houseNumber: "20", postalCode: "99084", city: "Erfurt", countryCode: "DE" });
    const b = addressKey({ street: "Schlösser Str", houseNumber: "20", postalCode: "99084", city: "Erfurt", countryCode: "DE" });
    expect(a).toBe(b);
  });
});

describe("ordering and search", () => {
  it("moves stops and keeps sequences contiguous", () => {
    const moved = moveStop(tourA, 0, 3);
    expect(moved[3]!.id).toBe(tourA[0]!.id);
    expect(moved.map((s) => s.sequence)).toEqual(moved.map((_, i) => i));
  });

  it("finds stops by tracking number, recipient and address", () => {
    const tn = tourA[1]!.parcels[1]!.trackingNumber;
    expect(searchStops(tourA, tn.toLowerCase()).map((s) => s.id)).toEqual([tourA[1]!.id]);
    expect(searchStops(tourA, "krüger")).toHaveLength(1);
    expect(searchStops(tourA, "99096").length).toBeGreaterThan(0);
  });

  it("reports progress excluding breaks", () => {
    const stops: Stop[] = [setStopStatus(tourA[0]!, "delivered"), setStopStatus(tourA[1]!, "failed"), tourA[2]!];
    expect(tourProgress(stops)).toMatchObject({ total: 3, done: 2, delivered: 1, failed: 1, pending: 1 });
  });
});

describe("local heuristic", () => {
  it("visits priority stops first, keeps completed stops in front and unlocated at the end", () => {
    const withDone = [setStopStatus(tourA[0]!, "delivered"), ...tourA.slice(1)];
    const unlocated = addStop(withDone, TOUR_A, {
      address: { street: "Unbekannt", postalCode: "99084", city: "Erfurt" },
    });
    const res = orderStopsLocally(unlocated.stops, depot);
    expect(res.stops[0]!.id).toBe(tourA[0]!.id);
    expect(res.stops.at(-1)!.id).toBe(unlocated.stop.id);
    expect(res.unlocatedStopIds).toEqual([unlocated.stop.id]);
    const pending = res.stops.filter((s) => s.status === "pending" && s.location);
    const firstNonPrio = pending.findIndex((s) => !s.priority);
    expect(pending.slice(firstNonPrio).some((s) => s.priority)).toBe(false);
    expect(res.stops.map((s) => s.sequence)).toEqual(res.stops.map((_, i) => i));
  });

  it("is not worse than the original synthetic order (no priorities)", () => {
    const plain = tourA.map((s) => ({ ...s, priority: false }));
    const res = orderStopsLocally(plain, depot);
    const original = estimateRoute(depot, plain).driveSeconds;
    expect(res.stops).toHaveLength(plain.length);
    expect(res.estimatedDriveSeconds).toBeLessThanOrEqual(original + 1e-6);
  });
});
