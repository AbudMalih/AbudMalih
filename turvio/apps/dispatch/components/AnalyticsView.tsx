"use client";

import { can } from "@turvio/shared";
import { Button, Card, CardHeader, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Skeleton, Tooltip, cn } from "@turvio/web-ui/ds";
import { BarChart3, Download, Info, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { analyticsApi, delivered, notDelivered, num, pct, presetRange, type AnalyticsQuery, type DepotRow, type DriverRow, type Summary, type TourRow } from "../lib/analytics";
import { download } from "../lib/download";
import { fieldCls } from "../lib/helpers";
import { EN_T, type MessageKey, type TFunction } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { OutcomeBars, ReasonBars, SuccessLine } from "./AnalyticsCharts";
import { failureReasonLabel, tourStatusLabel } from "./StatusBadge";

type Preset = "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "last_30" | "custom";
const PRESETS: Preset[] = ["today", "yesterday", "week", "last_week", "month", "last_month", "last_30", "custom"];

/** KPI definitions the API sends (English); translated by key, unknown keys keep the server text. */
const DEF_KEYS = new Set([
  "stops", "delivered", "pickedUp", "failed", "attempted", "rescheduled", "returned", "skipped", "cancelled", "open", "processed", "successRate", "tours",
  "toursStarted", "completionRate", "onTimeStartRate", "avgTourMinutes", "activeHours", "stopsPerTour", "stopsPerActiveHour", "avgIntervalMinutes", "plannedDistanceKm", "plannedMinutes",
]);
const TOUR_STATUSES = new Set(["in_progress", "delayed", "paused", "planned", "completed", "cancelled"]);

/** Operational analytics from recorded data only. Planned (optimizer) figures are always labelled as such. */
export function AnalyticsView() {
  const { session, scoped, depotId, today } = useDispatch();
  const { t, fmt, locale } = useI18n();
  const api = useMemo(() => analyticsApi(session.organizationId), [session.organizationId]);
  const [preset, setPreset] = useState<Preset>("week");
  const [custom, setCustom] = useState(() => presetRange("last_30", today));
  const [depot, setDepot] = useState(depotId ?? "");
  const [driver, setDriver] = useState("");
  const [granularity, setGranularity] = useState<"" | "day" | "week" | "month">("");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState(false);
  useEffect(() => setDepot(depotId ?? ""), [depotId]);

  const range = preset === "custom" ? custom : presetRange(preset, today);
  const query: AnalyticsQuery = useMemo(
    () => ({ ...range, depotId: depot || undefined, driverId: driver || undefined, granularity: granularity || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range.from, range.to, depot, driver, granularity],
  );
  const key = JSON.stringify(query);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.summary(query).then(
      (s) => {
        if (!alive) return;
        setData(s);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (!alive) return;
        setError(errorMessage(e));
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const mayExport = can(session.role, "reports.export");
  const def = (k: string) => {
    const server = data?.definitions[k] ?? "";
    if (!server || locale === "en" || !DEF_KEYS.has(k)) return server;
    return t(`analytics.def.${k}` as MessageKey, { tolerance: data?.onTimeToleranceMinutes ?? 15 });
  };
  const cur = data?.current;
  const prev = data?.previous;
  const drivers = scoped.drivers.filter((d) => !depot || d.depotId === depot);
  const reasonLabel = (code: string | null) => {
    if (!code) return t("analytics.noReason");
    const l = failureReasonLabel(code, t);
    return l === code ? code.replace(/_/g, " ") : l;
  };
  const P = (v: number | null, digits?: number) => pct(v, digits, fmt);
  const N = (v: number | null, digits?: number) => num(v, digits, fmt);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{t("analytics.title")}</h1>
        <p className="text-sm text-ink-2">
          {t("analytics.intro")}
          {data && ` ${t("analytics.rangeNote", { from: fmt.day(data.range.from), to: fmt.day(data.range.to), tz: data.timeZone })}`}
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("analytics.period")}>
          {PRESETS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={preset === k}
              onClick={() => setPreset(k)}
              className={cn("h-8 rounded-[10px] px-3 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-ink", preset === k && "bg-brand-50 text-brand-700 hover:bg-brand-50")}
            >
              {t(`analytics.preset.${k}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preset === "custom" && (
            <>
              <input type="date" className={cn(fieldCls, "w-40")} value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label={t("analytics.from")} />
              <span className="text-muted">–</span>
              <input type="date" className={cn(fieldCls, "w-40")} value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label={t("analytics.to")} />
            </>
          )}
          <select className={cn(fieldCls, "w-44")} value={depot} onChange={(e) => (setDepot(e.target.value), setDriver(""))} aria-label={t("analytics.location")}>
            <option value="">{t("analytics.allLocations")}</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className={cn(fieldCls, "w-48")} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label={t("analytics.driver")}>
            <option value="">{t("analytics.allDrivers")}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
          <select className={cn(fieldCls, "w-40")} value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)} aria-label={t("analytics.groupBy")}>
            <option value="">{t("analytics.group.auto")}</option>
            <option value="day">{t("analytics.group.day")}</option>
            <option value="week">{t("analytics.group.week")}</option>
            <option value="month">{t("analytics.group.month")}</option>
          </select>
          {loading && <span className="text-2xs text-muted">{t("analytics.updating")}</span>}
        </div>
      </Card>

      {error && (
        <Card className="p-5 text-[13px] text-danger-ink" role="alert">
          {error}
        </Card>
      )}
      {!data && !error && <Skeleton className="h-72" />}

      {cur && prev && data && (
        <>
          <section aria-label={t("analytics.keyFigures")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi labelKey="analytics.kpi.successRate" value={P(cur.stops.successRate)} prev={P(prev.stops.successRate)} info={def("successRate")} />
            <Kpi labelKey="analytics.kpi.delivered" value={N(delivered(cur.stops))} prev={N(delivered(prev.stops))} info={`${def("delivered")} ${def("pickedUp")}`} />
            <Kpi labelKey="analytics.kpi.notDelivered" value={N(notDelivered(cur.stops))} prev={N(notDelivered(prev.stops))} info={t("analytics.notDeliveredInfo")} />
            <Kpi labelKey="analytics.kpi.open" value={N(cur.stops.open)} prev={N(prev.stops.open)} info={def("open")} />
            <Kpi labelKey="analytics.kpi.toursCompleted" value={`${N(cur.tours.byStatus.completed)} / ${N(cur.tours.tours)}`} prev={`${N(prev.tours.byStatus.completed)} / ${N(prev.tours.tours)}`} info={def("tours")} />
            <Kpi labelKey="analytics.kpi.completionRate" value={P(cur.tours.completionRate)} prev={P(prev.tours.completionRate)} info={def("completionRate")} />
            <Kpi labelKey="analytics.kpi.onTimeStarts" value={P(cur.tours.onTimeStartRate)} prev={P(prev.tours.onTimeStartRate)} info={def("onTimeStartRate")} />
            <Kpi labelKey="analytics.kpi.stopsPerActiveHour" value={N(cur.tours.stopsPerActiveHour, 1)} prev={N(prev.tours.stopsPerActiveHour, 1)} info={def("stopsPerActiveHour")} />
          </section>
          <p className="-mt-2 text-2xs text-muted">
            {data.previousRange.from === data.previousRange.to
              ? t("analytics.prevNoteDay")
              : t("analytics.prevNotePeriod", { from: fmt.day(data.previousRange.from), to: fmt.day(data.previousRange.to) })}{" "}
            {t("analytics.cancelledNote", { n: N(cur.stops.cancelled) })}
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader
                title={t("analytics.outcomesTitle")}
                description={t(`analytics.outcomesDesc.${data.granularity}`)}
                actions={
                  <div className="flex gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => setTable(!table)} aria-pressed={table}>
                      {table ? <BarChart3 /> : <Table2 />} {table ? t("analytics.chart") : t("analytics.table")}
                    </Button>
                    {mayExport && <ExportMenu api={api} query={query} view="trend" />}
                  </div>
                }
              />
              <div className="p-5">
                {data.trend.length === 0 ? (
                  <EmptyState icon={<BarChart3 />} title={t("analytics.noTours")} description={t("analytics.noToursDesc")} />
                ) : table ? (
                  <TrendTable data={data} />
                ) : (
                  <div className="flex flex-col gap-5">
                    <OutcomeBars trend={data.trend} granularity={data.granularity} />
                    <div>
                      <h4 className="mb-1 text-[12.5px] font-bold text-ink">{t("analytics.kpi.successRate")}</h4>
                      <SuccessLine trend={data.trend} granularity={data.granularity} />
                    </div>
                  </div>
                )}
              </div>
            </Card>
            <div className="flex flex-col gap-4">
              <Card className="overflow-hidden">
                <CardHeader title={t("analytics.reasonsTitle")} description={t("analytics.reasonsDesc")} />
                <div className="p-5">
                  <ReasonBars rows={data.failureReasons} label={reasonLabel} />
                </div>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader title={t("analytics.actualPlannedTitle")} description={t("analytics.actualPlannedDesc")} />
                <dl className="grid grid-cols-2 gap-4 p-5 text-[13px]">
                  <Figure
                    label={t("analytics.fig.avgTour")}
                    value={cur.tours.avgTourMinutes === null ? "–" : t("common.min", { n: N(cur.tours.avgTourMinutes) })}
                    sub={t("analytics.fig.avgTourSub")}
                    info={def("avgTourMinutes")}
                  />
                  <Figure
                    label={t("analytics.fig.activeHours")}
                    value={t("analytics.fig.hours", { n: N(cur.tours.activeHours, 1) })}
                    sub={t("analytics.fig.toursStarted", { count: cur.tours.toursStarted })}
                    info={def("activeHours")}
                  />
                  <Figure
                    label={t("analytics.fig.plannedDistance")}
                    value={cur.tours.planned.plannedDistanceKm === null ? "–" : t("common.km", { n: N(cur.tours.planned.plannedDistanceKm) })}
                    sub={t("analytics.fig.optimizerCoverage", { covered: cur.tours.planned.coveredTours, total: cur.tours.tours })}
                    info={def("plannedDistanceKm")}
                    planned
                  />
                  <Figure
                    label={t("analytics.fig.plannedMinutes")}
                    value={cur.tours.planned.plannedMinutes === null ? "–" : t("common.min", { n: N(cur.tours.planned.plannedMinutes) })}
                    sub={t("analytics.fig.optimizerTours", { covered: cur.tours.planned.coveredTours })}
                    info={def("plannedMinutes")}
                    planned
                  />
                  <Figure
                    label={t("analytics.fig.interval")}
                    value={cur.avgIntervalMinutes === null ? "–" : t("common.min", { n: N(cur.avgIntervalMinutes, 1) })}
                    sub={t("analytics.fig.intervalSub")}
                    info={def("avgIntervalMinutes")}
                  />
                  <Figure label={t("analytics.fig.stopsPerTour")} value={N(cur.tours.stopsPerTour, 1)} sub={t("analytics.fig.stopsPerTourSub")} info={def("stopsPerTour")} />
                </dl>
                <p className="border-t border-line px-5 py-2.5 text-2xs text-muted">{t("analytics.drivenNote")}</p>
              </Card>
            </div>
          </div>

          <BreakdownTables api={api} query={query} mayExport={mayExport} />
        </>
      )}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  const { t } = useI18n();
  if (!text) return null;
  return (
    <Tooltip content={<span className="block max-w-xs text-xs font-medium">{text}</span>}>
      <button type="button" className="inline-grid size-5 place-items-center rounded-md text-muted hover:text-ink" aria-label={t("analytics.definition", { text })}>
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  );
}

function Kpi({ labelKey, value, prev, info }: { labelKey: MessageKey; value: string; prev: string; info: string }) {
  const { t } = useI18n();
  const label = t(labelKey);
  return (
    <Card className="flex flex-col gap-2 p-4" role="group" aria-label={label}>
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
        {label}
        <InfoTip text={info} />
      </div>
      <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular" data-testid={`kpi-${EN_T(labelKey)}`}>
        {value}
      </div>
      <div className="text-2xs text-muted tabular">{t("analytics.prev", { value: prev })}</div>
    </Card>
  );
}

function Figure({ label, value, sub, info, planned }: { label: string; value: string; sub: string; info: string; planned?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
        {planned && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-ink-2">{t("analytics.plannedBadge")}</span>}
        <InfoTip text={info} />
      </dt>
      <dd className="text-[18px] font-extrabold text-ink tabular">{value}</dd>
      <dd className="text-2xs text-muted">{sub}</dd>
    </div>
  );
}

function ExportMenu({ api, query, view }: { api: ReturnType<typeof analyticsApi>; query: AnalyticsQuery; view: "drivers" | "depots" | "tours" | "trend" }) {
  const { t, locale } = useI18n();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download /> {t("common.export")}
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>
          <bdi dir="ltr">
            {query.from} – {query.to}
          </bdi>
        </MenuLabel>
        <MenuItem onSelect={() => download(api.exportUrl(query, view, "csv", locale))}>{t("analytics.csvSemicolon")}</MenuItem>
        <MenuItem onSelect={() => download(api.exportUrl(query, view, "xlsx", locale))}>{t("common.exportXlsx")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function TrendTable({ data }: { data: Summary }) {
  const { t, fmt } = useI18n();
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-[13px]" aria-label={t("analytics.trendTable")}>
        <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
          <tr className="border-b border-line">
            <th className="py-2 text-start">{t("analytics.th.period")}</th>
            <th className="text-end">{t("analytics.th.tours")}</th>
            <th className="text-end">{t("analytics.th.delivered")}</th>
            <th className="text-end">{t("analytics.th.notDelivered")}</th>
            <th className="text-end">{t("analytics.th.open")}</th>
            <th className="text-end">{t("analytics.th.success")}</th>
          </tr>
        </thead>
        <tbody>
          {data.trend.map((b) => (
            <tr key={b.bucket} className="border-b border-line last:border-0 tabular">
              <td className="py-1.5">{b.bucket}</td>
              <td className="text-end">{b.tours}</td>
              <td className="text-end">{delivered(b)}</td>
              <td className="text-end">{notDelivered(b)}</td>
              <td className="text-end">{b.open}</td>
              <td className="text-end">{pct(b.successRate, 1, fmt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = "drivers" | "depots" | "tours";

function BreakdownTables({ api, query, mayExport }: { api: ReturnType<typeof analyticsApi>; query: AnalyticsQuery; mayExport: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("drivers");
  const [rows, setRows] = useState<{ tab: Tab; data: DriverRow[] | DepotRow[] | TourRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query) + tab;
  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      const d = tab === "drivers" ? (await api.drivers(query)).drivers : tab === "depots" ? (await api.depots(query)).depots : (await api.tours(query)).tours;
      setRows({ tab, data: d });
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t("analytics.breakdown")}
        description={t("analytics.breakdownDesc")}
        actions={mayExport ? <ExportMenu api={api} query={query} view={tab} /> : undefined}
      />
      <div className="flex gap-1 border-b border-line px-4 pt-2" role="tablist" aria-label={t("analytics.breakdown")}>
        {(["drivers", "depots", "tours"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-3 pb-2 text-[13px] font-semibold", tab === k ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t(`analytics.tab.${k}`)}
          </button>
        ))}
      </div>
      {error && <p className="px-4 py-4 text-[13px] text-danger-ink">{error}</p>}
      {!rows && !error && <Skeleton className="m-4 h-40" />}
      {rows && rows.data.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted">{t("analytics.noDataPeriod")}</p>}
      {rows && rows.data.length > 0 && (
        <div className="max-h-[520px] overflow-auto">
          {rows.tab === "tours" ? <ToursTable rows={rows.data as TourRow[]} /> : <PeopleTable rows={rows.data as (DriverRow | DepotRow)[]} kind={rows.tab} />}
        </div>
      )}
    </Card>
  );
}

const Th = ({ children, end }: { children: ReactNode; end?: boolean }) => <th className={cn("h-10 whitespace-nowrap px-3", end ? "text-end" : "text-start")}>{children}</th>;

function PeopleTable({ rows, kind }: { rows: (DriverRow | DepotRow)[]; kind: "drivers" | "depots" }) {
  const { t, fmt } = useI18n();
  return (
    <table className="w-full min-w-[980px] text-[13px]" aria-label={kind === "drivers" ? t("analytics.driverPerformance") : t("analytics.locationPerformance")}>
      <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
        <tr className="border-b border-line">
          <Th>{kind === "drivers" ? t("analytics.th.driver") : t("analytics.th.location")}</Th>
          <Th end>{t("analytics.th.tours")}</Th>
          <Th end>{t("analytics.th.stops")}</Th>
          <Th end>{t("analytics.th.delivered")}</Th>
          <Th end>{t("analytics.th.notDelivered")}</Th>
          <Th end>{t("analytics.th.open")}</Th>
          <Th end>{t("analytics.th.success")}</Th>
          <Th end>{t("analytics.th.onTimeStarts")}</Th>
          <Th end>{t("analytics.th.avgTour")}</Th>
          <Th end>{t("analytics.th.stopsPerHour")}</Th>
          <Th end>{t("analytics.th.plannedKm")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={"driverId" in r ? (r.driverId ?? "none") : r.depotId} className="border-b border-line last:border-0 tabular">
            <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{r.name ?? t("analytics.noDriver")}</td>
            <td className="px-3 text-end">{r.tours}</td>
            <td className="px-3 text-end">{r.stops}</td>
            <td className="px-3 text-end">{delivered(r)}</td>
            <td className="px-3 text-end">{notDelivered(r)}</td>
            <td className="px-3 text-end">{r.open}</td>
            <td className="px-3 text-end font-semibold text-ink">{pct(r.successRate, 1, fmt)}</td>
            <td className="px-3 text-end">{pct(r.onTimeStartRate, 0, fmt)}</td>
            <td className="px-3 text-end">{r.avgTourMinutes === null ? "–" : t("common.min", { n: num(r.avgTourMinutes, 0, fmt) })}</td>
            <td className="px-3 text-end">{num(r.stopsPerActiveHour, 1, fmt)}</td>
            <td className="px-3 text-end text-ink-2">{r.planned.plannedDistanceKm === null ? "–" : num(r.planned.plannedDistanceKm, 0, fmt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ToursTable({ rows }: { rows: TourRow[] }) {
  const { t, fmt } = useI18n();
  return (
    <table className="w-full min-w-[1000px] text-[13px]" aria-label={t("analytics.tourPerformance")}>
      <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
        <tr className="border-b border-line">
          <Th>{t("analytics.th.date")}</Th>
          <Th>{t("analytics.th.tour")}</Th>
          <Th>{t("analytics.th.location")}</Th>
          <Th>{t("analytics.th.driver")}</Th>
          <Th>{t("analytics.th.status")}</Th>
          <Th end>{t("analytics.th.stops")}</Th>
          <Th end>{t("analytics.th.delivered")}</Th>
          <Th end>{t("analytics.th.notDelivered")}</Th>
          <Th end>{t("analytics.th.success")}</Th>
          <Th end>{t("analytics.th.actualMin")}</Th>
          <Th end>{t("analytics.th.plannedMin")}</Th>
          <Th end>{t("analytics.th.plannedKm")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tourId} className="border-b border-line last:border-0 tabular">
            <td className="whitespace-nowrap px-3 py-2 text-ink-2">{r.date}</td>
            <td className="whitespace-nowrap px-3 font-semibold text-ink">
              {r.name}
              {r.archived && <span className="ms-1.5 text-2xs font-normal text-muted">{t("analytics.archived")}</span>}
            </td>
            <td className="whitespace-nowrap px-3 text-ink-2">{r.depot}</td>
            <td className="whitespace-nowrap px-3 text-ink-2">{r.driver ?? "–"}</td>
            <td className="whitespace-nowrap px-3 text-ink-2">{tourStatusText(r.status, t)}</td>
            <td className="px-3 text-end">{r.stops}</td>
            <td className="px-3 text-end">{delivered(r)}</td>
            <td className="px-3 text-end">{notDelivered(r)}</td>
            <td className="px-3 text-end font-semibold text-ink">{pct(r.successRate, 1, fmt)}</td>
            <td className="px-3 text-end">{num(r.minutes, 0, fmt)}</td>
            <td className="px-3 text-end text-ink-2">{num(r.plannedMinutes, 0, fmt)}</td>
            <td className="px-3 text-end text-ink-2">{num(r.plannedDistanceKm, 1, fmt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A tour status from the analytics API in the current language (unknown values as sent, readable). */
function tourStatusText(status: string, t: TFunction) {
  return TOUR_STATUSES.has(status) ? tourStatusLabel(status as Parameters<typeof tourStatusLabel>[0], t) : status.replace("_", " ");
}
