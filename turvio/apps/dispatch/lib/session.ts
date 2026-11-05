import {
  OrgRole,
  SYNTHETIC_ORGANIZATIONS,
  createDispatchDataset,
  scopeDispatchDataset,
  type DispatchDataset,
  type Membership,
} from "@turvio/shared";

/**
 * Server-side session + data loading for TURVIO Dispatch.
 *
 * DEVELOPMENT: there is no login yet. The identity is a synthetic JARBOU staff
 * member whose role and depot scope can be set with environment variables to
 * exercise permissions:
 *   DISPATCH_DEV_ROLE=owner|admin|dispatcher   (default: admin)
 *   DISPATCH_DEV_DEPOTS=dep_bremen,dep_kassel  (dispatcher depot restriction)
 * Data is the synthetic pilot dataset. Scoping happens HERE, on the server,
 * so the browser never receives rows outside the user's access. The same rules
 * are enforced by Postgres RLS (supabase/migrations/*_depot_scope.sql).
 */
export interface DispatchSession {
  user: { name: string; email: string };
  membership: Membership;
  organizationName: string;
  companyWide: boolean;
  dataSource: "synthetic";
}

export function getDevSession(env: Record<string, string | undefined> = process.env): DispatchSession {
  const parsedRole = OrgRole.safeParse(env.DISPATCH_DEV_ROLE ?? "admin");
  // A driver role is allowed here on purpose: scoping then returns no dispatch data.
  const role = parsedRole.success ? parsedRole.data : "admin";
  const depotIds = role === "dispatcher" && env.DISPATCH_DEV_DEPOTS ? env.DISPATCH_DEV_DEPOTS.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const org = SYNTHETIC_ORGANIZATIONS.find((o) => o.id === "org_jarbou")!;
  return {
    user: { name: role === "dispatcher" ? "Dispatcher (dev)" : "Operations Admin (dev)", email: "dispatch@dev.turvio.invalid" },
    membership: { organizationId: org.id, userId: "usr_dispatch_dev", role, active: true, depotIds },
    organizationName: org.name,
    companyWide: role !== "dispatcher" || !depotIds?.length,
    dataSource: "synthetic",
  };
}

export function loadDispatchData(session: DispatchSession, now: Date = new Date()): DispatchDataset {
  return scopeDispatchDataset(createDispatchDataset(now), session.membership);
}
