import { KpiCard, PageHeader, Sparkline } from "@turvio/web-ui/ds";
import { Building2, CircleCheck, Hourglass, TrendingUp, Truck, Wallet } from "lucide-react";
import { ActivityPanel } from "../components/ActivityPanel";
import { AdminShell } from "../components/AdminShell";
import { CompanyTable } from "../components/CompanyTable";
import { activityFeed, platformKpis, platformTenants, toRow } from "../lib/platform";

// Data is evaluated per request so dates and trial states are current.
export const dynamic = "force-dynamic";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function DashboardPage() {
  const now = new Date();
  const records = platformTenants(now);
  const rows = records.map((r) => toRow(r, now));
  const kpi = platformKpis(records, now);
  const events = activityFeed(records, now);

  return (
    <AdminShell crumbs={[{ label: "Platform", href: "/" }, { label: "Dashboard" }]}>
      <PageHeader
        title="Platform overview"
        description="Companies, subscriptions and usage across all TURVIO tenants. Figures are computed from synthetic demo records."
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Companies"
          value={kpi.companies}
          icon={<Building2 />}
          accent="navy"
          trend={{ delta: kpi.newLast30, label: "new in 30 days" }}
        />
        <KpiCard
          label="Active subscriptions"
          value={kpi.activeSubscriptions}
          icon={<CircleCheck />}
          accent="success"
          footnote={kpi.pastDue > 0 ? `${kpi.pastDue} past due` : "none past due"}
        />
        <KpiCard
          label="Trial accounts"
          value={kpi.trials}
          icon={<Hourglass />}
          accent="warning"
          footnote={`${kpi.trialsEndingSoon} ending within 7 days`}
        />
        <KpiCard
          label="Monthly recurring revenue"
          value={kpi.mrrCents === null ? <span className="text-subtle">—</span> : eur.format(kpi.mrrCents / 100)}
          icon={<Wallet />}
          footnote={kpi.mrrCents === null ? "Plan prices not configured · payments off" : "from active subscriptions"}
        />
        <KpiCard label="Active drivers" value={kpi.activeDrivers} icon={<Truck />} footnote="in companies with access" />
        <KpiCard
          label="Subscription growth"
          value={`+${kpi.newLast30}`}
          icon={<TrendingUp />}
          trend={{ delta: kpi.newLast30 - kpi.newPrev30, label: "vs. previous 30 days" }}
          sparkline={<Sparkline values={kpi.companiesByMonth} label={`Companies over the last 6 months: ${kpi.companiesByMonth.join(", ")}`} />}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <CompanyTable rows={rows} now={now.getTime()} />
        <ActivityPanel events={events} now={now} />
      </div>
    </AdminShell>
  );
}
