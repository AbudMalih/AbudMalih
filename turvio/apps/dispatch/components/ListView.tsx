"use client";

import { formatClock, type DispatchTourStatus, type TourSummary } from "@turvio/shared";
import { Avatar, Button, Card, EmptyState, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, SearchInput, cn } from "@turvio/web-ui/ds";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ListFilter, SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { tourColor } from "../lib/helpers";
import { useDispatch } from "../lib/store";
import { finishShort, finishValue, projectionNote, scheduledFinishLabel } from "../lib/eta";
import { TOUR_STATUS, TourStatusBadge, tourStatusLabel } from "./StatusBadge";
import { useI18n } from "../lib/i18n/client";
import { TourDetailSheet } from "./TourDetail";

export type ListSort = "name" | "driver" | "depot" | "total" | "completed" | "remaining" | "pickups" | "eta" | "status";
const STATUS_ORDER = ["delayed", "in_progress", "paused", "planned", "completed"] as const;

export function sortTours(rows: TourSummary[], sort: ListSort, dir: "asc" | "desc"): TourSummary[] {
  const f = dir === "asc" ? 1 : -1;
  const val = (s: TourSummary): string | number => {
    switch (sort) {
      case "name":
        return s.tour.name;
      case "driver":
        return s.driver?.displayName ?? "~";
      case "depot":
        return s.depot.name;
      case "total":
        return s.total;
      case "completed":
        return s.completed;
      case "remaining":
        return s.remaining;
      case "pickups":
        return s.pickups;
      case "eta":
        return s.timeline.projectedEndMinute;
      case "status":
        return STATUS_ORDER.indexOf(s.status as (typeof STATUS_ORDER)[number]);
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "de");
    return c * f || a.tour.name.localeCompare(b.tour.name);
  });
}

function Th({ label, k, sort, dir, onSort, className, numeric }: { label: string; k: ListSort; sort: ListSort; dir: "asc" | "desc"; onSort: (k: ListSort) => void; className?: string; numeric?: boolean }) {
  const active = sort === k;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("h-11 whitespace-nowrap px-3 text-start font-bold g:h-9 g:font-medium", numeric && "g:text-end", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("group/th -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase hover:bg-surface-2 hover:text-ink g:py-0.5 g:hover:bg-[var(--hover)]", numeric && "g:flex-row-reverse", active && "text-ink g:text-ink-2")}>
        {label}
        <Icon className={cn("size-3", active ? "text-brand-600 g:text-ink-2" : "text-subtle g:opacity-0 g:transition-opacity g:group-hover/th:opacity-100 g:group-focus-visible/th:opacity-100")} />
      </button>
    </th>
  );
}

const PAGE = 8;

