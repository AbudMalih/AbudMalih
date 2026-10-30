import { useTourStore } from "../src/store/tourStore";

describe("tour store", () => {
  beforeEach(() => useTourStore.getState().resetData());

  it("adds a manual stop to the tour and merges same-address parcels", () => {
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
    expect(tourStops.find((s) => s.id === first.stop.id)!.parcels).toHaveLength(2);
  });

  it("marks a stop failed with a note and rejects invalid transitions", () => {
    const id = useTourStore.getState().stops[0]!.id;
    useTourStore.getState().setStopStatus(id, "failed", "Nobody home");
    const stop = useTourStore.getState().stops.find((s) => s.id === id)!;
    expect(stop.status).toBe("failed");
    expect(stop.notes).toBe("Nobody home");
    expect(() => useTourStore.getState().setStopStatus(id, "delivered")).toThrow();
  });

  it("only allows valid tour transitions", () => {
    const { tourAction } = useTourStore.getState();
    tourAction("tour_ef_a", "finish"); // planned -> finish not allowed
    expect(useTourStore.getState().tours[0]!.status).toBe("planned");
    tourAction("tour_ef_a", "start");
    tourAction("tour_ef_a", "finish");
    const tour = useTourStore.getState().tours[0]!;
    expect(tour.status).toBe("completed");
    expect(tour.startedAt).toBeDefined();
    expect(tour.finishedAt).toBeDefined();
  });

  it("optimizes offline with the local heuristic", async () => {
    const outcome = await useTourStore.getState().optimize("tour_ef_a");
    expect(outcome.engine).toBe("local");
    expect(useTourStore.getState().lastOptimization?.tourId).toBe("tour_ef_a");
  });
});
