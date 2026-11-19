import type { LimitName, Organization, Subscription } from "@turvio/shared";
import { EN_T, type MessageKey, type TFunction } from "./i18n";
import type { ActivityEvent, TenantRecord } from "./platform";

/** Shapes returned by the platform API (apps/api/src/routes/platform.ts). */
export type OrgStatus = Organization["status"];

/** GET /v1/platform/overview */
export interface OverviewOrg {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  status: OrgStatus;
  createdAt: string;
  subscription: (Omit<Subscription, "organizationId" | "trialEndsAt" | "currentPeriodEnd"> & { trialEndsAt: string | null; currentPeriodEnd: string }) | null;
  activeDrivers: number;
  vehicles: number;
  depots: number;
  members: number;
  toursLast30d: number;
}

/** GET /v1/platform/activity */
export interface AuditEntry {
  id: number;
  action: "insert" | "update" | "delete";
  table: string;
  changedColumns: string[] | null;
  at: string;
  organizationId: string | null;
  organizationName: string | null;
}

/** GET /v1/platform/organizations */
export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  status: OrgStatus;
  createdAt: string;
  subscription: { planCode: string; status: Subscription["status"]; seats: number; trialEndsAt: string | null } | null;
  members: number;
  activeDrivers: number;
}
export interface OrgList {
  total: number;
  organizations: OrgListItem[];
}

/** GET /v1/platform/organizations/:id */
export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  defaultLocale: string;
  status: OrgStatus;
  createdAt: string;
  subscription: {
    planCode: string;
    planName: string;
    status: Subscription["status"];
    interval: Subscription["interval"];
    seats: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    limitOverrides: Partial<Record<LimitName, number>>;
  } | null;
  usage: { members: number; activeDrivers: number; vehicles: number; depots: number; toursLast30d: number };
  members: { membershipId: string; userId: string; email: string | null; role: string; active: boolean; since: string }[];
  invitations: { id: string; email: string; role: string; createdAt: string; expiresAt: string }[];
}

/** Body of PATCH /v1/platform/organizations/:id */
export interface OrgPatch {
  status?: OrgStatus;
  planCode?: string;
  seats?: number;
  limitOverrides?: Partial<Record<LimitName, number | null>>;
  trialEndsAt?: string | null;
}

/** GET /v1/platform/audit */
export interface PlatformAuditEntry {
  id: number;
  action: "insert" | "update" | "delete";
  table: string;
  recordId: string | null;
  changedColumns: string[];
  at: string;
  actor: { userId: string; email: string | null } | null;
  organizationId: string | null;
  organizationName: string | null;
}
export interface PlatformAuditPage {
  entries: PlatformAuditEntry[];
  nextBefore: number | null;
}

/** GET /v1/platform/admins */
export interface PlatformAdmin {
  userId: string;
  email: string | null;
  since: string;
  you: boolean;
}

/** Companies with a subscription, for the subscription KPIs (companies without one are counted separately). */
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

const EVENTS = new Set([
  "organizations:insert",
  "organizations:update",
  "organizations:delete",
  "subscriptions:insert",
  "subscriptions:update",
  "subscriptions:delete",
  "memberships:insert",
  "memberships:update",
  "memberships:delete",
  "invitations:insert",
  "invitations:update",
  "invitations:delete",
]);

/** "Company created", "Member removed", … – falls back to "<table> changed". */
export function eventLabel(table: string, action: string, t: TFunction = EN_T): string {
  const k = `${table}:${action}`;
  if (EVENTS.has(k)) return t(`audit.event.${k.replace(":", ".")}` as MessageKey);
  return t(`audit.action.${action === "insert" || action === "delete" ? action : "update"}`, { table: tableLabel(table, t) });
}

const TABLES = new Set(["organizations", "subscriptions", "memberships", "invitations", "membership_depots", "depots", "vehicles", "drivers", "tours", "stops", "proofs"]);
export const AUDIT_TABLES = ["organizations", "subscriptions", "memberships", "invitations"] as const;
export function tableLabel(table: string, t: TFunction = EN_T): string {
  return TABLES.has(table) ? t(`audit.table.${table}` as MessageKey) : table;
}

/** Real platform events from the audit log, plus trial deadlines derived from subscriptions. */
export function activityFrom(audit: AuditEntry[], records: TenantRecord[], now: Date = new Date(), limit = 10, t: TFunction = EN_T): ActivityEvent[] {
  const events: ActivityEvent[] = audit
    .filter((a) => a.organizationId)
    .map((a) => ({
      id: `audit-${a.id}`,
      kind:
        a.table === "organizations" && a.action === "insert"
          ? "registration"
          : a.action === "delete"
            ? "cancellation"
            : a.table === "subscriptions"
              ? "plan_change"
              : "invitation",
      at: new Date(a.at).toISOString(),
      orgId: a.organizationId!,
      orgName: a.organizationName ?? t("common.unknownCompany"),
      detail: eventLabel(a.table, a.action, t),
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
        detail: days < 0 ? t("overview.trialExpired") : t("overview.trialEndsIn", { count: Math.max(1, Math.ceil(days)) }),
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
