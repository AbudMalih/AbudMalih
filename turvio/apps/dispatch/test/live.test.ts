import { describe, expect, it } from "vitest";
import { ageLabel, freshnessOf } from "../lib/live";

describe("live position freshness", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

  it("is live only while fixes keep arriving (phone sends at least one per minute while driving or parked)", () => {
    expect(freshnessOf(at(5), now)).toEqual({ state: "live", ageSeconds: 5 });
    expect(freshnessOf(at(90), now).state).toBe("live");
    expect(freshnessOf(at(91), now).state).toBe("delayed");
    expect(freshnessOf(at(300), now).state).toBe("delayed");
    expect(freshnessOf(at(301), now).state).toBe("offline");
  });

  it("never reports negative ages (clock skew) and labels ages plainly", () => {
    expect(freshnessOf(new Date(now + 4000).toISOString(), now).ageSeconds).toBe(0);
    expect(ageLabel(12)).toBe("12 s ago");
    expect(ageLabel(185)).toBe("3 min ago");
    expect(ageLabel(3 * 3600 + 120)).toBe("3 h 2 min ago");
  });
});
