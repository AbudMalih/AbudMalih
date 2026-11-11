import { todayIso } from "../src/lib/format";
import { snapshotFrom } from "../src/lib/sync";

// Regression (staging pilot prep, 2026-11-12): a personal route created on a phone whose day
// differed from the company's day (near midnight, or another time zone) was dated a day off,
// disappeared from GET /v1/me/tours after the next sync, and the following import silently went
// into the running tour instead.
describe("company calendar day", () => {
  afterEach(() => jest.useRealTimers());

  it("uses the company time zone when it is known", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-11T23:30:00Z")); // 00:30 on 12 Nov in Berlin
    expect(todayIso("Europe/Berlin")).toBe("2026-11-12");
    expect(todayIso("America/New_York")).toBe("2026-11-11");
  });

  it("falls back to the phone's day without a (valid) zone", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 11, 23, 30));
    expect(todayIso(null)).toBe("2026-11-11");
    expect(todayIso("Not/AZone")).toBe("2026-11-11");
  });

  it("keeps the company time zone from the server even when the driver has no tours", () => {
    expect(snapshotFrom({ tours: [], timeZone: "Europe/Berlin" }, "d1").timeZone).toBe("Europe/Berlin");
    expect(snapshotFrom({ tours: [] }, "d1", { depots: [], drivers: [], timeZone: "Europe/Berlin" }).timeZone).toBe("Europe/Berlin");
    expect(snapshotFrom({ tours: [] }, "d1").timeZone).toBeNull();
  });
});
