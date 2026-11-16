"use client";

import { formatAddress, formatClock, isPickupConflict, type PickupRow, type PickupState } from "@turvio/shared";
import { Button, Card, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, SearchInput, cn, toast } from "@turvio/web-ui/ds";
import { AlertTriangle, ArrowUpFromLine, PackagePlus, SearchX, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "../lib/api";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { PickupStateBadge, deadlineLabel, pickupStateLabel } from "./StatusBadge";
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
  const { t, fmt } = useI18n();
  const [filter, setFilter] = useState<Filter>("attention");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => filterPickups(pickups, filter, query), [pickups, filter, query]);
  const chips: { key: Filter; label: string }[] = [
    { key: "attention", label: t("pickups.attention") },
    { key: "all", label: t("common.all") },
    ...(["missed", "late", "at_risk", "unassigned", "scheduled", "completed"] as PickupState[]).map((k) => ({ key: k as Filter, label: pickupStateLabel(k, t) })),
  ];
  const count = (f: Filter) => filterPickups(pickups, f, "").length;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5 g:gap-4">
        <div className="mb-4 flex flex-col gap-1 g:mb-0">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:leading-7 g:tracking-normal">{t("pickups.title")}</h1>
          <p className="mt-1 text-sm text-ink-2 g:mt-0 g:text-[13px] g:text-muted">{t("pickups.subtitle", { date: fmt.day(data.date), time: formatClock(data.asOfMinute) })}</p>
        </div>

        <Card className="overflow-hidden">
          {/* G: one toolbar row – search, then the state filters as quiet segments. */}
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 g:gap-2 g:px-3 g:py-2 lg:g:flex-row lg:g:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder={t("pickups.searchPlaceholder")} label={t("pickups.searchLabel")} className="sm:w-96 g:shrink-0 g:sm:w-72" />
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 g:min-w-0 g:gap-0.5" role="tablist" aria-label={t("pickups.filterLabel")}>
              {chips.map((c) => (
                <button
                  key={c.key}
                  role="tab"
                  aria-selected={filter === c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors g:rounded g:border-transparent g:text-[12.5px]",
                    filter === c.key
                      ? "border-brand-200 bg-brand-50 text-brand-700 g:border-transparent g:bg-[var(--selected)] g:text-ink"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink g:border-transparent g:bg-transparent g:hover:border-transparent g:hover:bg-[var(--hover)]",
                  )}
                >
                  {c.key === "attention" && <AlertTriangle className="size-3 g:hidden" />}
                  {c.label}
                  <span className="tabular text-2xs opacity-70 g:text-[12px] g:text-muted g:opacity-100">{count(c.key)}</span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={filter === "attention" ? t("pickups.noAttention") : t("pickups.noMatch")}
              description={pickups.length ? t("pickups.onSchedule") : t("pickups.noneForDate")}
            />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <tr className="border-b border-line">
                    <th className="h-10 ps-4 pe-3 text-start font-medium g:h-9">{t("pickups.th.deadline")}</th>
                    <th className="h-10 px-3 text-start font-medium g:h-9">{t("pickups.th.customer")}</th>
                    <th className="h-10 px-3 text-start font-medium g:h-9">{t("pickups.th.window")}</th>
                    <th className="h-10 px-3 text-start font-medium g:h-9">{t("pickups.th.tourDriver")}</th>
                    <th className="h-10 px-3 text-start font-medium g:h-9">{t("pickups.th.eta")}</th>
                    <th className="h-10 px-3 text-start font-medium g:h-9">{t("pickups.th.status")}</th>
                    <th className="h-10 pe-4 ps-3 text-end font-medium g:h-9">
                      <span className="sr-only">{t("pickups.th.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const conflict = isPickupConflict(r);
                    const tours = summaries.filter((s) => s.depot.id === r.depotId && s.tour.status !== "completed");
                    const open = r.state !== "completed" && r.state !== "failed";
                    return (
                      <tr
                        key={r.stop.id}
                        className={cn(
                          "border-b border-line last:border-0 g:transition-colors g:hover:bg-[var(--hover)]",
                          // G: no row tint; the deadline, ETA and state already carry the colour.
                          conflict && r.state === "late" ? "bg-danger-soft/40 g:bg-transparent" : conflict ? "bg-warning-soft/40 g:bg-transparent" : "",
                        )}
                      >
                        <td className="whitespace-nowrap py-3 pe-3 ps-4">
                          <span className={cn("font-semibold tabular g:font-medium", !open ? "text-muted" : (r.minutesToDeadline ?? 999) < 60 ? "text-danger-ink" : (r.minutesToDeadline ?? 999) < 150 ? "text-warning-ink" : "text-ink")}>
                            {r.stop.timeWindow ? formatClock(r.stop.timeWindow.end) : "–"}
                          </span>
                          <span className="block text-2xs text-muted tabular g:text-[12px]">{open ? t("pickups.closes", { when: deadlineLabel(r.minutesToDeadline, t) }) : t("pickups.closed")}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 font-medium text-ink">
                            <ArrowUpFromLine className="size-3.5 text-nx-violet-text g:hidden" />
                            {r.stop.recipientName}
                            {r.stop.priority && <Star className="size-3.5 fill-nx-amber text-nx-amber" aria-label={t("pickups.priority")} />}
                          </span>
                          <span className="block text-xs text-muted g:max-w-[360px] g:truncate">
                            {formatAddress(r.stop)} · {scoped.depots.find((x) => x.id === r.depotId)?.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular text-ink-2">{r.stop.timeWindow ? `${formatClock(r.stop.timeWindow.start)}–${formatClock(r.stop.timeWindow.end)}` : "–"}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {r.tourId ? (
                            <button onClick={() => selectTour(r.tourId)} className="text-start font-medium text-ink hover:text-brand-700 g:hover:text-ink g:hover:underline">
                              {r.tourName}
                              <span className="block text-xs font-normal text-muted">{r.driverName ?? t("pickups.noDriver")}</span>
                            </button>
                          ) : (
                            <span className="text-warning-ink">{t("pickups.notOnTour")}</span>
                          )}
                        </td>
                        <td className={cn("whitespace-nowrap px-3 py-3 tabular", r.state === "missed" || (r.state === "late" && !r.estimated) ? "font-medium text-danger-ink" : r.state === "late" ? "text-warning-ink" : "text-ink-2")}>
                          {r.etaMinute !== null ? (r.estimated ? t("pickups.etaEst", { time: formatClock(r.etaMinute) }) : formatClock(r.etaMinute)) : "–"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <PickupStateBadge state={r.state} estimated={r.estimated} />
                        </td>
                        <td className="whitespace-nowrap py-3 pe-4 ps-3 text-end">
                          {r.state === "unassigned" ? (
                            <Menu>
                              <MenuTrigger asChild>
                                <Button size="sm" variant="secondary" disabled={tours.length === 0}>
                                  <PackagePlus /> {t("pickups.assign")}
                                </Button>
                              </MenuTrigger>
                              <MenuContent className="w-56">
                                <MenuLabel>{t("pickups.addToTour")}</MenuLabel>
                                {tours.map((s) => (
                                  <MenuItem
                                    key={s.tour.id}
                                    hint={s.driver?.displayName.split(" ")[0]}
                                    onSelect={() => {
                                      assignStops([r.stop.id], s.tour.id)
                                        .then(() => toast.success(t("pickups.added", { tour: s.tour.name }), { description: t("pickups.addedDesc") }))
                                        .catch((e) => toast.error(t("pickups.assignFailed"), { description: errorMessage(e) }));
                                    }}
                                  >
                                    {s.tour.name}
                                  </MenuItem>
                                ))}
                              </MenuContent>
                            </Menu>
                          ) : r.tourId ? (
                            <Button size="sm" variant="ghost" onClick={() => selectTour(r.tourId)}>
                              {t("pickups.viewTour")}
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
