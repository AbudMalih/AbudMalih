import { createSyntheticDataset } from "@turvio/shared";
import { applyServerRoute, buildOptimizeRequest, optimizeTour } from "../src/lib/optimizer";

const data = createSyntheticDataset(new Date("2026-10-30T06:00:00Z"));
const tour = data.tours[0]!;
const depot = data.depots[0]!;
const stops = data.stops.filter((s) => s.tourId === tour.id);

describe("driver optimizer client", () => {
  const OLD_ENV = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = OLD_ENV;
  });

  it("builds a request containing only pending, located stops", () => {
    const withUnlocated = [...stops, { ...stops[0]!, id: "x", location: null }];
    const req = buildOptimizeRequest({ tour, depot, stops: withUnlocated, maxShiftMinutes: 480 });
    expect(req.stops.map((s) => s.id)).toEqual(stops.map((s) => s.id));
    expect(req.vehicles[0]!.shiftStart).toBe(tour.plannedStartMinute);
  });

  it("uses the local heuristic when no API is configured", async () => {
    process.env.EXPO_PUBLIC_API_URL = "";
    const fetchMock = jest.fn();
    const res = await optimizeTour({ tour, depot, stops, maxShiftMinutes: 480 }, fetchMock as never);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.engine).toBe("local");
    expect(res.stops).toHaveLength(stops.length);
  });

  it("applies the server order when the API answers", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://api.test";
    const reversed = [...stops].reverse();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ vehicleId: tour.id, visits: reversed.map((s, i) => ({ stopId: s.id, arrivalMinute: 480 + i * 10 })), distanceMeters: 1, durationSeconds: 1 }],
        unassignedStopIds: [],
        matrixSource: "haversine_estimate",
        status: "feasible",
        engine: "or-tools",
      }),
    });
    const res = await optimizeTour({ tour, depot, stops, maxShiftMinutes: 480 }, fetchMock as never);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/v1/orgs/org_jarbou/optimize", expect.objectContaining({ method: "POST" }));
    expect(res.engine).toBe("server");
    expect(res.stops.map((s) => s.id)).toEqual(reversed.map((s) => s.id));
  });

  it("falls back to the local heuristic and reports why when the API fails", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://api.test";
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const res = await optimizeTour({ tour, depot, stops, maxShiftMinutes: 480 }, fetchMock as never);
    expect(res.engine).toBe("local");
    expect(res.fallbackReason).toBe("HTTP 503");
  });

  it("keeps completed stops first when applying a server route", () => {
    const done = { ...stops[3]!, status: "delivered" as const };
    const list = stops.map((s) => (s.id === done.id ? done : s));
    const ordered = applyServerRoute(list, {
      routes: [{ vehicleId: "v", visits: [{ stopId: stops[1]!.id, arrivalMinute: 0 }], distanceMeters: 0, durationSeconds: 0 }],
      unassignedStopIds: [],
      matrixSource: "osrm",
      status: "feasible",
      engine: "or-tools",
    });
    expect(ordered[0]!.id).toBe(done.id);
    expect(ordered[1]!.id).toBe(stops[1]!.id);
    expect(ordered.map((s) => s.sequence)).toEqual(ordered.map((_, i) => i));
  });
});
