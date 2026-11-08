import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tour } from "@turvio/shared";
import { describe, expect, it } from "vitest";
import { tourMapPoints } from "../lib/helpers";

const HER01 = JSON.parse(readFileSync(join(import.meta.dirname, "../../../packages/shared/src/__tests__/fixtures/her01-2026-11-08.json"), "utf8")) as {
  depot: { lat: number; lng: number };
  start: { lat: number; lng: number };
  stops: { lat: number; lng: number }[];
};
const tour = (extra: Partial<Tour> = {}) => ({ id: "t", name: "HER-01", depotId: "d", status: "planned", plannedStartMinute: 450, ...extra }) as Tour;
const suhl = { location: HER01.depot };
const stops = HER01.stops.map((s) => ({ location: { lat: s.lat, lng: s.lng } }));
/** Longest straight segment of a drawn path, in degrees (Suhl–Hannover ≈ 2°). */
const longestJump = (path: { lat: number; lng: number }[]) => Math.max(...path.slice(1).map((p, i) => Math.hypot(p.lat - path[i]!.lat, p.lng - path[i]!.lng)));

describe("map fallback path and bounds use the tour's own start and end (HER-01 regression)", () => {
  it("HER-01: custom start in Hannover, depot in Suhl, end at last stop – no Suhl–Hannover line", () => {
    const m = tourMapPoints(tour({ startLocation: HER01.start, endMode: "last_stop" }), suhl, stops);
    expect(m.path[0]).toEqual(HER01.start);
    expect(m.path).toHaveLength(101); // start + 100 stops, nothing after the last stop
    expect(m.path.at(-1)).toEqual(stops.at(-1)!.location);
    expect(m.path.some((p) => p.lat === HER01.depot.lat && p.lng === HER01.depot.lng)).toBe(false);
    expect(longestJump(m.path)).toBeLessThan(0.1); // all within Hannover (bug: ~2° Suhl→Hannover)
    expect(m).toMatchObject({ customStart: HER01.start, customEnd: null, endsAtLastStop: true });
  });

  it("default tour: starts at the depot (unchanged), no extra markers", () => {
    const m = tourMapPoints(tour(), suhl, stops.slice(0, 3));
    expect(m.path[0]).toEqual(HER01.depot);
    expect(m.path).toHaveLength(4);
    expect(m).toMatchObject({ customStart: null, customEnd: null, endsAtLastStop: false });
  });

  it("custom end address is drawn as the last point and marked", () => {
    const end = { lat: 52.45, lng: 9.8 };
    const m = tourMapPoints(tour({ endMode: "address", endLocation: end }), suhl, stops.slice(0, 2));
    expect(m.path.at(-1)).toEqual(end);
    expect(m.customEnd).toEqual(end);
  });

  it("stops without a position are skipped, not drawn at 0,0", () => {
    const m = tourMapPoints(tour({ startLocation: HER01.start }), suhl, [{ location: null }, ...stops.slice(0, 1)]);
    expect(m.path).toEqual([HER01.start, stops[0]!.location]);
  });
});
