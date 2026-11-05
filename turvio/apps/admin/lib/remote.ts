import type { Organization, Subscription } from "@turvio/shared";
import type { ActivityEvent, TenantRecord } from "./platform";

/** Shapes returned by GET /v1/platform/overview and /v1/platform/activity. */
export interface OverviewOrg {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  status: Organization["status"];
  createdAt: string;
  subscription: (Omit<Subscription, "organizationId" | "trialEndsAt" | "currentPeriodEnd"> & { trialEndsAt: string | null; currentPeriodEnd: string }) | null;
  activeDrivers: number;
  vehicles: number;
  depots: number;
  members: number;
  toursLast30d: number;
}

export interface AuditEntry {
  id: number;
  action: "insert" | "update" | "delete";
  table: "organizations" | "subscriptions" | "memberships" | "invitations";
  changedColumns: string[] | null;
  at: string;
  organizationId: string | null;
  organizationName: string | null;
}

export function toRecords(orgs: OverviewOrg[]): TenantRecord[] {
  return orgs
    .filter((o) => o.subscription)
    .map((o) => ({
      org: { id: o.id, name: o.name, slug: o.slug, countryCode: o.countryCode, status: o.status, defaultLocale: "de", locationRetentionDays: 30, proofRetentionDays: 90 },
      createdAt: new Date(o.createdAt).toISOString(),
      activeDrivers: o.activeDrivers,
      subscription: {
        ...o.subscription!,
        organizationId: o.id,
        trialEndsAt: o.subscription!.trialEndsAt ? new Date(o.subscription!.trialEndsAt).toISOString() : null,
        currentPeriodEnd: new Date(o.subscription!.currentPeriodEnd).toISOString(),
        limitOverrides: o.subscription!.limitOverrides ?? {},
      },
    }));
}

const LABEL: Record<string, string> = {
  "organizations:insert": "Company created",
  "organizations:update": "Company settings changed",
  "subscriptions:insert": "Subscription started",
  "subscriptions:update": "Subscription changed",
  "memberships:insert": "Member joined",
  "memberships:update": "Member role changed",
  "invitations:insert": "Invitation sent",
  "invitations:update": "Invitation updated",
};

/** Real platform events from the audit log, plus trial deadlines derived from subscriptions. */
export function activityFrom(audit: AuditEntry[], records: TenantRecord[], now: Date = new Date(), limit = 10): ActivityEvent[] {
  const events: ActivityEvent[] = audit
    .filter((a) => a.organizationId && a.action !== "delete")
    .map((a) => ({
      id: `audit-${a.id}`,
      kind:
        a.table === "organizations" && a.action === "insert"
          ? "registration"
          : a.table === "subscriptions"
            ? "plan_change"
            : "invitation",
      at: new Date(a.at).toISOString(),
      orgId: a.organizationId!,
      orgName: a.organizationName ?? "Unknown company",
      detail: `${LABEL[`${a.table}:${a.action}`] ?? `${a.table} ${a.action}`}${a.changedColumns?.length ? ` (${a.changedColumns.join(", ")})` : ""}`,
    }));
  for (const r of records) {
    const s = r.subscription;
    if (s.status !== "trialing" || !s.trialEndsAt) continue;
    const days = (new Date(s.trialEndsAt).getTime() - now.getTime()) / 86_400_000;
    if (days <= 7) {
      events.push({
        id: `trial-${r.org.id}`,
        kind: days < 0 ? "trial_expired" : "trial_ending",
        at: now.toISOString(),
        orgId: r.org.id,
        orgName: r.org.name,
        detail: days < 0 ? "Trial expired" : `Trial ends in ${Math.max(1, Math.ceil(days))} days`,
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
