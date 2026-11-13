import { PLAN_CATALOGUE } from "@turvio/shared";
import { Avatar, FormAlert, PageHeader, cn } from "@turvio/web-ui/ds";
import { ArrowRightLeft, Building2, CircleAlert, CircleX, CreditCard, Hourglass, ShieldAlert, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewCompanyDialog } from "../../components/NewCompanyDialog";
import { AreaChart, AttentionRow, Bar, Delta, InfoTip, Kpi, Panel, ReasonRow, Ring } from "../../components/overview";
import { SystemHealthCard } from "../../components/SystemHealth";
import { displayStatus } from "../../lib/companyTable";
import { STATUS } from "../../lib/status";
import { attention, seatLimit } from "../../lib/attention";
import { loadPlatform } from "../../lib/load";
import { formatRelative, type ActivityKind } from "../../lib/platform";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const DAY = 86_400_000;

const FEED: Record<ActivityKind, { icon: LucideIcon; cls: string }> = {
  registration: { icon: Building2, cls: "bg-nx-violet-soft text-nx-violet-text" },
  plan_change: { icon: ArrowRightLeft, cls: "bg-nx-cobalt-soft text-nx-cobalt-text" },
  trial_ending: { icon: Hourglass, cls: "bg-nx-amber-soft text-nx-amber" },
  trial_expired: { icon: Hourglass, cls: "bg-nx-coral-soft text-nx-coral" },
  invitation: { icon: UserPlus, cls: "bg-nx-mint-soft text-nx-mint" },
  payment_failed: { icon: CircleAlert, cls: "bg-nx-coral-soft text-nx-coral" },
  cancellation: { icon: CircleX, cls: "bg-surface-2 text-muted" },
};

const PLAN_COLOR: Record<string, string> = { driver_solo: "var(--cyan)", team: "var(--cobalt)", business: "var(--violet)" };

