import { createSyntheticDataset, type Stop } from "@turvio/shared";
import { optimizeLocally } from "../src/lib/optimizer";

describe("on-device optimization fallback", () => {
  const ds = createSyntheticDataset();
  const tour = ds.tours[0]!;
  const depot = ds.depots[0]!;
  const stops = ds.stops.filter((s) => s.tourId === tour.id);

  it("keeps closed stops first, unlocated stops last and labels the estimate", () => {
    const withState: Stop[] = stops.map((s, i) => (i === 0 ? { ...s, status: "delivered", completedAt: new Date().toISOString() } : i === 1 ? { ...s, location: null } : s));
    const r = optimizeLocally(tour, depot, withState);
    expect(r.engine).toBe("local");
    expect(r.matrixSource).toBe("haversine_estimate");
    expect(r.stops[0]!.id).toBe(withState[0]!.id);
    expect(r.stops.at(-1)!.id).toBe(withState[1]!.id);
    expect(r.unlocatedStopIds).toEqual([withState[1]!.id]);
    expect(r.stops.map((s) => s.sequence)).toEqual(r.stops.map((_, i) => i));
  });

  it("honours locked positions unless told otherwise", () => {
    const locked = stops.map((s, i) => (i === 3 ? { ...s, locked: true } : s));
    const keep = optimizeLocally(tour, depot, locked);
    expect(keep.stops[3]!.id).toBe(locked[3]!.id);
    expect(keep.lockedStopIds).toEqual([locked[3]!.id]);
    expect(optimizeLocally(tour, depot, locked, { respectLocks: false }).lockedStopIds).toEqual([]);
  });
});
