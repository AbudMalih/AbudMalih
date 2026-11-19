import "server-only";
import { serverApi } from "@turvio/web-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverT } from "./i18n/server";
import { activityFrom, toRecords, type AuditEntry, type OverviewOrg } from "./remote";
import { platformKpis, toRow } from "./platform";

/**
 * Platform data for the Overview (aggregates only – the platform API never returns tours, stops,
 * recipients or positions). Deduplicated per request.
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
  const { t } = await serverT();
  const now = new Date();
  const orgs = overview.data.organizations;
  const records = toRecords(orgs);
  return {
    ok: true as const,
    now,
    orgs,
    records,
    rows: records.map((r) => toRow(r, now)),
    kpi: platformKpis(records, now, orgs.map((o) => new Date(o.createdAt).toISOString())),
    audit: audit.data,
    events: activityFrom(audit.data, records, now, 50, t),
  };
});
