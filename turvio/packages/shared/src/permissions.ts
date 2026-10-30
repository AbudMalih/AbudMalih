import type { OrgRole } from "./schemas";

/**
 * Application-level permission matrix. The database enforces the same rules
 * with RLS (supabase/migrations); this module lets the API and UIs make
 * consistent decisions (hide buttons, reject requests early).
 */
export const PERMISSIONS = [
  "org.settings.manage",
  "org.billing.view",
  "org.members.manage",
  "depots.view",
  "depots.manage",
  "vehicles.manage",
  "drivers.view",
  "drivers.manage",
  "tours.view_all",
  "tours.view_own",
  "tours.manage",
  "tours.optimize",
  "stops.add_own",
  "stops.update_status_own",
  "stops.manage",
  "imports.run",
  "tracking.view_live",
  "reports.view",
  "reports.export",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const DISPATCHER: readonly Permission[] = [
  "depots.view",
  "vehicles.manage",
  "drivers.view",
  "drivers.manage",
  "tours.view_all",
  "tours.view_own",
  "tours.manage",
  "tours.optimize",
  "stops.add_own",
  "stops.update_status_own",
  "stops.manage",
  "imports.run",
  "tracking.view_live",
  "reports.view",
  "reports.export",
];

const ADMIN: readonly Permission[] = [
  ...DISPATCHER,
  "org.settings.manage",
  "org.billing.view",
  "org.members.manage",
  "depots.manage",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  owner: new Set(ADMIN),
  admin: new Set(ADMIN),
  dispatcher: new Set(DISPATCHER),
  driver: new Set<Permission>([
    "depots.view",
    "tours.view_own",
    "tours.optimize",
    "stops.add_own",
    "stops.update_status_own",
    "imports.run",
  ]),
};

export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].has(permission);
}

/** Only owners may grant or revoke the owner role. */
export function canAssignRole(actor: OrgRole, target: OrgRole): boolean {
  if (!can(actor, "org.members.manage")) return false;
  return target !== "owner" || actor === "owner";
}

/** Platform-level roles (TURVIO operator staff), separate from tenant roles. */
export type PlatformRole = "platform_admin";
