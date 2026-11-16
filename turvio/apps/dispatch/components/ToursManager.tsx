"use client";

import { can } from "@turvio/shared";
import { Button, Card, Checkbox, EmptyState, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, SearchInput, Skeleton, cn } from "@turvio/web-ui/ds";
import {
  Archive,
  ArchiveRestore,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  ListFilter,
  Loader2,
  SearchX,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../lib/api";
import { download } from "../lib/download";
import { fieldCls } from "../lib/helpers";
import { STATUS_LABEL, bulkFilter, statusLabel, lifecycleApi, type ArchivedFilter, type BulkAction, type BulkSelection, type CalendarDay, type LifecycleStatus, type ListedTour, type TourListFilter } from "../lib/lifecycle";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { BulkActionDialog } from "./BulkActionDialog";
import { TourActionsMenu, gControl } from "./TourActions";
import { LifecycleBadges, TourRecordSheet } from "./TourRecordSheet";

type DateMode = "day" | "range" | "month";
const PAGE = 25;
const STATUSES = Object.keys(STATUS_LABEL) as LifecycleStatus[];
/** Monday … Sunday (2024-01-01 was a Monday); names come from Intl in the current language. */
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)));
/** Phase G: native 32 px fields in the toolbar, quiet bulk-bar buttons. */
const gIconBtn = "g:size-8";
const gBarBtn = "g:border-transparent g:bg-transparent g:hover:border-transparent g:hover:bg-[var(--hover)]";
const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/** Selection: individual tours (with the version the dispatcher saw) or every tour matching the filter. */
type Selection = { mode: "ids"; ids: Map<string, number> } | { mode: "all"; total: number };

/**
 * All tours of any period, active or archived: filters, calendar, selection, bulk actions with
 * server previews, exports and the daily clean-up. Every number shown comes from the server.
 */
