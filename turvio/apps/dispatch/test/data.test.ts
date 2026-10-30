import { describe, expect, it } from "vitest";
import { getTenantData, overviewKpis, summarizeTours } from "../lib/data";

describe("dispatch data", () => {
  it("only returns rows of the requested tenant", () => {
    const jarbou = getTenantData("org_jarbou");
    expect(jarbou.tours.length).toBeGreaterThan(0);
    const other = getTenantData("org_muster");
    expect(other.tours).toHaveLength(0);
    expect(other.stops).toHaveLength(0);
  });

  it("summarizes tours with driver, vehicle and progress", () => {
    const summaries = summarizeTours(getTenantData());
    const a = summaries.find((s) => s.tour.id === "tour_ef_a")!;
    expect(a.driverName).toBe("Lena Hoffmann");
    expect(a.vehicleLabel).toBe("Sprinter 1");
    expect(a.progress.total).toBe(8);
    expect(a.priorityStops).toBe(1);
    const kpi = overviewKpis(summaries);
    expect(kpi.unassignedTours).toBe(1);
    expect(kpi.stops).toBe(14);
  });
});
