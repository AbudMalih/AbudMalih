import { PLAN_CATALOGUE } from "@turvio/shared";
import { Avatar, FormAlert, PageHeader, cn } from "@turvio/web-ui/ds";
import { ArrowRightLeft, Building2, CircleAlert, CircleX, CreditCard, Hourglass, ShieldAlert, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { When } from "../../components/When";
import { NewCompanyDialog } from "../../components/NewCompanyDialog";
import { AreaChart, AttentionRow, Bar, Delta, InfoTip, Kpi, Panel, ReasonRow, Ring } from "../../components/overview";
import { SystemHealthCard } from "../../components/SystemHealth";
import { displayStatus } from "../../lib/companyTable";
import { STATUS } from "../../lib/status";
import { attention, seatLimit } from "../../lib/attention";
import { loadPlatform } from "../../lib/load";
import { isDesignG } from "../../lib/ui-server";
import { createFormat } from "../../lib/i18n";
import { serverT } from "../../lib/i18n/server";
import type { ActivityKind } from "../../lib/platform";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("shell.nav.overview") };
}
export const dynamic = "force-dynamic";

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
  const { t, locale } = await serverT();
  const fmt = createFormat(locale);
  if (!p.ok) {
    return (
      <>
        <PageHeader title={t("overview.title")} />
        <FormAlert>{t("common.loadFailed")}</FormAlert>
      </>
    );
  }
  const eur = new Intl.NumberFormat(fmt.tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const { now, rows, kpi, events, orgs } = p;
  const usable = rows.filter((r) => r.usable);
  const seatsTotal = usable.reduce((n, r) => n + (seatLimit(r) ?? 0), 0);
  const usableShare = rows.length ? usable.length / rows.length : 0;
  const monthLabels = kpi.companiesByMonth.map((_, i) => (i === 5 ? t("overview.now") : fmt.date(now.getTime() - (5 - i) * 30 * DAY, { month: "short", timeZone: "UTC" })));
  const seatRows = [...rows].filter((r) => seatLimit(r)).sort((a, b) => b.activeDrivers / (seatLimit(b) || 1) - a.activeDrivers / (seatLimit(a) || 1)).slice(0, 5);
  const planMix = PLAN_CATALOGUE.map((pl) => ({ code: pl.code, name: pl.name, n: rows.filter((r) => r.planCode === pl.code).length })).filter((x) => x.n > 0);
  const noPlan = orgs.filter((o) => !o.subscription).length;
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const recent = [...orgs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const todo = attention(rows, now, t, fmt);
  const pct = (v: number) => fmt.percent(v);
  const g = await isDesignG();
  const suspended = rows.filter((r) => r.orgStatus === "suspended").length;

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.description")}
        actions={<NewCompanyDialog />}
      />

      {g && (
        <>
          {/* Phase G: one KPI band (label · figure · one line of context), no hero or ring. */}
          <section
            aria-label={t("overview.keyMetrics")}
            className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line [&>*]:border-b xl:[&>*]:border-b-0 [&>*:not(:first-child)]:border-s max-md:[&>*:nth-child(odd)]:border-s-0 md:max-xl:[&>*:nth-child(3n+1)]:border-s-0"
          >
            <Kpi accent="violet" icon={<Building2 />} label={t("overview.kpi.companies")} value={kpi.companies} foot={<><Delta value={kpi.newLast30} /> {t("overview.kpi.newLast30")}</>} href="/companies" />
            <Kpi accent="cobalt" icon={<CreditCard />} label={t("overview.kpi.activeSubs")} value={kpi.activeSubscriptions} foot={kpi.pastDue ? <span className="text-danger-ink">{t("overview.kpi.pastDue", { count: kpi.pastDue })}</span> : t("overview.kpi.nonePastDue")} href="/companies" />
            <Kpi accent="amber" icon={<Hourglass />} label={t("overview.kpi.trials")} value={kpi.trials} foot={kpi.trialsEndingSoon ? <span className="text-warning-ink">{t("overview.kpi.endingSoon", { count: kpi.trialsEndingSoon })}</span> : t("overview.kpi.noneEndingSoon")} href="/companies" />
            <Kpi accent="cobalt" icon={<UserPlus />} label={t("overview.kpi.drivers")} value={kpi.activeDrivers} of={seatsTotal || undefined} progress={seatsTotal ? kpi.activeDrivers / seatsTotal : undefined} foot={seatsTotal ? t("overview.kpi.seatShare", { share: pct(kpi.activeDrivers / seatsTotal) }) : t("overview.kpi.withAccess")} info={t("overview.kpi.driversInfo")} />
            <Kpi accent="coral" icon={<ShieldAlert />} label={t("overview.kpi.paymentIssues")} value={kpi.pastDue + suspended} foot={t("overview.kpi.paymentIssuesFoot", { due: kpi.pastDue, suspended })} href="/companies" />
            <Kpi accent="violet" icon={<Wallet />} label={t("overview.kpi.mrr")} value={kpi.mrrCents === null ? <span className="text-muted">—</span> : eur.format(kpi.mrrCents / 100)} foot={kpi.mrrCents === null ? t("overview.kpi.mrrNone") : t("overview.kpi.mrrFoot")} href="/plans" />
          </section>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel className="flex flex-col xl:col-span-8" title={t("overview.growth")} description={t("overview.growthDescription")}>
              <div className="-mx-4 h-[188px]">
                <AreaChart id="growth" values={kpi.companiesByMonth} labels={monthLabels} />
              </div>
            </Panel>
            <Panel className="flex flex-col xl:col-span-4" title={t("overview.subscriptions")} description={<AsOf iso={now.toISOString()} label={t("overview.asOf")} />}>
              <div className="flex items-baseline gap-2">
                <span className="whitespace-nowrap text-[22px] font-medium tabular text-ink">{pct(usableShare)}</span>
                <span className="text-[12px] text-muted">{t("overview.accessSummary", { usable: usable.length, total: rows.length, drivers: kpi.activeDrivers, seats: seatsTotal })}</span>
              </div>
              <div className="mt-3 text-[12px] font-medium text-ink-2">{t("overview.seatsInUse")}</div>
              {seatRows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 border-t border-line py-2 first:mt-1.5">
                  <span className="truncate text-[13px] text-ink">{r.name}</span>
                  <span className="text-[13px] font-medium tabular text-ink-2">
                    {r.activeDrivers} / {seatLimit(r)}
                  </span>
                  <div className="col-span-2">
                    <Bar value={r.activeDrivers / (seatLimit(r) || 1)} />
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
      {!g && (
        <>
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        {/* Hero (prototype .hero): headline figure, three stats, real growth series */}
        <section className="relative flex min-h-[330px] flex-col overflow-hidden rounded-[26px] border border-[color:var(--hero-line)] bg-[image:var(--hero-bg)] px-7 pt-[26px] shadow-overlay xl:col-span-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(var(--hero-line)_1px,transparent_1px),linear-gradient(90deg,var(--hero-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(80%_90%_at_85%_10%,#000_0%,transparent_70%)]"
          />
          <div className="relative flex flex-wrap items-start gap-7">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-nx-violet-text">{t("overview.kpi.companies")}</div>
              <div className="mt-2.5 text-[64px] font-extrabold leading-none tracking-[-0.035em] text-ink tabular max-sm:text-[46px]">{kpi.companies}</div>
              <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-[color:var(--hero-text-2)]">
                <Delta value={kpi.newLast30} />
                {t("overview.kpi.newLast30")}
              </div>
            </div>
            <div className="ms-auto grid grid-cols-3 gap-x-[30px] gap-y-2.5 pt-1.5 max-sm:ms-0">
              {[
                { v: kpi.activeSubscriptions, l: t("overview.kpi.activeSubs"), d: kpi.pastDue ? <span className="text-xs font-bold text-nx-coral">{t("overview.kpi.pastDue", { count: kpi.pastDue })}</span> : null },
                { v: kpi.trials, l: t("overview.kpi.trials"), d: kpi.trialsEndingSoon ? <span className="text-xs font-bold text-nx-amber">{t("overview.kpi.endingSoon", { count: kpi.trialsEndingSoon })}</span> : null },
                { v: kpi.activeDrivers, l: t("overview.kpi.drivers"), d: null },
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
              {t("overview.subscriptions")}
            </span>
          }
          description={<AsOf iso={now.toISOString()} label={t("overview.asOf")} />}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring value={usableShare} label={t("overview.ringLabel", { share: pct(usableShare) })} />
            </div>
            <div className="min-w-0">
              <div className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular">{pct(usableShare)}</div>
              <div className="mt-1 text-[13px] text-ink-2">{t("overview.withAccess", { usable: usable.length, total: rows.length })}</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-lg font-extrabold text-ink tabular">{kpi.activeDrivers}</div>
                  <div className="text-xs font-semibold text-muted">{t("overview.drivers")}</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-ink tabular">{seatsTotal}</div>
                  <div className="text-xs font-semibold text-muted">{t("overview.driverSeats")}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t("overview.seatsInUse")}</div>
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
      <section aria-label={t("overview.keyMetrics")} className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi accent="cobalt" icon={<UserPlus />} label={t("overview.kpi.drivers")} value={kpi.activeDrivers} of={seatsTotal || undefined} progress={seatsTotal ? kpi.activeDrivers / seatsTotal : undefined} foot={seatsTotal ? t("overview.kpi.seatShare", { share: pct(kpi.activeDrivers / seatsTotal) }) : t("overview.kpi.withAccess")} info={t("overview.kpi.driversInfo")} />
        <Kpi accent="amber" icon={<Hourglass />} label={t("overview.kpi.trials")} value={kpi.trials} foot={kpi.trialsEndingSoon ? <span className="font-semibold text-nx-amber">{t("overview.kpi.endingSoon", { count: kpi.trialsEndingSoon })}</span> : t("overview.kpi.noneEndingSoon")} href="/companies" />
        <Kpi accent="coral" icon={<ShieldAlert />} label={t("overview.kpi.paymentIssues")} value={kpi.pastDue + suspended} foot={t("overview.kpi.paymentIssuesFoot", { due: kpi.pastDue, suspended })} href="/companies" />
        <Kpi
          accent="violet"
          icon={<Wallet />}
          label={t("overview.kpi.mrr")}
          value={kpi.mrrCents === null ? <span className="text-muted">—</span> : eur.format(kpi.mrrCents / 100)}
          foot={kpi.mrrCents === null ? t("overview.kpi.mrrNone") : t("overview.kpi.mrrFoot")}
          href="/plans"
        />
      </section>
        </>
      )}

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12 g:gap-4">
        {/* Organizations (prototype "Standorte im Vergleich" table style) */}
        <Panel
          className="xl:col-span-8"
          title={t("overview.companies")}
          description={t("overview.companiesDescription")}
          action={
            <Link href="/companies" className="inline-flex h-8 items-center rounded-[10px] border border-line-strong px-3 text-[12.5px] font-bold text-ink transition-colors hover:border-line-3 g:h-7 g:rounded-md g:border-line-2 g:px-2.5 g:font-medium">
              {t("overview.allCompanies")}
            </Link>
          }
        >
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-start text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 pb-2.5 text-start">{t("common.company")}</th>
                  <th className="px-3 pb-2.5 text-start">{t("common.plan")}</th>
                  <th className="px-3 pb-2.5 text-start">{t("common.status")}</th>
                  <th className="px-3 pb-2.5 text-end">{t("common.depots")}</th>
                  <th className="px-3 pb-2.5 text-start">{t("overview.driversSeats")}</th>
                  <th className="px-3 pb-2.5 text-start">{t("common.created")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const r = rowById.get(o.id);
                  const key = r ? displayStatus(r) : o.status === "suspended" ? "suspended" : null;
                  const st = key ? STATUS[key] : null;
                  const limit = r ? seatLimit(r) : null;
                  return (
                    <tr key={o.id} className="border-t border-line g:hover:bg-[var(--hover)]">
                      <td className="px-3 py-3">
                        <Link href={`/companies/${o.id}`} className="flex items-center gap-2.5 rounded outline-none focus-visible:shadow-[var(--shadow-focus)]">
                          <Avatar name={o.name} square className="g:size-6 g:text-[10px]" />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-ink g:font-medium">{o.name}</div>
                            <div className="truncate text-xs text-muted">
                              {t("overview.membersCountry", { count: o.members, country: o.countryCode })}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-semibold text-ink-2 g:font-normal">{r ? r.planName : <span className="text-muted">{t("common.noPlan")}</span>}</td>
                      <td className="px-3 py-3">
                        {st && key ? (
                          <span className={cn("inline-flex h-6 items-center rounded-lg px-[9px] text-xs font-bold g:h-auto g:gap-1.5 g:bg-transparent g:px-0 g:font-medium", st.cls)}>
                            <span className={cn("hidden size-1.5 rounded-full g:inline-block", st.dot)} aria-hidden="true" />
                            {t(`common.status.${key}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-end font-semibold tabular text-ink-2">{o.depots}</td>
                      <td className="w-[180px] px-3 py-3">
                        <div className="mb-1 text-[12.5px] font-bold tabular text-ink">
                          {o.activeDrivers}
                          <span className="font-semibold text-muted"> / {limit ?? "∞"}</span>
                        </div>
                        {limit ? <Bar value={o.activeDrivers / limit} /> : null}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                        <When iso={new Date(o.createdAt).toISOString()} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Plan mix (prototype "exceptions by reason" bars) */}
        <Panel className="xl:col-span-4" title={t("overview.planMix")} description={t("overview.planMixDescription")} action={<InfoTip text={t("overview.planMixInfo")} />}>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular g:text-[22px] g:font-medium">{orgs.length}</span>
            <span className="text-[13px] font-semibold text-muted">{t("overview.companiesWord", { count: orgs.length })}</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {planMix.map((m) => (
              <ReasonRow key={m.code} label={m.name} value={m.n} share={orgs.length ? m.n / orgs.length : 0} shareText={pct(orgs.length ? m.n / orgs.length : 0)} color={PLAN_COLOR[m.code] ?? "var(--cyan)"} />
            ))}
            {noPlan > 0 && <ReasonRow label={t("common.noPlan")} value={noPlan} share={noPlan / orgs.length} shareText={pct(noPlan / orgs.length)} color="var(--text-3)" />}
            {orgs.length === 0 && <p className="text-[13px] text-muted">{t("overview.noCompanies")}</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2 xl:grid-cols-12 g:gap-4">
        <div className="xl:col-span-4">
          <SystemHealthCard />
        </div>

        <Panel className="xl:col-span-4" title={t("overview.attention")} description={todo.length ? t("overview.items", { count: todo.length }) : t("overview.attentionDescription")}>
          {todo.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] font-semibold text-ink-2 g:border-0 g:bg-transparent g:p-0 g:font-normal">
              <span className="size-2 rounded-full bg-nx-mint" aria-hidden="true" />
              {t("overview.nothingToDo")}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 g:gap-0">
              {todo.slice(0, 4).map((x) => (
                <AttentionRow key={x.id} tone={x.tone} title={x.title} detail={x.detail} href={`/companies/${x.orgId}`} action={t("common.open")} />
              ))}
            </div>
          )}
        </Panel>

        {/* Activity feed (prototype .feed) */}
        <Panel
          className="lg:col-span-2 xl:col-span-4"
          title={t("overview.activity")}
          description={t("overview.activityDescription")}
          action={
            <Link href="/activity" className="text-xs font-bold text-nx-violet-text hover:underline g:font-normal g:text-muted g:hover:text-ink">
              {t("overview.all")}
            </Link>
          }
        >
          {events.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">{t("overview.noActivity")}</p>
          ) : (
            <ol className="flex flex-col">
              {events.slice(0, 6).map((e) => {
                const k = FEED[e.kind];
                const Icon = k.icon;
                return (
                  <li key={e.id} className="grid grid-cols-[36px_1fr_auto] items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-1 g:grid-cols-[16px_1fr_auto] g:gap-2 g:py-2">
                    <span className={cn("grid size-9 place-items-center rounded-[11px] g:size-4 g:bg-transparent g:text-muted", k.cls)}>
                      <Icon className="size-4 g:size-[14px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink g:text-[13px] g:font-normal">{e.detail}</div>
                      <div className="truncate text-[12.5px] text-muted g:text-[12px]">{e.orgName}</div>
                    </div>
                    <When iso={e.at} as="relative" now={now.getTime()} className="whitespace-nowrap text-xs font-semibold text-muted g:font-normal g:tabular" />
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

/** "As of 14:05" in the viewer's time zone (rendered in the browser). */
function AsOf({ iso, label }: { iso: string; label: string }) {
  return (
    <>
      {label} <When iso={iso} as="time" />
    </>
  );
}
