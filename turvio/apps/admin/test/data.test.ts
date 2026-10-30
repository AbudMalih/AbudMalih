import { describe, expect, it } from "vitest";
import { listTenants } from "../lib/data";

describe("admin tenant list", () => {
  it("shows every tenant with plan, usability and seat-based driver limit", () => {
    const rows = listTenants(new Date("2026-10-30T00:00:00Z"));
    const jarbou = rows.find((r) => r.org.id === "org_jarbou")!;
    expect(jarbou.plan?.code).toBe("business");
    expect(jarbou.usable).toBe(true);
    expect(jarbou.activeDrivers).toBe(3);
    expect(jarbou.driverLimit).toBe(5);
    const muster = rows.find((r) => r.org.id === "org_muster")!;
    expect(muster.subscription?.status).toBe("trialing");
    expect(muster.activeDrivers).toBe(0);
  });
});
