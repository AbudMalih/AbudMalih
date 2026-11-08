import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Depot, Stop } from "@turvio/shared";
import { fallbackPath, initialMapPoints, tourMapEnds } from "../src/components/TourMap.shared";

const HER01 = JSON.parse(readFileSync(join(__dirname, "../../../packages/shared/src/__tests__/fixtures/her01-2026-11-08.json"), "utf8")) as {
  depot: { lat: number; lng: number };
  start: { lat: number; lng: number };
  stops: { lat: number; lng: number }[];
};
const suhl = { id: "dep", name: "Hermes Suhl", location: HER01.depot } as Depot;
const stopsOf = (n = HER01.stops.length, done = 0): Stop[] =>
  HER01.stops.slice(0, n).map((s, i) => ({ id: `s${i}`, sequence: i, type: "delivery", status: i < done ? "delivered" : "pending", location: { lat: s.lat, lng: s.lng }, parcels: [] }) as unknown as Stop);
const isSuhl = (p: { lat: number; lng: number }) => p.lat === HER01.depot.lat && p.lng === HER01.depot.lng;

describe("driver map respects the tour's own start and end (HER-01 regression)", () => {
  const her01 = { startLocation: HER01.start, endMode: "last_stop" as const };

  it("HER-01: the map frames Hannover only, not the Suhl depot", () => {
    const pts = initialMapPoints({ depot: suhl, tour: her01, stops: stopsOf() });
    expect(pts.some(isSuhl)).toBe(false);
    expect(Math.min(...pts.map((p) => p.lat))).toBeGreaterThan(52.3); // Suhl is at 50.59
  });

  it("HER-01: the straight-line fallback starts at the custom start and ends at the last stop", () => {
    const path = fallbackPath({ depot: suhl, tour: her01, stops: stopsOf() });
    expect(path[0]).toEqual(HER01.start);
    expect(path).toHaveLength(101);
    expect(path.some(isSuhl)).toBe(false);
  });

  it("on the road the line starts at the last completed stop", () => {
    const stops = stopsOf(5, 2);
    expect(fallbackPath({ depot: suhl, tour: her01, stops })[0]).toEqual(stops[1]!.location);
  });

  it("default (no own start/end): depot as start, no end marker – unchanged", () => {
    expect(tourMapEnds(suhl, {})).toEqual({ start: HER01.depot, end: undefined });
    expect(tourMapEnds(suhl, undefined)).toEqual({ start: HER01.depot, end: undefined });
    expect(fallbackPath({ depot: suhl, stops: stopsOf(3) })[0]).toEqual(HER01.depot);
  });

  it("own end address: framed and drawn as the last point", () => {
    const end = { lat: 52.45, lng: 9.8 };
    const tour = { endMode: "address" as const, endLocation: end };
    expect(initialMapPoints({ depot: suhl, tour, stops: stopsOf(2) })).toContainEqual(end);
    expect(fallbackPath({ depot: suhl, tour, stops: stopsOf(2) }).at(-1)).toEqual(end);
  });

  it("a map without a tour (pick a location) still frames the depot and the pin", () => {
    const pin = { lat: 50.6, lng: 10.7 };
    expect(initialMapPoints({ depot: suhl, stops: [], pendingPin: pin })).toEqual([HER01.depot, pin]);
  });
});
