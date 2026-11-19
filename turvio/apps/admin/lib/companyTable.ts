import type { TenantRow } from "./platform";

export type StatusFilter = TenantRow["subscriptionStatus"] | "suspended";

/** Status shown for a company: a suspended organization overrides its subscription state. */
export function displayStatus(row: Pick<TenantRow, "orgStatus" | "subscriptionStatus">): StatusFilter {
  return row.orgStatus === "suspended" ? "suspended" : row.subscriptionStatus;
}
