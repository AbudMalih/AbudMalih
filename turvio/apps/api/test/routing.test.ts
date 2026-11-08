import { describe, expect, it } from "vitest";
import { OsrmRouting, RoutingOutOfCoverage, RoutingUnavailable } from "../src/routing";

const P = [
  { lat: 52.4189, lng: 9.7686 },
  { lat: 52.3826, lng: 9.7462 },
  { lat: 52.4189, lng: 9.7686 },
];

describe("OSRM routing client (mocked OSRM)", () => {
  it("returns legs and [lat,lng] geometry, and caches identical requests", async () => {
    const urls: string[] = [];
    const fake: typeof fetch = async (u) => {
      urls.push(String(u));
      return Response.json({
        code: "Ok",
        routes: [{ distance: 9100, duration: 840, legs: [{ distance: 4500, duration: 400 }, { distance: 4600, duration: 440 }], geometry: { coordinates: [[9.7686, 52.4189], [9.75, 52.4], [9.7462, 52.3826]] } }],
      });
    };
    const r = new OsrmRouting("http://osrm.test/", { fetchImpl: fake });
    const a = await r.route(P);
    await r.route(P);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("http://osrm.test/route/v1/driving/9.768600,52.418900;9.746200,52.382600;9.768600,52.418900?overview=simplified&geometries=geojson&steps=false&continue_straight=false");
    expect(a).toMatchObject({ source: "osrm", distanceMeters: 9100, legs: [{ meters: 4500, seconds: 400 }, { meters: 4600, seconds: 440 }] });
    expect(a.geometry[0]).toEqual([52.4189, 9.7686]);
  });

  it("reports unavailability (timeouts, NoRoute) instead of inventing figures", async () => {
    const slow: typeof fetch = (_u, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout"))));
    await expect(new OsrmRouting("http://osrm.test", { fetchImpl: slow, timeoutMs: 50 }).route(P)).rejects.toBeInstanceOf(RoutingUnavailable);
    const noRoute: typeof fetch = async () => Response.json({ code: "NoRoute", message: "Impossible route" }, { status: 400 });
    await expect(new OsrmRouting("http://osrm.test", { fetchImpl: noRoute }).route(P)).rejects.toThrow(/NoRoute/);
  });
});

describe("routing coverage (points outside the OSRM data)", () => {
  // What OSRM with a Region Hannover graph answers for a tour in Suhl: "Ok", 0 m, every
  // waypoint moved ~165 km onto the same edge node.
  const SUHL = [
    { lat: 50.6106, lng: 10.6936 },
    { lat: 50.604, lng: 10.7012 },
    { lat: 50.618, lng: 10.685 },
  ];
  const snapped: typeof fetch = async () =>
    Response.json({
      code: "Ok",
      waypoints: SUHL.map(() => ({ distance: 165258.4, location: [10.1535, 52.0656] })),
      routes: [{ distance: 0, duration: 0, legs: [{ distance: 0, duration: 0 }, { distance: 0, duration: 0 }], geometry: { coordinates: [[10.1535, 52.0656], [10.1535, 52.0656]] } }],
    });

  it("rejects far-snapped points as out of coverage and names them", async () => {
    const err = await new OsrmRouting("http://osrm.test", { fetchImpl: snapped }).route(SUHL).catch((e) => e);
    expect(err).toBeInstanceOf(RoutingOutOfCoverage);
    expect(err.points).toEqual([0, 1, 2].map((index) => ({ index, snapMeters: 165258 })));
    expect(err.message).toMatch(/outside the road-routing area.*165\.3 km/);
  });

  it("rejects a 0 m route between distinct locations even when snaps look fine", async () => {
    const zero: typeof fetch = async () =>
      Response.json({ code: "Ok", waypoints: SUHL.map(() => ({ distance: 5 })), routes: [{ distance: 0, duration: 0, legs: [{ distance: 0, duration: 0 }, { distance: 0, duration: 0 }], geometry: { coordinates: [] } }] });
    await expect(new OsrmRouting("http://osrm.test", { fetchImpl: zero }).route(SUHL)).rejects.toBeInstanceOf(RoutingUnavailable);
  });

  it("accepts normal snaps (a few metres to the road)", async () => {
    const ok: typeof fetch = async () =>
      Response.json({ code: "Ok", waypoints: SUHL.map(() => ({ distance: 12 })), routes: [{ distance: 4200, duration: 480, legs: [{ distance: 2000, duration: 230 }, { distance: 2200, duration: 250 }], geometry: { coordinates: [[10.6936, 50.6106], [10.685, 50.618]] } }] });
    await expect(new OsrmRouting("http://osrm.test", { fetchImpl: ok }).route(SUHL)).resolves.toMatchObject({ distanceMeters: 4200 });
  });
});
