"use client";

import { formatClock, type TourSummary } from "@turvio/shared";
import { Avatar, Button, Card, EmptyState, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, SearchInput, cn } from "@turvio/web-ui/ds";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ListFilter, SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { tourColor } from "../lib/helpers";
import { useDispatch } from "../lib/store";
import { finishShort, finishValue, projectionNote, scheduledFinishLabel } from "../lib/eta";
import { TOUR_STATUS, TourStatusBadge } from "./StatusBadge";
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

function Th({ label, k, sort, dir, onSort, className }: { label: string; k: ListSort; sort: ListSort; dir: "asc" | "desc"; onSort: (k: ListSort) => void; className?: string }) {
  const active = sort === k;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("h-11 whitespace-nowrap px-3 text-start font-bold", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase hover:bg-surface-2 hover:text-ink", active && "text-ink")}>
        {label}
        <Icon className={cn("size-3", active ? "text-brand-600" : "text-subtle")} />
      </button>
    </th>
  );
}

const PAGE = 8;

export function ListView() {
  const { summaries, scoped, selectTour, data } = useDispatch();
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
  const onSort = (k: ListSort) => {
    setDir(sort === k && dir === "asc" ? "desc" : "asc");
    setSort(k);
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">Tours</h1>
          <p className="mt-1 text-sm text-ink-2">
            {data.tours.length} tours on {data.date} · completion from road times
            {(() => {
              const est = summaries.filter((s) => s.tour.status !== "completed" && s.timeline.projection.source === "estimate").length;
              return est ? ` · ${est} marked “est.” use straight-line estimates (no road times)` : "";
            })()}
          </p>
        </div>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(0);
              }}
              placeholder="Search tour, driver, depot, vehicle…"
              label="Search tours"
              className="sm:w-80"
            />
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" className={cn(statuses.length > 0 && "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50")}>
                  <ListFilter /> Status
                  {statuses.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-2xs font-semibold leading-4 text-white">{statuses.length}</span>}
                </Button>
              </MenuTrigger>
              <MenuContent className="w-52">
                <MenuLabel>Status</MenuLabel>
                {Object.entries(TOUR_STATUS).map(([k, v]) => (
                  <MenuCheckboxItem
                    key={k}
                    checked={statuses.includes(k)}
                    onCheckedChange={(c) => {
                      setStatuses(c ? [...statuses, k] : statuses.filter((x) => x !== k));
                      setPage(0);
                    }}
                  >
                    {v.label}
                  </MenuCheckboxItem>
                ))}
                {statuses.length > 0 && (
                  <>
                    <MenuSeparator />
                    <MenuItem onSelect={() => setStatuses([])}>Clear filter</MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No tours match" description={data.tours.length ? "Adjust the search or status filter." : "No tours are planned for this date."} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <tr className="border-b border-line">
                    <Th label="Tour" k="name" sort={sort} dir={dir} onSort={onSort} className="ps-4" />
                    <Th label="Driver" k="driver" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Depot" k="depot" sort={sort} dir={dir} onSort={onSort} />
                    <th scope="col" className="h-10 px-3 text-start font-medium">Vehicle</th>
                    <Th label="Stops" k="total" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Done" k="completed" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Left" k="remaining" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Pickups" k="pickups" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Status" k="status" sort={sort} dir={dir} onSort={onSort} />
                    <Th label="Finish" k="eta" sort={sort} dir={dir} onSort={onSort} className="pe-4" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.tour.id} onClick={() => selectTour(s.tour.id)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2/50">
                      <td className="whitespace-nowrap py-3 pe-3 ps-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTour(s.tour.id);
                          }}
                          className="flex items-center gap-2 rounded font-semibold text-ink outline-none hover:text-brand-700 focus-visible:shadow-[var(--shadow-focus)]"
                        >
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
                          {s.tour.name}
                        </button>
                        <span className="block font-mono text-2xs text-subtle">{s.tour.id}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {s.driver ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={s.driver.displayName} size="sm" />
                            {s.driver.displayName}
                          </span>
                        ) : (
                          <span className="text-warning-ink">Unassigned</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{s.depot.name}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">
                        {s.vehicleLabel ?? <span className="text-warning-ink">–</span>}
                        {s.vehiclePlate && <span className="block text-2xs text-muted">{s.vehiclePlate}</span>}
                      </td>
                      <td className="px-3 py-3 tabular">{s.total}</td>
                      <td className="px-3 py-3 tabular">
                        {s.completed}
                        {s.failed > 0 && <span className="block text-2xs text-danger-ink">{s.failed} failed</span>}
                      </td>
                      <td className="px-3 py-3 tabular">{s.remaining}</td>
                      <td className="px-3 py-3 tabular">
                        {s.pickups}
                        {s.pickupsRemaining > 0 && <span className="block text-2xs text-muted">{s.pickupsRemaining} open</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
                      </td>
                      <td className="whitespace-nowrap py-3 pe-4 ps-3 tabular">
                        <span className={cn(s.status === "delayed" ? (s.delayCertainty === "estimated" ? "font-medium text-warning-ink" : "font-medium text-danger-ink") : "text-ink-2")} title={s.status === "completed" ? undefined : projectionNote(s.timeline.projection)}>
                          {s.status === "completed" ? formatClock(s.timeline.projectedEndMinute) : finishValue(s.timeline.projection)}
                          {s.status !== "completed" && s.timeline.projection.source === "estimate" ? " (est.)" : ""}
                        </span>
                        <span className="block text-2xs text-muted">
                          {s.status === "completed"
                            ? "finished"
                            : scheduledFinishLabel(s.timeline.projection)
                              ? `if departing now · ${scheduledFinishLabel(s.timeline.projection)}`
                              : `${finishShort(s.tour, s.timeline.projection).toLowerCase()} · shift until ${formatClock(s.timeline.shiftEndMinute)}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-muted">
              <span className="tabular">
                {p * PAGE + 1}–{Math.min(filtered.length, (p + 1) * PAGE)} of {filtered.length}
              </span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={p === 0} onClick={() => setPage(p - 1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={p >= pageCount - 1} onClick={() => setPage(p + 1)}>
                  <ChevronRight />
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
