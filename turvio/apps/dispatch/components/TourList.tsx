"use client";

import { formatClock, type DispatchTourStatus, type TourSummary } from "@turvio/shared";
import { Avatar, EmptyState, SearchInput, cn } from "@turvio/web-ui/ds";
import { ArrowUpFromLine, Route, SearchX, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { tourColor } from "../lib/draft";
import { useDispatch } from "../lib/store";
import { TourStatusBadge } from "./StatusBadge";

export type TourFilter = "all" | "active" | "delayed" | "planned" | "completed";

const FILTERS: { key: TourFilter; label: string; match: (s: DispatchTourStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "On route", match: (s) => s === "in_progress" || s === "paused" || s === "delayed" },
  { key: "delayed", label: "Delayed", match: (s) => s === "delayed" },
  { key: "planned", label: "Planned", match: (s) => s === "planned" },
  { key: "completed", label: "Done", match: (s) => s === "completed" },
];

export function filterTours(summaries: TourSummary[], query: string, filter: TourFilter): TourSummary[] {
  const q = query.trim().toLowerCase();
  const f = FILTERS.find((x) => x.key === filter)!;
  return summaries.filter(
    (s) =>
      f.match(s.status) &&
      (!q ||
        [s.tour.name, s.tour.id, s.driver?.displayName, s.vehicleLabel, s.vehiclePlate, s.depot.name].some((v) => v?.toLowerCase().includes(q))),
  );
}

export function TourList({ onPick }: { onPick?: (id: string) => void }) {
  const { summaries, scoped, selectedTourId, selectTour, data } = useDispatch();
  const asOf = data.asOfMinute;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TourFilter>("all");
  const visible = useMemo(() => filterTours(summaries, query, filter), [summaries, query, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, summaries.filter((s) => f.match(s.status)).length])), [summaries]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2.5 border-b border-line p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search tours, drivers, vehicles…" label="Search tours and drivers" />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter tours by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                filter === f.key ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {f.label}
              <span className="tabular text-2xs opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <EmptyState icon={<SearchX />} title={data.tours.length ? "No tours match" : "No tours for this day"} description={data.tours.length ? "Change the search or filter." : "Synthetic data exists for the current operating day only."} />
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Tours">
            {visible.map((s) => {
              const sel = s.tour.id === selectedTourId;
              const pct = s.total ? (s.completed / s.total) * 100 : 0;
              const color = tourColor(scoped, s.tour.id);
              const deadline = s.nextPickupDeadline;
              return (
                <li key={s.tour.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selectTour(sel ? null : s.tour.id);
                      onPick?.(s.tour.id);
                    }}
                    aria-pressed={sel}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-lg border bg-surface p-3 text-start outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] focus-visible:shadow-[var(--shadow-focus)]",
                      sel ? "border-brand-500 shadow-raised ring-1 ring-brand-500" : "border-line shadow-xs hover:border-line-strong hover:shadow-card",
                    )}
                  >
                    <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Route className="size-3.5 shrink-0 text-subtle" />
                        <span className="truncate text-[13px] font-semibold text-ink">{s.tour.name}</span>
                        <span className="truncate text-xs text-muted">{s.depot.name}</span>
                      </span>
                      <TourStatusBadge status={s.status} />
                    </div>
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <Avatar name={s.driver?.displayName ?? "–"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-[13px] font-medium", s.driver ? "text-ink-2" : "text-warning-ink")}>{s.driver?.displayName ?? "No driver assigned"}</div>
                        <div className="flex items-center gap-1 truncate text-2xs text-muted">
                          <Truck className="size-3" /> {s.vehicleLabel ? `${s.vehicleLabel} · ${s.vehiclePlate}` : "No vehicle"}
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <div className="text-[13px] font-semibold tabular text-ink">
                          {s.completed}
                          <span className="font-normal text-subtle">/{s.total}</span>
                        </div>
                        <div className="text-2xs text-muted">{s.remaining} left</div>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-3">
                      <div className={cn("h-full rounded-full transition-[width] duration-500", s.status === "delayed" ? "bg-danger" : s.status === "completed" ? "bg-success" : "bg-brand-600")} style={{ width: `${pct}%` }} />
                    </div>
                    {(deadline !== null || s.status === "planned") && (
                      <div className="mt-2 flex items-center justify-between gap-2 text-2xs text-muted">
                        {s.status === "planned" ? <span>Starts {formatClock(s.tour.plannedStartMinute)}</span> : <span>Return ≈ {formatClock(s.timeline.projectedEndMinute)}</span>}
                        {deadline !== null && (
                          <span className={cn("flex items-center gap-1", deadline - asOf < 90 ? "font-medium text-warning-ink" : "")}>
                            <ArrowUpFromLine className="size-3" /> {s.pickupsRemaining} pickup{s.pickupsRemaining > 1 ? "s" : ""} · by {formatClock(deadline)}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-line px-3 py-2 text-2xs text-subtle">
        {visible.length} of {summaries.length} tours · return times are estimates
      </div>
    </div>
  );
}
