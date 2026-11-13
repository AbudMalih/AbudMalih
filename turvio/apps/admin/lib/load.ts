import "server-only";
import { serverApi } from "@turvio/web-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { activityFrom, toRecords, type AuditEntry, type OverviewOrg } from "./remote";
import { platformKpis, toRow } from "./platform";

/**
 * Platform data for Overview, Organizations and Audit log (aggregates only – the platform API never
 * returns tours, stops, recipients or positions). Deduplicated per request.
 * 401 → sign-in; missing second factor → two-step setup; other failures → an error the page shows
 * inside the shell.
 */
export const loadPlatform = cache(async () => {
  const jar = await cookies();
  const [overview, audit] = await Promise.all([serverApi<{ organizations: OverviewOrg[] }>(jar, "/v1/platform/overview"), serverApi<AuditEntry[]>(jar, "/v1/platform/activity")]);
  for (const r of [overview, audit]) {
    if (!r.ok && r.status === 401) redirect("/login");
    if (!r.ok && r.code === "mfa_required") redirect("/security?required=1");
  }
  if (!overview.ok || !audit.ok) return { ok: false as const, status: !overview.ok ? overview.status : !audit.ok ? audit.status : 0 };
  const now = new Date();
  const records = toRecords(overview.data.organizations);
  return {
    ok: true as const,
    now,
    orgs: overview.data.organizations,
    records,
    rows: records.map((r) => toRow(r, now)),
    kpi: platformKpis(records, now),
    audit: audit.data,
    events: activityFrom(audit.data, records, now, 50),
  };
});
