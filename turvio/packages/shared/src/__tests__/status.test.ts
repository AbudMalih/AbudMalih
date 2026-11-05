import { describe, expect, it } from "vitest";
import { canTransition, createSyntheticDataset, routeMetrics, setStopStatus, tourProgress, tourTimeline, validateOutcome, type Stop } from "../index";

describe("stop statuses", () => {
  it("allows open -> any outcome and closed -> reopen only", () => {
    expect(canTransition("pending", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "attempted")).toBe(true);
    expect(canTransition("in_progress", "pending")).toBe(true);
    expect(canTransition("delivered", "failed")).toBe(false);
    expect(canTransition("returned", "pending")).toBe(true);
  });

  it("requires a valid failure reason for not-delivered outcomes", () => {
    expect(validateOutcome({ status: "delivered" })).toBeNull();
    expect(validateOutcome({ status: "failed" })).toBe("failure_reason_required");
    expect(validateOutcome({ status: "attempted", failureReason: "nope" })).toBe("unknown_failure_reason");
    expect(validateOutcome({ status: "failed", failureReason: "other" })).toBe("note_required");
    expect(validateOutcome({ status: "rescheduled", failureReason: "recipient_absent" })).toBeNull();
  });

  it("keeps the failure reason only on not-delivered outcomes and counts progress", () => {
    const ds = createSyntheticDataset();
    const [a, b, c] = ds.stops.filter((s) => s.type === "delivery");
    const failed = setStopStatus(a!, "failed", new Date(), { failureReason: "refused" });
    expect(failed.failureReason).toBe("refused");
    const arrived = setStopStatus(b!, "in_progress");
    expect(arrived.completedAt).toBeUndefined();
    const p = tourProgress([failed, arrived, setStopStatus(c!, "delivered")]);
    expect(p).toMatchObject({ total: 3, done: 2, delivered: 1, failed: 1, pending: 1, inProgress: 1 });
  });
});

describe("route metrics (Dispatch and Driver show the same figures)", () => {
  it("total equals the Dispatch timeline distance; remaining starts at the last closed stop", () => {
    const ds = createSyntheticDataset();
    const tour = ds.tours[0]!;
    const depot = ds.depots.find((d) => d.id === tour.depotId)!;
    let stops = ds.stops.filter((s) => s.tourId === tour.id).sort((x, y) => x.sequence - y.sequence);
    stops = stops.map((s, i): Stop => (i < 3 ? setStopStatus(s, s.type === "pickup" ? "picked_up" : "delivered") : s));
    const m = routeMetrics(depot.location, stops, depot.location);
    const timeline = tourTimeline(tour, stops, depot, undefined, 600);
    expect(timeline.distanceMeters).toBeCloseTo(m.totalMeters, 6);
    expect(timeline.remainingMeters).toBeCloseTo(m.remainingMeters, 6);
    expect(m.remainingMeters).toBeLessThan(m.totalMeters);
    expect(m.source).toBe("haversine_estimate");
  });
});
