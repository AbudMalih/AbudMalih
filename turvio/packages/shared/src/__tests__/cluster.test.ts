import { describe, expect, it } from "vitest";
import { boundingRegion, clusterForRegion } from "../geo";
import type { GeoPoint } from "../schemas";

declare const performance: { now(): number };

/** Synthetic tours around Hannover with 50–250 stops. */
const stops = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, location: { lat: 52.3 + ((i * 37) % 100) / 500, lng: 9.6 + ((i * 53) % 100) / 400 } as GeoPoint }));

describe("map clustering for large tours", () => {
  for (const n of [50, 100, 150, 250]) {
    it(`${n} stops: bounded marker count, every stop accounted for, fast`, () => {
      const s = stops(n);
      const region = boundingRegion(s.map((x) => x.location))!;
      const t0 = performance.now();
      let out = clusterForRegion(s, (x) => x.location, region, { keep: (x) => x.id === "s5" });
      for (let i = 0; i < 99; i++) out = clusterForRegion(s, (x) => x.location, region, { keep: (x) => x.id === "s5" });
      const perCall = (performance.now() - t0) / 100;
      const count = out.reduce((a, m) => a + (m.kind === "cluster" ? m.items.length : 1), 0);
      expect(count).toBe(n);
      expect(out.length).toBeLessThanOrEqual(Math.max(60, 65));
      expect(out.some((m) => m.kind === "single" && m.item.id === "s5")).toBe(true);
      expect(perCall).toBeLessThan(5); // ms in Node – a device measurement is still required
    });
  }

  it("draws individual markers when zoomed in and skips stops outside the view", () => {
    const s = stops(250);
    const zoomed = { latitude: 52.35, longitude: 9.7, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    const out = clusterForRegion(s, (x) => x.location, zoomed);
    expect(out.every((m) => m.kind === "single")).toBe(true);
    expect(out.length).toBeLessThan(250);
  });
});
