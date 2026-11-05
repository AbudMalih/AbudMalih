import { useTourStore } from "../src/store/tourStore";

describe("tour store (demo mode)", () => {
  beforeEach(() => useTourStore.getState().resetData());

  it("adds a manual stop and groups same-address parcels without losing tracking numbers", () => {
    const store = useTourStore.getState();
    const before = store.stops.filter((s) => s.tourId === "tour_ef_a").length;
    const first = store.addStop("tour_ef_a", {
      recipientName: "Test",
      address: { street: "Domplatz", houseNumber: "3", postalCode: "99084", city: "Erfurt" },
      location: { lat: 50.9773, lng: 11.0233 },
      trackingNumbers: ["TVO-A"],
    });
    expect(first.merged).toBe(false);
    const second = useTourStore.getState().addStop("tour_ef_a", {
      address: { street: "Domplatz", houseNumber: "3", postalCode: "99084", city: "Erfurt" },
      trackingNumbers: ["TVO-B"],
    });
    expect(second.merged).toBe(true);
    const tourStops = useTourStore.getState().stops.filter((s) => s.tourId === "tour_ef_a");
    expect(tourStops).toHaveLength(before + 1);
    expect(tourStops.find((s) => s.id === first.stop.id)!.parcels.map((p) => p.trackingNumber)).toEqual(["TVO-A", "TVO-B"]);
  });

  it("records arrival, outcomes with failure reasons and rejects invalid transitions", () => {
    const id = useTourStore.getState().stops.find((s) => s.type === "delivery")!.id;
    useTourStore.getState().setStopStatus(id, "in_progress");
    expect(() => useTourStore.getState().setStopStatus(id, "failed")).toThrow("failure_reason_required");
    useTourStore.getState().setStopStatus(id, "attempted", { failureReason: "recipient_absent", notes: "Nobody home" });
    const stop = useTourStore.getState().stops.find((s) => s.id === id)!;
    expect(stop).toMatchObject({ status: "attempted", failureReason: "recipient_absent", driverNotes: "Nobody home" });
    expect(() => useTourStore.getState().setStopStatus(id, "delivered")).toThrow();
    useTourStore.getState().setStopStatus(id, "pending");
    useTourStore.getState().setStopStatus(id, "delivered");
    expect(useTourStore.getState().stops.find((s) => s.id === id)!.failureReason).toBeUndefined();
  });

  it("only allows valid tour transitions", () => {
    const { tourAction } = useTourStore.getState();
    tourAction("tour_ef_a", "finish");
    expect(useTourStore.getState().tours[0]!.status).toBe("planned");
    tourAction("tour_ef_a", "start");
    tourAction("tour_ef_a", "finish");
    const tour = useTourStore.getState().tours[0]!;
    expect(tour.status).toBe("completed");
    expect(tour.startedAt).toBeDefined();
    expect(tour.finishedAt).toBeDefined();
  });

  it("optimizes on the device and keeps locked stops in their slot", async () => {
    const stops = useTourStore.getState().stops.filter((s) => s.tourId === "tour_ef_a").sort((a, b) => a.sequence - b.sequence);
    const pinned = stops[2]!;
    useTourStore.getState().setLocked(pinned.id, true);
    const outcome = await useTourStore.getState().optimize("tour_ef_a", { end: "none" });
    expect(outcome.engine).toBe("local");
    expect(outcome.lockedStopIds).toEqual([pinned.id]);
    const after = useTourStore.getState().stops.filter((s) => s.tourId === "tour_ef_a").sort((a, b) => a.sequence - b.sequence);
    expect(after[2]!.id).toBe(pinned.id);
    expect(useTourStore.getState().lastOptimization?.tourId).toBe("tour_ef_a");
  });

  it("records scans: marks parcels as loaded and keeps the scan history", () => {
    const stop = useTourStore.getState().stops.find((s) => s.tourId === "tour_ef_a" && s.parcels.length)!;
    const code = stop.parcels[0]!.trackingNumber.toUpperCase();
    useTourStore.getState().recordScans("tour_ef_a", [{ code, format: "code128", source: "camera", at: new Date().toISOString(), stopId: stop.id, repeats: 0 }]);
    useTourStore.getState().recordScans("tour_ef_a", [{ code, format: "code128", source: "camera", at: new Date().toISOString(), stopId: stop.id, repeats: 0 }]);
    expect(useTourStore.getState().scans.tour_ef_a).toHaveLength(1);
    expect(useTourStore.getState().stops.find((s) => s.id === stop.id)!.parcels[0]!.loadedAt).toBeDefined();
  });

  it("creates a personal route and selects it", () => {
    const tour = useTourStore.getState().createRoute("Extra", "2026-11-05");
    expect(tour.origin).toBe("driver");
    expect(useTourStore.getState().activeTourId).toBe(tour.id);
  });
});
