import { createDispatchDataset } from "@turvio/shared";
import { describe, expect, it } from "vitest";
import { driverBusy, parseStopLines, tourColor, vehicleBusy } from "../lib/helpers";

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));

describe("stop list import", () => {
  it("parses valid lines with defaults, windows, types and tracking numbers", () => {
    const r = parseStopLines("Praxis Lang; Lister Meile; 12; 30161; ; 52,3801; 9.7420; delivery; 09:00-12:00; TVO1, TVO2\n# comment\nAutohaus; Hafenstr.; 3; 30159; Hannover; 52.37; 9.73; pickup", { city: "Hannover" });
    expect(r).toHaveLength(2);
    expect(r[0]!.stop).toMatchObject({
      type: "delivery",
      recipientName: "Praxis Lang",
      address: { street: "Lister Meile", houseNumber: "12", postalCode: "30161", city: "Hannover" },
      location: { lat: 52.3801, lng: 9.742 },
      timeWindow: { start: 540, end: 720 },
      trackingNumbers: ["TVO1", "TVO2"],
    });
    expect(r[1]!.stop!.type).toBe("pickup");
  });

  it("reports line-level errors instead of guessing", () => {
    const r = parseStopLines("A; Weg; 1; 30159; Hannover; ; ;\nB; Weg; 2; 30159; Hannover; 52.3; 9.7; delivery; 12:00-11:00\nC; ; ; ; Hannover; 52.3; 9.7");
    expect(r.map((x) => x.error)).toEqual(["valid latitude and longitude are required", 'invalid time window "12:00-11:00"', "street and postcode are required"]);
  });
});

describe("availability helpers", () => {
  it("detects busy drivers and vehicles on open tours", () => {
    const t = base.tours.find((x) => x.status === "in_progress" && x.driverId && x.vehicleId)!;
    expect(driverBusy(base, t.driverId!)?.id).toBe(t.id);
    expect(driverBusy(base, t.driverId!, t.id)).toBeUndefined();
    expect(vehicleBusy(base, t.vehicleId!)?.id).toBe(t.id);
  });
  it("gives each tour a stable colour", () => {
    expect(tourColor(base, base.tours[0]!.id)).toBe("#2563EB");
    expect(tourColor(base, base.tours[1]!.id)).not.toBe(tourColor(base, base.tours[0]!.id));
  });
});
