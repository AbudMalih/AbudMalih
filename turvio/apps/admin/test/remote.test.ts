import { describe, expect, it } from "vitest";
import { platformKpis } from "../lib/platform";
import { activityFrom, toRecords, type AuditEntry, type OverviewOrg } from "../lib/remote";

const now = new Date("2026-11-05T12:00:00Z");
const org = (o: Partial<OverviewOrg>): OverviewOrg => ({
  id: "o1",
  name: "JARBOU Logistik GmbH",
  slug: "jarbou",
  countryCode: "DE",
  status: "active",
  createdAt: "2026-10-01T08:00:00Z",
  activeDrivers: 16,
  vehicles: 16,
  depots: 4,
  members: 8,
  toursLast30d: 7,
  subscription: { planCode: "business", status: "active", interval: "month", seats: 20, trialEndsAt: null, currentPeriodEnd: "2026-12-01T00:00:00Z", cancelAtPeriodEnd: false, limitOverrides: {} },
  ...o,
});

describe("platform API mapping", () => {
  it("maps organizations to KPI records and skips companies without subscription", () => {
    const recs = toRecords([org({}), org({ id: "o2", name: "No Sub", subscription: null })]);
    expect(recs).toHaveLength(1);
    const k = platformKpis(recs, now);
    expect(k.companies).toBe(1);
    expect(k.activeDrivers).toBe(16);
    expect(k.mrrCents).toBeNull(); // prices not configured – never invented
  });

  it("builds activity from audit entries plus trial deadlines, newest first", () => {
    const recs = toRecords([
      org({}),
      org({ id: "o2", name: "Muster Kurier GmbH", status: "trialing", subscription: { planCode: "team", status: "trialing", interval: "month", seats: 3, trialEndsAt: "2026-11-08T00:00:00Z", currentPeriodEnd: "2026-11-08T00:00:00Z", cancelAtPeriodEnd: false, limitOverrides: {} } }),
    ]);
    const audit: AuditEntry[] = [
      { id: 1, action: "insert", table: "organizations", changedColumns: null, at: "2026-11-01T10:00:00Z", organizationId: "o2", organizationName: "Muster Kurier GmbH" },
      { id: 2, action: "update", table: "subscriptions", changedColumns: ["seats"], at: "2026-11-03T10:00:00Z", organizationId: "o1", organizationName: "JARBOU Logistik GmbH" },
      { id: 3, action: "insert", table: "invitations", changedColumns: null, at: "2026-11-04T10:00:00Z", organizationId: "o1", organizationName: "JARBOU Logistik GmbH" },
    ];
    const ev = activityFrom(audit, recs, now);
    expect(ev.map((e) => e.kind)).toEqual(["trial_ending", "invitation", "plan_change", "registration"]);
    expect(ev[2]!.detail).toBe("Subscription changed (seats)");
  });
});
