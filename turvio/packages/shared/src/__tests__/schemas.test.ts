import { describe, expect, it } from "vitest";
import { NewStopInput, OptimizeRequest, Stop, TimeWindow } from "../schemas";
import { createSyntheticDataset } from "../synthetic";

describe("schemas", () => {
  it("rejects time windows that end before they start", () => {
    expect(TimeWindow.safeParse({ start: 600, end: 540 }).success).toBe(false);
    expect(TimeWindow.safeParse({ start: 540, end: 600 }).success).toBe(true);
  });

  it("applies defaults for manual stop input", () => {
    const parsed = NewStopInput.parse({
      address: { street: "Anger", postalCode: "99084", city: "Erfurt" },
    });
    expect(parsed.type).toBe("delivery");
    expect(parsed.address.countryCode).toBe("DE");
    expect(parsed.serviceSeconds).toBe(120);
    expect(parsed.trackingNumbers).toEqual([]);
    expect(parsed.location).toBeNull();
  });

  it("rejects manual break stops and empty streets", () => {
    expect(
      NewStopInput.safeParse({
        type: "break",
        address: { street: "Anger", postalCode: "99084", city: "Erfurt" },
      }).success,
    ).toBe(false);
    expect(
      NewStopInput.safeParse({ address: { street: "  ", postalCode: "99084", city: "Erfurt" } }).success,
    ).toBe(false);
  });

  it("rejects duplicate stop ids in optimize requests", () => {
    const stop = { id: "a", location: { lat: 50.9, lng: 11 }, serviceSeconds: 60 };
    const vehicle = { id: "v", start: { lat: 51, lng: 11 }, shiftStart: 480, maxShiftMinutes: 480 };
    expect(OptimizeRequest.safeParse({ vehicles: [vehicle], stops: [stop, stop] }).success).toBe(false);
    expect(OptimizeRequest.safeParse({ vehicles: [vehicle], stops: [stop] }).success).toBe(true);
  });

  it("synthetic dataset is valid against the domain schemas", () => {
    const data = createSyntheticDataset(new Date("2026-10-30T06:00:00Z"));
    for (const s of data.stops) expect(() => Stop.parse(s)).not.toThrow();
    expect(data.tours[0]!.date).toBe("2026-10-30");
  });
});
