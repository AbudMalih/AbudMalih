import { describe, expect, it } from "vitest";
import { haversineMeters, roundCoordinate, roundPoint } from "../geo";

describe("roundCoordinate (device positions to 7 decimals)", () => {
  it("rounds raw device values, keeps shorter ones bit-identical", () => {
    expect(roundCoordinate(52.38123456789012)).toBe(52.3812346);
    expect(roundCoordinate(-33.86881234567891)).toBe(-33.8688123);
    for (const v of [52.383456, 9.743211, 52.3812346, 0, 180, -90]) expect(roundCoordinate(v)).toBe(v);
  });
  it("is idempotent and exact in 15-significant-digit output (what extra_float_digits = 0 prints)", () => {
    const r = new Random(7);
    for (let i = 0; i < 20_000; i++) {
      const v = (r.next() - 0.5) * 360;
      const x = roundCoordinate(v);
      expect(roundCoordinate(x)).toBe(x);
      expect(Number(x.toPrecision(15))).toBe(x);
      expect(Math.abs(x - v)).toBeLessThanOrEqual(0.5e-7 + 1e-12);
    }
  });
  it("moves a point by less than 1 cm", () => {
    const p = { lat: 52.38123456789012, lng: 9.741234567890123 };
    expect(haversineMeters(p, roundPoint(p))).toBeLessThan(0.01);
    expect(roundPoint({ ...p, extra: 1 } as typeof p & { extra: number }).extra).toBe(1);
  });
});

class Random {
  constructor(private s: number) {}
  next() {
    this.s = (this.s * 1103515245 + 12345) % 2147483648;
    return this.s / 2147483648;
  }
}
