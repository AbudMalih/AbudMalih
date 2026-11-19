import { displayStatus } from "./companyTable";
import { EN_T, createFormat, type Format, type TFunction } from "./i18n";
import type { TenantRow } from "./platform";

const DAY = 86_400_000;
const EN_FMT = createFormat("en");

export function seatLimit(r: TenantRow) {
  return r.driverLimit ?? r.seats;
}

export interface AttentionItem {
  id: string;
  orgId: string;
  tone: "coral" | "amber" | "violet" | "cobalt";
  title: string;
  detail: string;
  rank: number;
}

/** Items an operator should act on – derived from real subscription and seat states only. */
export function attention(rows: TenantRow[], now: Date, t: TFunction = EN_T, fmt: Format = EN_FMT): AttentionItem[] {
  const items: AttentionItem[] = [];
  // Dates of subscriptions are instants; shown as calendar days in UTC so server and browser agree.
  const day = (iso: string) => fmt.date(iso, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  for (const r of rows) {
    const days = Math.ceil((new Date(r.renewsAt).getTime() - now.getTime()) / DAY);
    const st = displayStatus(r);
    const p = { name: r.name };
    if (st === "suspended") items.push({ id: `${r.id}:suspended`, orgId: r.id, tone: "coral", title: t("overview.att.suspended", p), detail: t("overview.att.suspendedDetail"), rank: 0 });
    else if (st === "past_due") items.push({ id: `${r.id}:due`, orgId: r.id, tone: "coral", title: t("overview.att.pastDue", p), detail: t("overview.att.pastDueDetail", { plan: r.planName, date: day(r.renewsAt) }), rank: 1 });
    else if (st === "trialing" && days < 0) items.push({ id: `${r.id}:expired`, orgId: r.id, tone: "coral", title: t("overview.att.trialExpired", p), detail: t("overview.att.trialExpiredDetail", { count: -days, plan: r.planName }), rank: 1 });
    else if (st === "trialing" && days <= 7) items.push({ id: `${r.id}:trial`, orgId: r.id, tone: "amber", title: t("overview.att.trialEnds", { ...p, count: days }), detail: t("overview.att.trialEndsDetail", { plan: r.planName, count: r.seats }), rank: 2 });
    if (r.cancelAtPeriodEnd) items.push({ id: `${r.id}:cancel`, orgId: r.id, tone: "cobalt", title: t("overview.att.cancels", p), detail: t("overview.att.cancelsDetail", { date: day(r.renewsAt) }), rank: 3 });
    const limit = seatLimit(r);
    if (r.usable && limit && r.activeDrivers >= limit) items.push({ id: `${r.id}:seats`, orgId: r.id, tone: "violet", title: t("overview.att.seatsFull", p), detail: t("overview.att.seatsFullDetail", { used: r.activeDrivers, limit }), rank: 4 });
  }
  return items.sort((a, b) => a.rank - b.rank);
}
