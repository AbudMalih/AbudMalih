"use client";

import { formatAddress, formatClock, isPickupConflict, type PickupRow, type PickupState } from "@turvio/shared";
import { Button, Card, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, SearchInput, cn, toast } from "@turvio/web-ui/ds";
import { AlertTriangle, ArrowUpFromLine, PackagePlus, SearchX, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";
import { PICKUP_STATE, PickupStateBadge, deadlineLabel } from "./StatusBadge";
import { TourDetailSheet } from "./TourDetail";

type Filter = "attention" | "all" | PickupState;

export function filterPickups(rows: PickupRow[], filter: Filter, query: string): PickupRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (filter === "all" || (filter === "attention" ? isPickupConflict(r) : r.state === filter)) &&
      (!q || [r.stop.recipientName, formatAddress(r.stop), r.tourName, r.driverName].some((v) => v?.toLowerCase().includes(q))),
  );
}

export function PickupsView() {
  const { pickups, data, summaries, assignStops, selectTour, scoped } = useDispatch();
  const [filter, setFilter] = useState<Filter>("attention");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => filterPickups(pickups, filter, query), [pickups, filter, query]);
  const chips: { key: Filter; label: string }[] = [
    { key: "attention", label: "Needs attention" },
    { key: "all", label: "All" },
    ...(["missed", "late", "at_risk", "unassigned", "scheduled", "completed"] as PickupState[]).map((k) => ({ key: k as Filter, label: PICKUP_STATE[k].label })),
  ];
  const count = (f: Filter) => filterPickups(pickups, f, "").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">Pickups</h1>
          <p className="text-sm text-muted">
            Pickup schedule for {data.date} · deadlines relative to {formatClock(data.asOfMinute)} · no carrier integration
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search customer, address, tour, driver…" label="Search pickups" className="sm:w-96" />
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Filter pickups">
              {chips.map((c) => (
                <button
                  key={c.key}
                  role="tab"
                  aria-selected={filter === c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    filter === c.key ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {c.key === "attention" && <AlertTriangle className="size-3" />}
                  {c.label}
                  <span className="tabular text-2xs opacity-70">{count(c.key)}</span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<SearchX />} title={filter === "attention" ? "No pickups need attention" : "No pickups match"} description={pickups.length ? "Everything in this filter is on schedule." : "No pickups for this date."} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead className="bg-surface-2/60 text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="h-10 ps-4 pe-3 text-start font-medium">Deadline</th>
                    <th className="h-10 px-3 text-start font-medium">Customer / location</th>
                    <th className="h-10 px-3 text-start font-medium">Window</th>
                    <th className="h-10 px-3 text-start font-medium">Tour · driver</th>
                    <th className="h-10 px-3 text-start font-medium">ETA</th>
                    <th className="h-10 px-3 text-start font-medium">Status</th>
                    <th className="h-10 pe-4 ps-3 text-end font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const conflict = isPickupConflict(r);
                    const tours = summaries.filter((s) => s.depot.id === r.depotId && s.tour.status !== "completed");
                    const open = r.state !== "completed" && r.state !== "failed";
                    return (
                      <tr key={r.stop.id} className={cn("border-b border-line last:border-0", conflict && r.state === "late" ? "bg-danger-soft/40" : conflict ? "bg-warning-soft/40" : "")}>
                        <td className="whitespace-nowrap py-3 pe-3 ps-4">
                          <span className={cn("font-semibold tabular", !open ? "text-muted" : (r.minutesToDeadline ?? 999) < 60 ? "text-danger-ink" : (r.minutesToDeadline ?? 999) < 150 ? "text-warning-ink" : "text-ink")}>
                            {r.stop.timeWindow ? formatClock(r.stop.timeWindow.end) : "–"}
                          </span>
                          <span className="block text-2xs text-muted">{open ? `closes ${deadlineLabel(r.minutesToDeadline)}` : "closed"}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 font-medium text-ink">
                            <ArrowUpFromLine className="size-3.5 text-violet-600" />
                            {r.stop.recipientName}
                            {r.stop.priority && <Star className="size-3.5 fill-amber-400 text-amber-500" aria-label="Priority" />}
                          </span>
                          <span className="block text-xs text-muted">
                            {formatAddress(r.stop)} · {scoped.depots.find((x) => x.id === r.depotId)?.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular text-ink-2">{r.stop.timeWindow ? `${formatClock(r.stop.timeWindow.start)}–${formatClock(r.stop.timeWindow.end)}` : "–"}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {r.tourId ? (
                            <button onClick={() => selectTour(r.tourId)} className="text-start font-medium text-ink hover:text-brand-700">
                              {r.tourName}
                              <span className="block text-xs font-normal text-muted">{r.driverName ?? "no driver"}</span>
                            </button>
                          ) : (
                            <span className="text-warning-ink">Not on a tour</span>
                          )}
                        </td>
                        <td className={cn("whitespace-nowrap px-3 py-3 tabular", r.state === "missed" || (r.state === "late" && !r.estimated) ? "font-medium text-danger-ink" : r.state === "late" ? "text-warning-ink" : "text-ink-2")}>
                          {r.etaMinute !== null ? `${formatClock(r.etaMinute)}${r.estimated ? " (est.)" : ""}` : "–"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <PickupStateBadge state={r.state} estimated={r.estimated} />
                        </td>
                        <td className="whitespace-nowrap py-3 pe-4 ps-3 text-end">
                          {r.state === "unassigned" ? (
                            <Menu>
                              <MenuTrigger asChild>
                                <Button size="sm" variant="secondary" disabled={tours.length === 0}>
                                  <PackagePlus /> Assign
                                </Button>
                              </MenuTrigger>
                              <MenuContent className="w-56">
                                <MenuLabel>Add to tour</MenuLabel>
                                {tours.map((s) => (
                                  <MenuItem
                                    key={s.tour.id}
                                    hint={s.driver?.displayName.split(" ")[0]}
                                    onSelect={() => {
                                      assignStops([r.stop.id], s.tour.id)
                                        .then(() => toast.success(`Pickup added to ${s.tour.name}`, { description: "Saved. Re-optimize the tour to place it in the route." }))
                                        .catch((e) => toast.error("Could not assign the pickup", { description: errorMessage(e) }));
                                    }}
                                  >
                                    {s.tour.name}
                                  </MenuItem>
                                ))}
                              </MenuContent>
                            </Menu>
                          ) : r.tourId ? (
                            <Button size="sm" variant="ghost" onClick={() => selectTour(r.tourId)}>
                              View tour
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <TourDetailSheet />
    </div>
  );
}