export default async function OverviewPage() {
  const p = await loadPlatform();
  if (!p.ok) {
    return (
      <>
        <PageHeader title="Platform overview" />
        <FormAlert>The TURVIO service returned an error (HTTP {p.status}). Reload to try again.</FormAlert>
      </>
    );
  }
  const { now, rows, kpi, events, orgs } = p;
  const usable = rows.filter((r) => r.usable);
  const seatsTotal = usable.reduce((n, r) => n + (seatLimit(r) ?? 0), 0);
  const usableShare = rows.length ? usable.length / rows.length : 0;
  const monthLabels = kpi.companiesByMonth.map((_, i) => (i === 5 ? "Now" : new Date(now.getTime() - (5 - i) * 30 * DAY).toLocaleDateString("en-GB", { month: "short" })));
  const seatRows = [...rows].filter((r) => seatLimit(r)).sort((a, b) => b.activeDrivers / (seatLimit(b) || 1) - a.activeDrivers / (seatLimit(a) || 1)).slice(0, 5);
  const planMix = PLAN_CATALOGUE.map((pl) => ({ code: pl.code, name: pl.name, n: rows.filter((r) => r.planCode === pl.code).length })).filter((x) => x.n > 0);
  const recent = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const todo = attention(rows, now);

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="All companies and subscriptions at a glance · aggregates only, no delivery data"
        actions={<NewCompanyDialog />}
      />

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        {/* Hero (prototype .hero): headline figure, three stats, real growth series */}
        <section className="relative flex min-h-[330px] flex-col overflow-hidden rounded-[26px] border border-[color:var(--hero-line)] bg-[image:var(--hero-bg)] px-7 pt-[26px] shadow-overlay xl:col-span-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(var(--hero-line)_1px,transparent_1px),linear-gradient(90deg,var(--hero-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(80%_90%_at_85%_10%,#000_0%,transparent_70%)]"
          />
          <div className="relative flex flex-wrap items-start gap-7">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-nx-violet-text">Companies on TURVIO</div>
              <div className="mt-2.5 text-[64px] font-extrabold leading-none tracking-[-0.035em] text-ink tabular max-sm:text-[46px]">{kpi.companies}</div>
              <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-[color:var(--hero-text-2)]">
                <Delta value={kpi.newLast30} />
                new in the last 30 days
              </div>
            </div>
            <div className="ms-auto grid grid-cols-3 gap-x-[30px] gap-y-2.5 pt-1.5 max-sm:ms-0">
              {[
                { v: kpi.activeSubscriptions, l: "Active subscriptions", d: kpi.pastDue ? <span className="text-xs font-bold text-nx-coral">{kpi.pastDue} past due</span> : null },
                { v: kpi.trials, l: "Trials", d: kpi.trialsEndingSoon ? <span className="text-xs font-bold text-nx-amber">{kpi.trialsEndingSoon} ending ≤ 7 days</span> : null },
                { v: kpi.activeDrivers, l: "Active drivers", d: null },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-extrabold tracking-[-0.02em] text-ink tabular">{s.v}</div>
                  <div className="text-[12.5px] font-semibold text-[color:var(--hero-text-2)]">{s.l}</div>
                  {s.d}
                </div>
              ))}
            </div>
          </div>
          <div className="relative -mx-7 mt-[18px] min-h-[150px] flex-1">
            <AreaChart id="growth" values={kpi.companiesByMonth} labels={monthLabels} />
          </div>
        </section>

        {/* Live card (prototype .live): ring + per-company rows */}
        <Panel
          className="flex flex-col xl:col-span-4"
          title={
            <span className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-nx-mint animate-nx-live" aria-hidden="true" />
              Subscriptions
            </span>
          }
          description={`As of ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring value={usableShare} label={`${Math.round(usableShare * 100)} % of companies have a usable subscription`} />
            </div>
            <div className="min-w-0">
              <div className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular">{Math.round(usableShare * 100)} %</div>
              <div className="mt-1 text-[13px] text-ink-2">
                {usable.length} of {rows.length} companies with access
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-lg font-extrabold text-ink tabular">{kpi.activeDrivers}</div>
                  <div className="text-xs font-semibold text-muted">drivers</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-ink tabular">{seatsTotal}</div>
                  <div className="text-xs font-semibold text-muted">driver seats</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Driver seats in use</div>
            {seatRows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 border-t border-line py-[9px] first:mt-1">
                <span className="truncate text-[13px] font-semibold text-ink">{r.name}</span>
                <span className="text-[13px] font-bold text-ink-2 tabular">
                  {r.activeDrivers} / {seatLimit(r)}
                </span>
                <div className="col-span-2">
                  <Bar value={r.activeDrivers / (seatLimit(r) || 1)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* KPI row (prototype .kpi) */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi accent="cobalt" icon={<UserPlus />} label="Active drivers" value={kpi.activeDrivers} of={seatsTotal || undefined} progress={seatsTotal ? kpi.activeDrivers / seatsTotal : undefined} foot={seatsTotal ? `${Math.round((kpi.activeDrivers / seatsTotal) * 100)} % of seats in companies with access` : "in companies with access"} info="Active driver profiles in companies whose subscription is usable." />
        <Kpi accent="amber" icon={<Hourglass />} label="Trial accounts" value={kpi.trials} foot={kpi.trialsEndingSoon ? <span className="font-semibold text-nx-amber">{kpi.trialsEndingSoon} ending within 7 days</span> : "none ending within 7 days"} href="/companies" />
        <Kpi accent="coral" icon={<ShieldAlert />} label="Payment issues" value={kpi.pastDue + rows.filter((r) => r.orgStatus === "suspended").length} foot={`${kpi.pastDue} past due · ${rows.filter((r) => r.orgStatus === "suspended").length} suspended`} href="/companies" />
        <Kpi
          accent="violet"
          icon={<Wallet />}
          label="Monthly recurring revenue"
          value={kpi.mrrCents === null ? <span className="text-muted">—</span> : eur.format(kpi.mrrCents / 100)}
          foot={kpi.mrrCents === null ? "Plan prices not configured · payments off" : "from active subscriptions"}
          href="/plans"
        />
      </section>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        {/* Organizations (prototype "Standorte im Vergleich" table style) */}
        <Panel
          className="xl:col-span-8"
          title="Organizations"
          description="Newest first · plan, status and driver seats"
          action={
            <Link href="/companies" className="inline-flex h-8 items-center rounded-[10px] border border-line-strong px-3 text-[12.5px] font-bold text-ink transition-colors hover:border-line-3">
              All organizations
            </Link>
          }
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-start text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 pb-2.5 text-start">Organization</th>
                  <th className="px-3 pb-2.5 text-start">Plan</th>
                  <th className="px-3 pb-2.5 text-start">Status</th>
                  <th className="px-3 pb-2.5 text-end">Depots</th>
                  <th className="px-3 pb-2.5 text-start">Drivers / seats</th>
                  <th className="px-3 pb-2.5 text-start">Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const st = STATUS[displayStatus(r)];
                  const limit = seatLimit(r);
                  return (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} square />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-ink">{r.name}</div>
                            <div className="truncate text-xs text-muted">
                              {orgById.get(r.id)?.members ?? 0} members · {r.countryCode}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-ink-2">{r.planName}</td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex h-6 items-center rounded-lg px-[9px] text-xs font-bold", st.cls)}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3 text-end font-semibold tabular text-ink-2">{orgById.get(r.id)?.depots ?? 0}</td>
                      <td className="w-[180px] px-3 py-3">
                        <div className="mb-1 text-[12.5px] font-bold tabular text-ink">
                          {r.activeDrivers}
                          <span className="font-semibold text-muted"> / {limit ?? "∞"}</span>
                        </div>
                        {limit ? <Bar value={r.activeDrivers / limit} /> : null}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-ink-2">{new Date(r.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Plan mix (prototype "exceptions by reason" bars) */}
        <Panel className="xl:col-span-4" title="Plan mix" description="Companies per plan" action={<InfoTip text="Counted from the companies' current subscriptions." />}>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular">{rows.length}</span>
            <span className="text-[13px] font-semibold text-muted">companies</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {planMix.map((m) => (
              <ReasonRow key={m.code} label={m.name} value={m.n} share={rows.length ? m.n / rows.length : 0} color={PLAN_COLOR[m.code] ?? "var(--cyan)"} />
            ))}
            {planMix.length === 0 && <p className="text-[13px] text-muted">No subscriptions yet.</p>}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
            <CreditCard className="size-4 shrink-0 text-muted" />
            Online payments are off – subscriptions are managed manually.
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <SystemHealthCard />
        </div>

        <Panel className="xl:col-span-4" title="Needs attention" description={todo.length ? `${todo.length} item${todo.length === 1 ? "" : "s"}` : "From subscriptions and seats"}>
          {todo.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] font-semibold text-ink-2">
              <span className="size-2 rounded-full bg-nx-mint" aria-hidden="true" />
              Nothing needs attention right now.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {todo.slice(0, 4).map((x) => (
                <AttentionRow key={x.title} tone={x.tone} title={x.title} detail={x.detail} href="/companies" />
              ))}
            </div>
          )}
        </Panel>

        {/* Activity feed (prototype .feed) */}
        <Panel
          className="lg:col-span-2 xl:col-span-4"
          title="Activity"
          description="Audit log: companies, subscriptions, members, invitations"
          action={
            <Link href="/activity" className="text-xs font-bold text-nx-violet-text hover:underline">
              All
            </Link>
          }
        >
          {events.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">No recent activity.</p>
          ) : (
            <ol className="flex flex-col">
              {events.slice(0, 6).map((e) => {
                const k = FEED[e.kind];
                const Icon = k.icon;
                return (
                  <li key={e.id} className="grid grid-cols-[36px_1fr_auto] items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-1">
                    <span className={cn("grid size-9 place-items-center rounded-[11px]", k.cls)}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{e.detail}</div>
                      <div className="truncate text-[12.5px] text-muted">{e.orgName}</div>
                    </div>
                    <time dateTime={e.at} className="whitespace-nowrap text-xs font-semibold text-muted">
                      {formatRelative(e.at, now)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
