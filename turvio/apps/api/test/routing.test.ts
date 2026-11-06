import { describe, expect, it } from "vitest";
import { OsrmRouting, RoutingUnavailable } from "../src/routing";

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
    expect(urls[0]).toBe("http://osrm.test/route/v1/driving/9.768600,52.418900;9.746200,52.382600;9.768600,52.418900?overview=simplified&geometries=geojson&steps=false&continue_straight=default");
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
