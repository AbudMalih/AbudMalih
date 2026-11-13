import { displayStatus } from "./companyTable";
import type { TenantRow } from "./platform";

const DAY = 86_400_000;

export function seatLimit(r: TenantRow) {
  return r.driverLimit ?? r.seats;
}

/** Items an operator should act on – derived from real subscription and seat states only. */
export function attention(rows: TenantRow[], now: Date) {
  const items: { tone: "coral" | "amber" | "violet" | "cobalt"; title: string; detail: string; rank: number }[] = [];
  for (const r of rows) {
    const days = Math.ceil((new Date(r.renewsAt).getTime() - now.getTime()) / DAY);
    const st = displayStatus(r);
    if (st === "suspended") items.push({ tone: "coral", title: `${r.name}: suspended`, detail: "Company access is blocked", rank: 0 });
    else if (st === "past_due") items.push({ tone: "coral", title: `${r.name}: payment past due`, detail: `${r.planName} · since ${new Date(r.renewsAt).toLocaleDateString("de-DE")}`, rank: 1 });
    else if (st === "trialing" && days < 0) items.push({ tone: "coral", title: `${r.name}: trial expired`, detail: `${-days} days ago · ${r.planName}`, rank: 1 });
    else if (st === "trialing" && days <= 7) items.push({ tone: "amber", title: `${r.name}: trial ends in ${days} day${days === 1 ? "" : "s"}`, detail: `${r.planName} · ${r.seats} seats`, rank: 2 });
    if (r.cancelAtPeriodEnd) items.push({ tone: "cobalt", title: `${r.name}: cancels at period end`, detail: `Access until ${new Date(r.renewsAt).toLocaleDateString("de-DE")}`, rank: 3 });
    const limit = seatLimit(r);
    if (r.usable && limit && r.activeDrivers >= limit) items.push({ tone: "violet", title: `${r.name}: driver seats full`, detail: `${r.activeDrivers} of ${limit} seats in use`, rank: 4 });
  }
  return items.sort((a, b) => a.rank - b.rank);
}

