"use client";

import { can } from "@turvio/shared";
import { Button, Card, CardHeader, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Skeleton, Tooltip, cn } from "@turvio/web-ui/ds";
import { BarChart3, Download, Info, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { analyticsApi, delivered, notDelivered, num, pct, presetRange, type AnalyticsQuery, type DepotRow, type DriverRow, type Summary, type TourRow } from "../lib/analytics";
import { download } from "../lib/download";
import { fieldCls } from "../lib/helpers";
import { useDispatch } from "../lib/store";
import { OutcomeBars, ReasonBars, SuccessLine } from "./AnalyticsCharts";
import { FAILURE_REASON } from "./StatusBadge";

type Preset = "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "last_30" | "custom";
const PRESETS: [Preset, string][] = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "This week"],
  ["last_week", "Last week"],
  ["month", "This month"],
  ["last_month", "Last month"],
  ["last_30", "Last 30 days"],
  ["custom", "Custom"],
];

/** Operational analytics from recorded data only. Planned (optimizer) figures are always labelled as such. */
export function AnalyticsView() {
  const { session, scoped, depotId, today } = useDispatch();
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
  const def = (k: string) => data?.definitions[k] ?? "";
  const cur = data?.current;
  const prev = data?.previous;
  const drivers = scoped.drivers.filter((d) => !depot || d.depotId === depot);
  const reasonLabel = (code: string | null) => (code ? (FAILURE_REASON[code] ?? code.replace(/_/g, " ")) : "No reason recorded");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">Analytics</h1>
        <p className="text-sm text-ink-2">
          Recorded outcomes only – nothing estimated or invented.{data && ` ${data.range.from} – ${data.range.to} · company time (${data.timeZone}) · archived tours included.`}
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Period">
          {PRESETS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={preset === k}
              onClick={() => setPreset(k)}
              className={cn("h-8 rounded-[10px] px-3 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-ink", preset === k && "bg-brand-50 text-brand-700 hover:bg-brand-50")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preset === "custom" && (
            <>
              <input type="date" className={cn(fieldCls, "w-40")} value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="From" />
              <span className="text-muted">–</span>
              <input type="date" className={cn(fieldCls, "w-40")} value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="To" />
            </>
          )}
          <select className={cn(fieldCls, "w-44")} value={depot} onChange={(e) => (setDepot(e.target.value), setDriver(""))} aria-label="Location">
            <option value="">All my locations</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className={cn(fieldCls, "w-48")} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label="Driver">
            <option value="">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
          <select className={cn(fieldCls, "w-40")} value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)} aria-label="Group by">
            <option value="">Group: automatic</option>
            <option value="day">Group by day</option>
            <option value="week">Group by week</option>
            <option value="month">Group by month</option>
          </select>
          {loading && <span className="text-2xs text-muted">Updating…</span>}
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
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Success rate" value={pct(cur.stops.successRate)} prev={pct(prev.stops.successRate)} info={def("successRate")} />
            <Kpi label="Delivered / picked up" value={num(delivered(cur.stops))} prev={num(delivered(prev.stops))} info={`${def("delivered")} ${def("pickedUp")}`} />
            <Kpi label="Not delivered" value={num(notDelivered(cur.stops))} prev={num(notDelivered(prev.stops))} info="Failed, attempted, rescheduled, returned or skipped." />
            <Kpi label="Open stops" value={num(cur.stops.open)} prev={num(prev.stops.open)} info={def("open")} />
            <Kpi label="Tours completed" value={`${num(cur.tours.byStatus.completed)} / ${num(cur.tours.tours)}`} prev={`${num(prev.tours.byStatus.completed)} / ${num(prev.tours.tours)}`} info={def("tours")} />
            <Kpi label="Completion rate" value={pct(cur.tours.completionRate)} prev={pct(prev.tours.completionRate)} info={def("completionRate")} />
            <Kpi label="On-time starts" value={pct(cur.tours.onTimeStartRate)} prev={pct(prev.tours.onTimeStartRate)} info={def("onTimeStartRate")} />
            <Kpi label="Stops per active hour" value={num(cur.tours.stopsPerActiveHour, 1)} prev={num(prev.tours.stopsPerActiveHour, 1)} info={def("stopsPerActiveHour")} />
          </section>
          <p className="-mt-2 text-2xs text-muted">
            “prev.” = the {data.previousRange.from === data.previousRange.to ? "previous day" : `previous period ${data.previousRange.from} – ${data.previousRange.to}`} (same length).
            Cancelled stops ({num(cur.stops.cancelled)}) are not counted as processed.
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader
                title="Outcomes over time"
                description={`Processed stops per ${data.granularity} · hover for exact values`}
                actions={
                  <div className="flex gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => setTable(!table)} aria-pressed={table}>
                      {table ? <BarChart3 /> : <Table2 />} {table ? "Chart" : "Table"}
                    </Button>
                    {mayExport && <ExportMenu api={api} query={query} view="trend" />}
                  </div>
                }
              />
              <div className="p-5">
                {data.trend.length === 0 ? (
                  <EmptyState icon={<BarChart3 />} title="No tours in this period" description="Nothing was planned or driven in the selected period and scope." />
                ) : table ? (
                  <TrendTable data={data} />
                ) : (
                  <div className="flex flex-col gap-5">
                    <OutcomeBars trend={data.trend} granularity={data.granularity} />
                    <div>
                      <h4 className="mb-1 text-[12.5px] font-bold text-ink">Success rate</h4>
                      <SuccessLine trend={data.trend} granularity={data.granularity} />
                    </div>
                  </div>
                )}
              </div>
            </Card>
            <div className="flex flex-col gap-4">
              <Card className="overflow-hidden">
                <CardHeader title="Why stops were not delivered" description="Reason the driver recorded" />
                <div className="p-5">
                  <ReasonBars rows={data.failureReasons} label={reasonLabel} />
                </div>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader title="Actual and planned" description="Actual = recorded by the driver app · planned = route optimizer" />
                <dl className="grid grid-cols-2 gap-4 p-5 text-[13px]">
                  <Figure label="Actual tour duration" value={cur.tours.avgTourMinutes === null ? "–" : `${num(cur.tours.avgTourMinutes)} min`} sub="Average, start → finish, pauses included" info={def("avgTourMinutes")} />
                  <Figure label="Actual active hours" value={`${num(cur.tours.activeHours, 1)} h`} sub={`${num(cur.tours.toursStarted)} tour(s) started`} info={def("activeHours")} />
                  <Figure
                    label="Planned distance"
                    value={cur.tours.planned.plannedDistanceKm === null ? "–" : `${num(cur.tours.planned.plannedDistanceKm)} km`}
                    sub={`Optimizer · ${cur.tours.planned.coveredTours} of ${cur.tours.tours} tours`}
                    info={def("plannedDistanceKm")}
                    planned
                  />
                  <Figure
                    label="Planned driving + service"
                    value={cur.tours.planned.plannedMinutes === null ? "–" : `${num(cur.tours.planned.plannedMinutes)} min`}
                    sub={`Optimizer · ${cur.tours.planned.coveredTours} tours`}
                    info={def("plannedMinutes")}
                    planned
                  />
                  <Figure label="Interval between outcomes" value={cur.avgIntervalMinutes === null ? "–" : `${num(cur.avgIntervalMinutes, 1)} min`} sub="Not the time spent at a stop" info={def("avgIntervalMinutes")} />
                  <Figure label="Stops per tour" value={num(cur.tours.stopsPerTour, 1)} sub="Processed stops ÷ tours with stops" info={def("stopsPerTour")} />
                </dl>
                <p className="border-t border-line px-5 py-2.5 text-2xs text-muted">Actual driven distance is not recorded for every driver and is therefore not shown.</p>
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
  if (!text) return null;
  return (
    <Tooltip content={<span className="block max-w-xs text-xs font-medium">{text}</span>}>
      <button type="button" className="inline-grid size-5 place-items-center rounded-md text-muted hover:text-ink" aria-label={`Definition: ${text}`}>
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  );
}