export function ToursManager({ archived }: { archived: ArchivedFilter }) {
  const { session, scoped, depotId, today } = useDispatch();
  const { t, locale } = useI18n();
  const api = useMemo(() => lifecycleApi(session.organizationId), [session.organizationId]);
  const [mode, setMode] = useState<DateMode>(archived === "only" ? "month" : "day");
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState(shiftDay(today, -6));
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [driverId, setDriverId] = useState("");
  const [depot, setDepot] = useState(depotId ?? "");
  const [statuses, setStatuses] = useState<LifecycleStatus[]>([]);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ListedTour[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ mode: "ids", ids: new Map() });
  const [bulk, setBulk] = useState<{ action: BulkAction; selection: BulkSelection; versions?: Record<string, number> } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setDepot(depotId ?? ""), [depotId]);

  const filter: TourListFilter = useMemo(
    () => ({
      ...(mode === "day" ? { date: day } : mode === "month" ? { month } : { from, to }),
      archived,
      driverId: driverId || undefined,
      depotId: depot || undefined,
      status: statuses.length ? statuses : undefined,
      empty: onlyEmpty ? true : undefined,
      q: debounced || undefined,
    }),
    [mode, day, month, from, to, archived, driverId, depot, statuses, onlyEmpty, debounced],
  );
  const filterKey = JSON.stringify(filter);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError(null);
    try {
      const r = await api.list(filter, { limit: PAGE, offset: page * PAGE });
      if (n !== seq.current) return;
      setRows(r.tours);
      setTotal(r.total);
    } catch (e) {
      if (n === seq.current) setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, filterKey, page]);
  useEffect(() => {
    void load();
  }, [load]);
  // A new filter starts a new selection on page one.
  useEffect(() => {
    setPage(0);
    setSelection({ mode: "ids", ids: new Map() });
  }, [filterKey]);

  const selectedCount = selection.mode === "all" ? selection.total : selection.ids.size;
  const pageAllSelected = !!rows?.length && (selection.mode === "all" || rows.every((r) => selection.ids.has(r.tour.id)));
  const toggleRow = (r: ListedTour) => {
    if (selection.mode === "all") return;
    const ids = new Map(selection.ids);
    if (ids.has(r.tour.id)) ids.delete(r.tour.id);
    else ids.set(r.tour.id, r.tour.version ?? 1);
    setSelection({ mode: "ids", ids });
  };
  const togglePage = () => {
    if (!rows) return;
    if (pageAllSelected) return setSelection({ mode: "ids", ids: new Map() });
    const ids = new Map(selection.mode === "ids" ? selection.ids : []);
    for (const r of rows) ids.set(r.tour.id, r.tour.version ?? 1);
    setSelection({ mode: "ids", ids });
  };
  const startBulk = (action: BulkAction) =>
    setBulk(
      selection.mode === "all"
        ? { action, selection: bulkFilter(filter) }
        : { action, selection: { tourIds: [...selection.ids.keys()] }, versions: Object.fromEntries(selection.ids) },
    );

  const role = session.role;
  const may = { archive: can(role, "tours.archive"), del: can(role, "tours.delete"), close: can(role, "tours.close"), manage: can(role, "tours.manage"), export: can(role, "reports.export") };
  const periodLabel = mode === "day" ? day : mode === "month" ? month : `${from} – ${to}`;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  const drivers = scoped.drivers.filter((d) => !depot || d.depotId === depot);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4 g:gap-2 g:rounded-none g:border-0 g:bg-transparent g:p-0">
        <div className="flex flex-wrap items-end gap-2 g:items-center">
          <div className="flex rounded-xl border border-line bg-surface-2 p-0.5 g:h-8 g:items-center g:rounded-md g:border-line-strong g:p-[2px]" role="tablist" aria-label={t("tours.m.period")}>
            {(["day", "range", "month"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("h-8 rounded-[10px] px-3 text-[13px] font-semibold text-muted g:h-7 g:rounded-[5px]! g:px-2.5 g:font-medium g:duration-150 g:hover:text-ink", mode === m && "bg-surface text-ink shadow-xs g:bg-[var(--selected)] g:shadow-none")}
              >
                {m === "day" ? t("tours.m.day") : m === "range" ? t("tours.m.range") : t("tours.m.month")}
              </button>
            ))}
          </div>
          {mode === "day" && (
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon-sm" className={gIconBtn} aria-label={t("tours.m.prevDay")} onClick={() => setDay(shiftDay(day, -1))}>
                <ChevronLeft className="rtl:-scale-x-100" />
              </Button>
              <input type="date" className={cn(fieldCls, "w-40", gControl)} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t("tours.m.day")} />
              <Button variant="secondary" size="icon-sm" className={gIconBtn} aria-label={t("tours.m.nextDay")} onClick={() => setDay(shiftDay(day, 1))}>
                <ChevronRight className="rtl:-scale-x-100" />
              </Button>
              {day !== today && (
                <Button variant="ghost" size="sm" onClick={() => setDay(today)}>
                  {t("common.today")}
                </Button>
              )}
            </div>
          )}
          {mode === "range" && (
            <div className="flex items-center gap-1">
              <input type="date" className={cn(fieldCls, "w-40", gControl)} value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label={t("tours.m.from")} />
              <span className="text-muted">–</span>
              <input type="date" className={cn(fieldCls, "w-40", gControl)} value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label={t("tours.m.to")} />
            </div>
          )}
          {mode === "month" && (
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="icon-sm" className={gIconBtn} aria-label={t("tours.m.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))}>
                <ChevronLeft className="rtl:-scale-x-100" />
              </Button>
              <input type="month" className={cn(fieldCls, "w-40", gControl)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={t("tours.m.month")} />
              <Button variant="secondary" size="icon-sm" className={gIconBtn} aria-label={t("tours.m.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))}>
                <ChevronRight className="rtl:-scale-x-100" />
              </Button>
            </div>
          )}
          <Button
            variant={calendarOpen ? "primary" : "secondary"}
            className={cn(calendarOpen && "g:border-line-3 g:bg-[var(--selected)] g:text-ink g:hover:bg-[var(--selected)]")}
            onClick={() => setCalendarOpen(!calendarOpen)}
            aria-expanded={calendarOpen}
          >
            <CalendarDays className="g:text-muted" /> {t("tours.m.calendar")}
          </Button>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {archived !== "only" && (may.archive || may.del) && (
              <Button variant="secondary" onClick={() => setCleanupOpen(!cleanupOpen)} aria-expanded={cleanupOpen}>
                <Sparkles className="g:hidden" /> {t("tours.m.cleanup")}
              </Button>
            )}
            {may.export && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="secondary">
                    <Download className="g:text-muted" /> {t("common.export")}
                  </Button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuLabel>{t("tours.m.exportLabel", { count: total, period: periodLabel })}</MenuLabel>
                  <MenuItem onSelect={() => download(api.exportUrl(filter, "csv", locale))}>{t("tours.m.exportCsv")}</MenuItem>
                  <MenuItem onSelect={() => download(api.exportUrl(filter, "xlsx", locale))}>{t("common.exportXlsx")}</MenuItem>
                </MenuContent>
              </Menu>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder={t("tours.m.searchPlaceholder")} label={t("tours.m.searchLabel")} className="sm:w-64 g:sm:w-60" />
          <select className={cn(fieldCls, "w-44", gControl)} value={depot} onChange={(e) => (setDepot(e.target.value), setDriverId(""))} aria-label={t("tours.m.locationFilter")}>
            <option value="">{t("common.scopeAll")}</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className={cn(fieldCls, "w-48", gControl)} value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label={t("tours.m.driverFilter")}>
            <option value="">{t("tours.m.allDrivers")}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" className={cn(statuses.length > 0 && "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50 g:border-line-3 g:bg-[var(--selected)] g:text-ink g:hover:bg-[var(--selected)]")}>
                <ListFilter className="g:text-muted" /> {t("tours.m.status")}
                {statuses.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-2xs font-semibold leading-4 text-white g:bg-transparent g:px-0 g:text-[12px] g:font-medium g:text-muted">{statuses.length}</span>}
              </Button>
            </MenuTrigger>
            <MenuContent className="w-52">
              <MenuLabel>{t("tours.m.status")}</MenuLabel>
              {STATUSES.map((k) => (
                <MenuCheckboxItem key={k} checked={statuses.includes(k)} onCheckedChange={(c) => setStatuses(c ? [...statuses, k] : statuses.filter((x) => x !== k))}>
                  {statusLabel(k, t)}
                </MenuCheckboxItem>
              ))}
              {statuses.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onSelect={() => setStatuses([])}>{t("tours.m.clearFilter")}</MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2 g:font-normal g:text-muted">
            <Checkbox checked={onlyEmpty} onCheckedChange={(c) => setOnlyEmpty(c === true)} label={t("tours.m.onlyEmptyLabel")} />
            {t("tours.m.onlyEmpty")}
          </label>
        </div>
        {calendarOpen && (
          <MonthCalendar
            month={mode === "month" ? month : (mode === "day" ? day : to).slice(0, 7)}
            depotId={depot || null}
            archived={archived}
            onPick={(d) => {
              setMode("day");
              setDay(d);
              setCalendarOpen(false);
            }}
          />
        )}
        {cleanupOpen && <DayCleanup defaultDay={shiftDay(today, -1)} depotId={depot || undefined} onRun={(b) => setBulk(b)} may={may} />}
      </Card>

      {selectedCount > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 shadow-card g:min-h-10 g:gap-1 g:rounded-md g:border-line-strong g:bg-surface g:px-3 g:py-1 g:shadow-none" role="region" aria-label={t("tours.m.bulkRegion")}>
          <span className="text-[13px] font-bold text-brand-700 g:font-medium g:text-ink g:tabular" data-testid="selection-count">
            {t(selection.mode === "all" ? "tours.m.selectedAll" : "tours.m.selected", { count: selectedCount })}
          </span>
          {selection.mode === "ids" && pageAllSelected && total > rows!.length && (
            <Button variant="ghost" size="sm" className="g:text-brand-700" onClick={() => setSelection({ mode: "all", total })}>
              {t("tours.m.selectAllMatching", { count: total })}
            </Button>
          )}
          <div className="ms-auto flex flex-wrap gap-1.5 g:gap-0.5">
            {may.archive && archived !== "only" && (
              <Button size="sm" variant="secondary" className={gBarBtn} onClick={() => startBulk("archive")}>
                <Archive /> {t("tours.m.archive")}
              </Button>
            )}
            {may.archive && archived !== "exclude" && (
              <Button size="sm" variant="secondary" className={gBarBtn} onClick={() => startBulk("restore")}>
                <ArchiveRestore /> {t("tours.m.restore")}
              </Button>
            )}
            {may.close && archived !== "only" && (
              <>
                <Button size="sm" variant="secondary" className={gBarBtn} onClick={() => startBulk("finish")}>
                  <CheckCircle2 /> {t("tours.m.finish")}
                </Button>
                <Button size="sm" variant="secondary" className={gBarBtn} onClick={() => startBulk("cancel")}>
                  <Ban /> {t("tours.m.cancel")}
                </Button>
              </>
            )}
            {may.manage && archived !== "only" && (
              <Button size="sm" variant="secondary" className={gBarBtn} onClick={() => startBulk("withdraw")}>
                <EyeOff /> {t("tours.m.withdraw")}
              </Button>
            )}
            {may.del && (
              <Button size="sm" variant="secondary" className={cn("text-danger-ink", gBarBtn)} onClick={() => startBulk("delete")}>
                <Trash2 /> {t("tours.m.delete")}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="g:ms-1 g:text-muted" onClick={() => setSelection({ mode: "ids", ids: new Map() })} aria-label={t("tours.m.clearSelection")}>
              <X /> {t("tours.m.clear")}
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {error ? (
          <p className="px-4 py-6 text-[13px] text-danger-ink" role="alert">
            {error}
          </p>
        ) : !rows ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={archived === "only" ? t("tours.m.noArchived") : t("tours.m.noMatch")}
            description={t("tours.m.nothingFor", { period: periodLabel })}
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]" aria-label={t("tours.m.table")}>
              <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted g:bg-surface-2/40">
                <tr className="border-b border-line">
                  <th scope="col" className="h-11 w-10 ps-4 g:h-9 g:ps-3">
                    <Checkbox checked={pageAllSelected} onCheckedChange={togglePage} label={t("tours.m.selectPage")} />
                  </th>
                  <th scope="col" className="px-3 text-start">{t("tours.m.colTour")}</th>
                  <th scope="col" className="px-3 text-start">{t("tours.m.colDate")}</th>
                  <th scope="col" className="px-3 text-start">{t("tours.m.status")}</th>
                  <th scope="col" className="px-3 text-start">{t("tours.m.colDriver")}</th>
                  <th scope="col" className="px-3 text-start">{t("tours.m.colLocation")}</th>
                  <th scope="col" className="px-3 text-end">{t("tours.m.colStops")}</th>
                  <th scope="col" className="px-3 text-end">{t("tours.m.colDone")}</th>
                  <th scope="col" className="px-3 text-end">{t("tours.m.colOpen")}</th>
                  <th scope="col" className="w-12 pe-4 g:w-10 g:pe-2" aria-label={t("tours.m.colActions")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const checked = selection.mode === "all" || selection.ids.has(r.tour.id);
                  return (
                    <tr
                      key={r.tour.id}
                      className={cn("group/row cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/50 g:h-9 g:transition-colors g:duration-150 g:hover:bg-[var(--hover)]", checked && "bg-brand-50/40 g:bg-[var(--selected)] g:hover:bg-[var(--selected)]")}
                      onClick={() => setOpenId(r.tour.id)}
                    >
                      <td className="ps-4 g:ps-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleRow(r)} label={t("tours.m.selectRow", { name: r.tour.name, date: r.tour.date })} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <button type="button" className="font-semibold text-ink hover:text-brand-700 g:font-medium g:hover:text-ink g:hover:underline g:underline-offset-2" onClick={(e) => (e.stopPropagation(), setOpenId(r.tour.id))}>
                          {r.tour.name}
                        </button>
                        {r.tour.closeReason && <span className="block max-w-[220px] truncate text-2xs text-muted g:ms-2 g:inline-block g:max-w-[180px] g:align-bottom g:text-[12px]" title={r.tour.closeReason}>{r.tour.closeReason}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 tabular text-ink-2">{r.tour.date}</td>
                      <td className="px-3">
                        <LifecycleBadges tour={r.tour} />
                      </td>
                      <td className="whitespace-nowrap px-3">{r.driverName ?? <span className="text-warning-ink">{t("tours.m.unassigned")}</span>}</td>
                      <td className="whitespace-nowrap px-3 text-ink-2">{r.depotName}</td>
                      <td className="px-3 text-end tabular">{r.stops.total}</td>
                      <td className="px-3 text-end tabular g:whitespace-nowrap">
                        <span className="g:inline-flex g:flex-row-reverse g:items-baseline g:gap-1.5">
                          {r.stops.delivered}
                          {r.stops.notDelivered > 0 && <span className="block text-2xs text-danger-ink g:text-[12px] g:after:ms-1.5 g:after:text-subtle g:after:content-['·']">{t("tours.m.notDelivered", { count: r.stops.notDelivered })}</span>}
                          {r.stops.cancelled > 0 && <span className="block text-2xs text-muted g:text-[12px] g:after:ms-1.5 g:after:text-subtle g:after:content-['·']">{t("tours.m.cancelledCount", { count: r.stops.cancelled })}</span>}
                        </span>
                      </td>
                      <td className="px-3 text-end tabular">{r.stops.open}</td>
                      <td className="pe-4 text-end g:pe-2" onClick={(e) => e.stopPropagation()}>
                        <TourActionsMenu
                          item={{ tour: r.tour, depotName: r.depotName, driverName: r.driverName, stopCount: r.stops.total, openStops: r.stops.open }}
                          onChanged={() => void load()}
                          onOpen={() => setOpenId(r.tour.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-muted g:px-3 g:py-2 g:text-[12px]">
            <span className="tabular" data-testid="list-range">
              {t("tours.m.pageRange", { from: page * PAGE + 1, to: Math.min(total, (page + 1) * PAGE), total })}
            </span>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="icon-sm" aria-label={t("tours.m.prevPage")} disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="rtl:-scale-x-100" />
              </Button>
              <Button variant="secondary" size="icon-sm" aria-label={t("tours.m.nextPage")} disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="rtl:-scale-x-100" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {bulk && (
        <BulkActionDialog
          action={bulk.action}
          selection={bulk.selection}
          versions={bulk.versions}
          onClose={() => setBulk(null)}
          onDone={() => {
            setSelection({ mode: "ids", ids: new Map() });
            void load();
          }}
        />
      )}
      <TourRecordSheet tourId={openId} onOpenChange={(o) => !o && setOpenId(null)} onChanged={() => void load()} />
    </div>
  );
}

/** Month grid with per-day counts from the server; picking a day filters the list to it. */
function MonthCalendar({ month, depotId, archived, onPick }: { month: string; depotId: string | null; archived: ArchivedFilter; onPick: (day: string) => void }) {
  const { session, today } = useDispatch();
  const { t, fmt } = useI18n();
  const [m, setM] = useState(month);
  const [days, setDays] = useState<Map<string, CalendarDay> | null>(null);
  useEffect(() => {
    let alive = true;
    setDays(null);
    lifecycleApi(session.organizationId)
      .calendar(m, depotId)
      .then(
        (r) => alive && setDays(new Map(r.days.map((d) => [d.day, d]))),
        () => alive && setDays(new Map()),
      );
    return () => {
      alive = false;
    };
  }, [m, depotId, session.organizationId]);
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3 g:overflow-hidden g:rounded-lg g:bg-surface g:p-0" aria-label={t("tours.m.calendar")}>
      <div className="mb-2 flex items-center justify-between g:mb-0 g:h-10 g:border-b g:border-line g:px-1.5">
        <Button variant="ghost" size="icon-sm" aria-label={t("tours.m.prevMonth")} onClick={() => setM(shiftMonth(m, -1))}>
          <ChevronLeft className="rtl:-scale-x-100" />
        </Button>
        <span className="text-[13px] font-bold text-ink g:text-[13.5px]">{fmt.date(first, { month: "long", year: "numeric", timeZone: "UTC" })}</span>
        <Button variant="ghost" size="icon-sm" aria-label={t("tours.m.nextMonth")} onClick={() => setM(shiftMonth(m, 1))}>
          <ChevronRight className="rtl:-scale-x-100" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase text-muted g:gap-0 g:border-b g:border-line g:py-1.5 g:text-[12px] g:font-normal">
        {WEEK.map((d) => (
          <span key={d.getUTCDay()}>{fmt.date(d, { weekday: "short", timeZone: "UTC" })}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 g:-mb-px g:mt-0 g:gap-0">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="g:border-e g:border-b g:border-line g:bg-surface-2/40 g:[&:nth-child(7n)]:border-e-0" />;
          const c = days?.get(d);
          const n = archived === "only" ? (c?.archived ?? 0) : archived === "all" ? (c ? c.tours + c.archived : 0) : (c?.tours ?? 0);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-label={t("tours.cal.dayAria", { day: d, count: n })}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-[10px] border border-transparent text-[12.5px] hover:border-line-strong hover:bg-surface",
                d === today && "border-brand-200",
                n > 0 && "bg-surface",
                "g:h-16 g:items-start g:justify-start g:gap-0.5 g:rounded-none! g:border-s-0 g:border-t-0 g:border-line g:px-2 g:py-1.5 g:text-start g:outline-none g:transition-colors g:duration-150 g:hover:border-line g:hover:bg-[var(--hover)] g:focus-visible:shadow-[inset_0_0_0_1px_var(--violet)] g:[&:nth-child(7n)]:border-e-0",
                d === today && "g:[&>span:first-child]:text-brand-700",
              )}
            >
              <span className="font-semibold text-ink g:font-medium g:tabular">{Number(d.slice(8))}</span>
              {days === null ? <span className="h-3" /> : n > 0 ? <span className="text-2xs font-bold text-brand-700 tabular g:text-[12px] g:font-normal g:text-ink-2">{n}</span> : <span className="h-3" />}
              {c && archived !== "only" && c.empty > 0 && <span className="text-[9.5px] text-warning-ink g:text-[11px]">{t("tours.cal.empty", { count: c.empty })}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Daily clean-up: for one day, archive the closed tours and delete the empty drafts. Both go
 * through the bulk preview, which shows exactly what changes before anything happens.
 */
function DayCleanup({ defaultDay, depotId, onRun, may }: { defaultDay: string; depotId?: string; onRun: (b: { action: BulkAction; selection: BulkSelection }) => void; may: { archive: boolean; del: boolean } }) {
  const { session } = useDispatch();
  const { t } = useI18n();
  const [day, setDay] = useState(defaultDay);
  const [counts, setCounts] = useState<{ closed: number; drafts: number } | null>(null);
  const api = lifecycleApi(session.organizationId);
  const closedFilter: TourListFilter = { date: day, depotId, status: ["completed", "cancelled"], archived: "exclude" };
  const draftFilter: TourListFilter = { date: day, depotId, status: ["planned"], archived: "exclude", empty: true, published: false };
  useEffect(() => {
    let alive = true;
    setCounts(null);
    Promise.all([api.list(closedFilter, { limit: 1, offset: 0 }), api.list(draftFilter, { limit: 1, offset: 0 })]).then(
      ([c, d]) => alive && setCounts({ closed: c.total, drafts: d.total }),
      () => alive && setCounts({ closed: 0, drafts: 0 }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, depotId, session.organizationId]);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-[13px] g:gap-2 g:rounded-lg g:bg-surface g:px-3 g:py-2" aria-label={t("tours.m.cleanup")}>
      <label className="flex items-center gap-2 font-medium text-ink-2 g:font-normal g:text-muted">
        {t("tours.m.day")}
        <input type="date" className={cn(fieldCls, "w-40", gControl)} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t("tours.clean.dayAria")} />
      </label>
      {counts === null ? (
        <Loader2 className="size-4 animate-spin text-muted" />
      ) : (
        <>
          {may.archive && (
            <Button variant="secondary" disabled={counts.closed === 0} onClick={() => onRun({ action: "archive", selection: bulkFilter(closedFilter) })}>
              <Archive className="g:text-muted" /> {t("tours.clean.archive", { count: counts.closed })}
            </Button>
          )}
          {may.del && (
            <Button variant="secondary" className="text-danger-ink" disabled={counts.drafts === 0} onClick={() => onRun({ action: "delete", selection: bulkFilter(draftFilter) })}>
              <Trash2 /> {t("tours.clean.delete", { count: counts.drafts })}
            </Button>
          )}
          <span className="text-2xs text-muted g:text-[12px]">{t("tours.clean.hint")}</span>
        </>
      )}
    </div>
  );
}
