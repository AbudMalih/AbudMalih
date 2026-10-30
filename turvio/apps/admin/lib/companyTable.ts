import type { TenantRow } from "./platform";

export type SortKey = "name" | "plan" | "drivers" | "renewsAt" | "createdAt";
export type SortDir = "asc" | "desc";
export type StatusFilter = TenantRow["subscriptionStatus"] | "suspended";

export interface TableQuery {
  search: string;
  statuses: StatusFilter[];
  plans: string[];
  sort: SortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: TableQuery = { search: "", statuses: [], plans: [], sort: "createdAt", dir: "desc", page: 0, pageSize: 8 };

/** Status shown in the table: a suspended organization overrides its subscription state. */
export function displayStatus(row: TenantRow): StatusFilter {
  return row.orgStatus === "suspended" ? "suspended" : row.subscriptionStatus;
}

const PLAN_RANK: Record<string, number> = { driver_solo: 0, team: 1, business: 2 };

export function applyQuery(rows: TenantRow[], q: TableQuery) {
  const term = q.search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (term && ![r.name, r.slug, r.countryCode, r.planName].some((v) => v.toLowerCase().includes(term))) return false;
    if (q.statuses.length && !q.statuses.includes(displayStatus(r))) return false;
    if (q.plans.length && !q.plans.includes(r.planCode)) return false;
    return true;
  });
  const factor = q.dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    let c = 0;
    switch (q.sort) {
      case "name":
        c = a.name.localeCompare(b.name, "de");
        break;
      case "plan":
        c = (PLAN_RANK[a.planCode] ?? 99) - (PLAN_RANK[b.planCode] ?? 99);
        break;
      case "drivers":
        c = a.activeDrivers - b.activeDrivers;
        break;
      case "renewsAt":
        c = a.renewsAt.localeCompare(b.renewsAt);
        break;
      case "createdAt":
        c = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    return c * factor || a.name.localeCompare(b.name, "de");
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / q.pageSize));
  const page = Math.min(q.page, pageCount - 1);
  return {
    total: sorted.length,
    page,
    pageCount,
    rows: sorted.slice(page * q.pageSize, page * q.pageSize + q.pageSize),
    all: sorted,
  };
}

export function toCsv(rows: TenantRow[]): string {
  const header = ["id", "name", "country", "plan", "status", "billing", "seats", "active_drivers", "renews_at", "created_at"];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.id, r.name, r.countryCode, r.planName, displayStatus(r), r.interval === "month" ? "monthly" : "annual", r.seats, r.activeDrivers, r.renewsAt.slice(0, 10), r.createdAt.slice(0, 10)]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