function Kpi({ label, value, prev, info }: { label: string; value: string; prev: string; info: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4" role="group" aria-label={label}>
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
        {label}
        <InfoTip text={info} />
      </div>
      <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular" data-testid={`kpi-${label}`}>
        {value}
      </div>
      <div className="text-2xs text-muted tabular">prev. {prev}</div>
    </Card>
  );
}

function Figure({ label, value, sub, info, planned }: { label: string; value: string; sub: string; info: string; planned?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
        {planned && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-ink-2">planned</span>}
        <InfoTip text={info} />
      </dt>
      <dd className="text-[18px] font-extrabold text-ink tabular">{value}</dd>
      <dd className="text-2xs text-muted">{sub}</dd>
    </div>
  );
}

function ExportMenu({ api, query, view }: { api: ReturnType<typeof analyticsApi>; query: AnalyticsQuery; view: "drivers" | "depots" | "tours" | "trend" }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download /> Export
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>
          {query.from} – {query.to}
        </MenuLabel>
        <MenuItem onSelect={() => download(api.exportUrl(query, view, "csv"))}>CSV (Excel, semicolon)</MenuItem>
        <MenuItem onSelect={() => download(api.exportUrl(query, view, "xlsx"))}>Excel (.xlsx)</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function TrendTable({ data }: { data: Summary }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-[13px]" aria-label="Outcomes per period">
        <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
          <tr className="border-b border-line">
            <th className="py-2 text-start">Period</th>
            <th className="text-end">Tours</th>
            <th className="text-end">Delivered</th>
            <th className="text-end">Not delivered</th>
            <th className="text-end">Open</th>
            <th className="text-end">Success</th>
          </tr>
        </thead>
        <tbody>
          {data.trend.map((t) => (
            <tr key={t.bucket} className="border-b border-line last:border-0 tabular">
              <td className="py-1.5">{t.bucket}</td>
              <td className="text-end">{t.tours}</td>
              <td className="text-end">{delivered(t)}</td>
              <td className="text-end">{notDelivered(t)}</td>
              <td className="text-end">{t.open}</td>
              <td className="text-end">{pct(t.successRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = "drivers" | "depots" | "tours";

function BreakdownTables({ api, query, mayExport }: { api: ReturnType<typeof analyticsApi>; query: AnalyticsQuery; mayExport: boolean }) {
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
        title="Breakdown"
        description="Performance per driver, location and tour"
        actions={mayExport ? <ExportMenu api={api} query={query} view={tab} /> : undefined}
      />
      <div className="flex gap-1 border-b border-line px-4 pt-2" role="tablist" aria-label="Breakdown">
        {(
          [
            ["drivers", "Drivers"],
            ["depots", "Locations"],
            ["tours", "Tours"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("-mb-px border-b-2 px-3 pb-2 text-[13px] font-semibold", tab === k ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="px-4 py-4 text-[13px] text-danger-ink">{error}</p>}
      {!rows && !error && <Skeleton className="m-4 h-40" />}
      {rows && rows.data.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted">No data in this period.</p>}
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
  return (
    <table className="w-full min-w-[980px] text-[13px]" aria-label={kind === "drivers" ? "Driver performance" : "Location performance"}>
      <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
        <tr className="border-b border-line">
          <Th>{kind === "drivers" ? "Driver" : "Location"}</Th>
          <Th end>Tours</Th>
          <Th end>Stops</Th>
          <Th end>Delivered</Th>
          <Th end>Not delivered</Th>
          <Th end>Open</Th>
          <Th end>Success</Th>
          <Th end>On-time starts</Th>
          <Th end>Avg tour (actual)</Th>
          <Th end>Stops / active h</Th>
          <Th end>Planned km</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={"driverId" in r ? (r.driverId ?? "none") : r.depotId} className="border-b border-line last:border-0 tabular">
            <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{r.name ?? "(no driver)"}</td>
            <td className="px-3 text-end">{r.tours}</td>
            <td className="px-3 text-end">{r.stops}</td>
            <td className="px-3 text-end">{delivered(r)}</td>
            <td className="px-3 text-end">{notDelivered(r)}</td>
            <td className="px-3 text-end">{r.open}</td>
            <td className="px-3 text-end font-semibold text-ink">{pct(r.successRate)}</td>
            <td className="px-3 text-end">{pct(r.onTimeStartRate, 0)}</td>
            <td className="px-3 text-end">{r.avgTourMinutes === null ? "–" : `${num(r.avgTourMinutes)} min`}</td>
            <td className="px-3 text-end">{num(r.stopsPerActiveHour, 1)}</td>
            <td className="px-3 text-end text-ink-2">{r.planned.plannedDistanceKm === null ? "–" : num(r.planned.plannedDistanceKm)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ToursTable({ rows }: { rows: TourRow[] }) {
  return (
    <table className="w-full min-w-[1000px] text-[13px]" aria-label="Tour performance">
      <thead className="sticky top-0 bg-surface text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
        <tr className="border-b border-line">
          <Th>Date</Th>
          <Th>Tour</Th>
          <Th>Location</Th>
          <Th>Driver</Th>
          <Th>Status</Th>
          <Th end>Stops</Th>
          <Th end>Delivered</Th>
          <Th end>Not delivered</Th>
          <Th end>Success</Th>
          <Th end>Actual min</Th>
          <Th end>Planned min</Th>
          <Th end>Planned km</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tourId} className="border-b border-line last:border-0 tabular">
            <td className="whitespace-nowrap px-3 py-2 text-ink-2">{r.date}</td>
            <td className="whitespace-nowrap px-3 font-semibold text-ink">
              {r.name}
              {r.archived && <span className="ms-1.5 text-2xs font-normal text-muted">archived</span>}
            </td>
            <td className="whitespace-nowrap px-3 text-ink-2">{r.depot}</td>
            <td className="whitespace-nowrap px-3 text-ink-2">{r.driver ?? "–"}</td>
            <td className="whitespace-nowrap px-3 text-ink-2">{r.status.replace("_", " ")}</td>
            <td className="px-3 text-end">{r.stops}</td>
            <td className="px-3 text-end">{delivered(r)}</td>
            <td className="px-3 text-end">{notDelivered(r)}</td>
            <td className="px-3 text-end font-semibold text-ink">{pct(r.successRate)}</td>
            <td className="px-3 text-end">{num(r.minutes)}</td>
            <td className="px-3 text-end text-ink-2">{num(r.plannedMinutes)}</td>
            <td className="px-3 text-end text-ink-2">{num(r.plannedDistanceKm, 1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