export function ListView() {
  const { summaries, scoped, selectTour, data } = useDispatch();
  const { t, locale } = useI18n();
  // English shows the finish wording in lower case mid-sentence; German nouns keep their capital, Arabic has no case.
  const lower = (x: string) => (locale === "en" ? x.toLowerCase() : x);
  const params = useSearchParams();
  const initialStatus = params?.get("status");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>(initialStatus && initialStatus in TOUR_STATUS ? [initialStatus] : []);
  const [sort, setSort] = useState<ListSort>("status");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = summaries.filter(
      (s) =>
        (statuses.length === 0 || statuses.includes(s.status)) &&
        (!q || [s.tour.name, s.tour.id, s.driver?.displayName, s.depot.name, s.vehicleLabel, s.vehiclePlate].some((v) => v?.toLowerCase().includes(q))),
    );
    return sortTours(rows, sort, dir);
  }, [summaries, query, statuses, sort, dir]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pageCount - 1);
  const rows = filtered.slice(p * PAGE, p * PAGE + PAGE);
  const finishNote = (s: TourSummary) =>
    s.status === "completed"
      ? t("map.list.finished")
      : scheduledFinishLabel(s.timeline.projection, t)
        ? t("map.list.departingNow", { scheduled: scheduledFinishLabel(s.timeline.projection, t)! })
        : t("map.list.shiftUntil", { finish: lower(finishShort(s.tour, s.timeline.projection, t)), time: formatClock(s.timeline.shiftEndMinute) });
  const onSort = (k: ListSort) => {
    setDir(sort === k && dir === "asc" ? "desc" : "asc");
    setSort(k);
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5 g:gap-4">
        <div className="mb-4 flex flex-col gap-1 g:mb-0 g:gap-0.5">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:tracking-[-0.015em]">{t("map.list.title")}</h1>
          <p className="mt-1 text-sm text-ink-2 g:mt-0 g:text-[13px] g:text-muted">
            {t("map.list.subtitle", { count: data.tours.length, date: data.date })}
            {(() => {
              const est = summaries.filter((s) => s.tour.status !== "completed" && s.timeline.projection.source === "estimate").length;
              return est ? t("map.list.estNote", { count: est }) : "";
            })()}
          </p>
        </div>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between g:px-3 g:py-2">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(0);
              }}
              placeholder={t("map.list.searchPlaceholder")}
              label={t("map.list.searchLabel")}
              className="sm:w-80 g:sm:w-72"
            />
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" className={cn(statuses.length > 0 && "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50 g:border-line-3 g:bg-[var(--selected)] g:text-ink g:hover:bg-[var(--selected)]")}>
                  <ListFilter className="g:text-muted" /> {t("map.list.status")}
                  {statuses.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-2xs font-semibold leading-4 text-white g:bg-transparent g:px-0 g:text-[12px] g:font-medium g:text-muted">{statuses.length}</span>}
                </Button>
              </MenuTrigger>
              <MenuContent className="w-52">
                <MenuLabel>{t("map.list.status")}</MenuLabel>
                {(Object.keys(TOUR_STATUS) as DispatchTourStatus[]).map((k) => (
                  <MenuCheckboxItem
                    key={k}
                    checked={statuses.includes(k)}
                    onCheckedChange={(c) => {
                      setStatuses(c ? [...statuses, k] : statuses.filter((x) => x !== k));
                      setPage(0);
                    }}
                  >
                    {tourStatusLabel(k, t)}
                  </MenuCheckboxItem>
                ))}
                {statuses.length > 0 && (
                  <>
                    <MenuSeparator />
                    <MenuItem onSelect={() => setStatuses([])}>{t("map.list.clearFilter")}</MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<SearchX />} title={t("map.list.noMatch")} description={data.tours.length ? t("map.list.adjust") : t("map.list.noneForDate")} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <tr className="border-b border-line">
                    <Th label={t("map.list.col.tour")} k="name" sort={sort} dir={dir} onSort={onSort} className="ps-4" />
                    <Th label={t("map.list.col.driver")} k="driver" sort={sort} dir={dir} onSort={onSort} />
                    <Th label={t("map.list.col.depot")} k="depot" sort={sort} dir={dir} onSort={onSort} />
                    <th scope="col" className="h-10 px-3 text-start font-medium g:h-9">{t("map.list.col.vehicle")}</th>
                    <Th label={t("map.list.col.stops")} k="total" sort={sort} dir={dir} onSort={onSort} numeric />
                    <Th label={t("map.list.col.done")} k="completed" sort={sort} dir={dir} onSort={onSort} numeric />
                    <Th label={t("map.list.col.left")} k="remaining" sort={sort} dir={dir} onSort={onSort} numeric />
                    <Th label={t("map.list.col.pickups")} k="pickups" sort={sort} dir={dir} onSort={onSort} numeric />
                    <Th label={t("map.list.col.status")} k="status" sort={sort} dir={dir} onSort={onSort} className="g:ps-6" />
                    <Th label={t("map.list.col.finish")} k="eta" sort={sort} dir={dir} onSort={onSort} className="pe-4" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.tour.id} onClick={() => selectTour(s.tour.id)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2/50 g:h-9 g:duration-150 g:hover:bg-[var(--hover)]">
                      <td className="whitespace-nowrap py-3 pe-3 ps-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTour(s.tour.id);
                          }}
                          className="flex items-center gap-2 rounded font-semibold text-ink outline-none hover:text-brand-700 focus-visible:shadow-[var(--shadow-focus)] g:font-medium g:hover:text-ink g:hover:underline g:underline-offset-2"
                        >
                          <span className="size-2.5 rounded-full g:size-2" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
                          {s.tour.name}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {s.driver ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={s.driver.displayName} size="sm" className="g:size-5 g:text-[9px]" />
                            {s.driver.displayName}
                          </span>
                        ) : (
                          <span className="text-warning-ink">{t("map.list.unassigned")}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{s.depot.name}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">
                        {s.vehicleLabel ?? <span className="text-warning-ink">–</span>}
                        {s.vehiclePlate && <span className="block text-2xs text-muted g:ms-1.5 g:inline g:text-[12px]">{s.vehiclePlate}</span>}
                      </td>
                      <td className="px-3 py-3 tabular g:text-end">{s.total}</td>
                      <td className="px-3 py-3 tabular g:whitespace-nowrap g:text-end">
                        <span className="g:inline-flex g:flex-row-reverse g:items-baseline g:gap-1.5">
                          {s.completed}
                          {s.failed > 0 && <span className="block text-2xs text-danger-ink g:text-[12px] g:after:ms-1.5 g:after:text-subtle g:after:content-['·']">{t("map.list.failed", { n: s.failed })}</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular g:text-end">{s.remaining}</td>
                      <td className="px-3 py-3 tabular g:whitespace-nowrap g:text-end">
                        <span className="g:inline-flex g:flex-row-reverse g:items-baseline g:gap-1.5">
                          {s.pickups}
                          {s.pickupsRemaining > 0 && <span className="block text-2xs text-muted g:text-[12px] g:after:ms-1.5 g:after:text-subtle g:after:content-['·']">{t("map.list.open", { n: s.pickupsRemaining })}</span>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 g:ps-6">
                        <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
                      </td>
                      <td className="whitespace-nowrap py-3 pe-4 ps-3 tabular">
                        <span className={cn(s.status === "delayed" ? (s.delayCertainty === "estimated" ? "font-medium text-warning-ink" : "font-medium text-danger-ink") : "text-ink-2")} title={s.status === "completed" ? undefined : projectionNote(s.timeline.projection, t)}>
                          {s.status === "completed" ? formatClock(s.timeline.projectedEndMinute) : finishValue(s.timeline.projection)}
                          {s.status !== "completed" && s.timeline.projection.source === "estimate" ? t("map.list.est") : ""}
                        </span>
                        <span className="block text-2xs text-muted g:ms-2 g:inline-block g:max-w-[150px] g:truncate g:align-bottom g:text-[12px]" title={finishNote(s)}>
                          {finishNote(s)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-muted g:px-3 g:py-2 g:text-[12px]">
              <span className="tabular">
                {t("map.list.pageRange", { from: p * PAGE + 1, to: Math.min(filtered.length, (p + 1) * PAGE), total: filtered.length })}
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="icon-sm" aria-label={t("map.list.prevPage")} disabled={p === 0} onClick={() => setPage(p - 1)}>
                  <ChevronLeft className="rtl:-scale-x-100" />
                </Button>
                <Button variant="secondary" size="icon-sm" aria-label={t("map.list.nextPage")} disabled={p >= pageCount - 1} onClick={() => setPage(p + 1)}>
                  <ChevronRight className="rtl:-scale-x-100" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      <TourDetailSheet />
    </div>
  );
}
