"use client";

import { formatClock } from "@turvio/shared";
import { delayLabel, delayReasonText } from "../lib/eta";
import { Button, PageHeader, Sheet, Tooltip, cn } from "@turvio/web-ui/ds";
import { AlertTriangle, ArrowUpFromLine, List, Map as MapIcon, MousePointerClick, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { tourColor } from "../lib/helpers";
import { useLiveFleet, type LiveVehicle } from "../lib/live";
import { routeKey, useRoadRoute } from "../lib/road";
import { useDispatch } from "../lib/store";
import { LiveFleetList, LiveVehiclePanel } from "./LiveFleet";
import { TrackingStatusPanel } from "./TrackingStatusPanel";
import { OpsSummary } from "./OpsSummary";
import { PickupStateBadge, deadlineLabel } from "./StatusBadge";
import { useI18n, useT } from "../lib/i18n/client";
import { TourDetail } from "./TourDetail";
import { TourList } from "./TourList";
import { useDesignG } from "../lib/ui";

function MapLoading() {
  const t = useT();
  return <div className="h-full w-full animate-pulse bg-surface-2" aria-label={t("map.loadingMap")} />;
}

const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    setMatch(m.matches);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}

function Overview({ live, onSelectVehicle }: { live: ReturnType<typeof useLiveFleet>; onSelectVehicle: (v: LiveVehicle) => void }) {
  const { pickups, summaries, data, selectTour } = useDispatch();
  const t = useT();
  const urgent = pickups.filter((p) => p.state === "late" || p.state === "at_risk" || p.state === "unassigned").slice(0, 6);
  const delayed = summaries.filter((s) => s.status === "delayed");
  return (
    <div className="flex flex-col gap-5 g:gap-6">
      <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] text-ink-2 g:gap-2 g:rounded-md g:border-0 g:bg-transparent g:p-0 g:text-muted">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-subtle g:size-[15px]" />
        {t("map.overviewHint")}
      </div>
      {live.allowed && <LiveFleetList vehicles={live.vehicles} serverNow={live.serverNow} onSelect={onSelectVehicle} />}
      <TrackingStatusPanel />
      {delayed.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2">
            <AlertTriangle className="size-3.5 text-danger g:hidden" /> {t("map.delayedTours")}
            <span className="ms-auto hidden tabular text-muted g:inline">{delayed.length}</span>
          </h3>
          <ul className="flex flex-col gap-1.5 g:gap-0 g:divide-y g:divide-line g:overflow-hidden g:rounded-md g:border g:border-line">
            {delayed.map((s) => (
              <li key={s.tour.id}>
                <button onClick={() => selectTour(s.tour.id)} className="w-full rounded-[14px] border border-line bg-surface-2 px-3 py-2.5 text-start text-[13px] shadow-[inset_4px_0_0_var(--coral)] transition-colors rtl:shadow-[inset_-4px_0_0_var(--coral)] hover:bg-danger-soft g:rounded-none g:border-0 g:bg-transparent g:py-2 g:shadow-none rtl:g:shadow-none g:hover:bg-[var(--hover)]">
                  <span className="hidden size-1.5 rounded-full bg-danger align-middle g:me-2 g:inline-block" aria-hidden="true" />
                  <span className="font-semibold text-danger-ink g:font-medium g:text-ink">{s.tour.name}</span> <span className="text-muted">· {s.driver?.displayName ?? t("map.noDriver")}</span>
                  <span className="mt-0.5 block text-xs text-danger-ink/80 g:ps-3.5 g:text-muted">
                    {delayLabel(s.delayCertainty, t)} · {s.timeline.projection.delayReasons[0] ? delayReasonText(s.timeline.projection.delayReasons[0], t) : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2">
            <ArrowUpFromLine className="size-3.5 g:hidden" /> {t("map.pickupsAttention")}
          </h3>
          <Link href="/pickups" className="text-xs font-bold text-nx-violet-text hover:underline g:font-normal g:text-muted g:hover:text-ink">
            {t("map.allPickups")}
          </Link>
        </div>
        {urgent.length === 0 ? (
          <p className="text-[13px] text-muted">{t("map.pickupsOnSchedule")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-surface-2 g:rounded-md g:bg-transparent">
            {urgent.map((p) => (
              <li key={p.stop.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{p.stop.recipientName}</div>
                  <div className="truncate text-2xs text-muted">
                    {p.tourName ?? t("map.noTour")} · {p.stop.timeWindow ? `${formatClock(p.stop.timeWindow.start)}–${formatClock(p.stop.timeWindow.end)}` : ""} · {t("map.pickupCloses", { deadline: deadlineLabel(p.minutesToDeadline, t) })}
                  </div>
                </div>
                <PickupStateBadge state={p.state} estimated={p.estimated} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-2xs text-subtle">
        {t("map.inView", { tours: t("common.tours", { count: data.tours.length }), depots: t("map.depots", { count: data.depots.length }) })}
      </p>
    </div>
  );
}

export function MapWorkspace() {
  const d = useDispatch();
  const { t, tr, fmt, dir } = useI18n();
  // Panels slide in from their own edge (start/end), mirrored in right-to-left layouts.
  const sx = dir === "rtl" ? -1 : 1;
  const { summaries, data, selectedTourId, selectedStopId, selectTour, selectStop, scoped } = d;
  const selectedSummary = summaries.find((x) => x.tour.id === selectedTourId);
  const road = useRoadRoute(d.session.organizationId, selectedTourId, selectedSummary ? routeKey(selectedSummary.stops) : "");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobilePane, setMobilePane] = useState<"tours" | "map">("map");
  const [fitRequest, setFitRequest] = useState(0);
  const live = useLiveFleet();
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const liveOfSelected = live.vehicles.find((v) => v.tourId === selectedTourId) ?? null;
  const focusVehicle = (v: LiveVehicle) => setFocus((f) => ({ lat: v.position.lat, lng: v.position.lng, n: (f?.n ?? 0) + 1 }));
  const selectVehicle = (v: LiveVehicle) => {
    selectTour(v.tourId);
    focusVehicle(v);
  };
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 1280px)");
  const selected = summaries.find((s) => s.tour.id === selectedTourId);
  const colorOf = useCallback((id: string) => tourColor(scoped, id), [scoped]);
  const showLeft = isDesktop ? leftOpen : mobilePane === "tours";
  const showRight = isWide && rightOpen;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dayLabel = fmt.date(new Date(`${data.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const depotLabel = d.depotId ? (scoped.depots.find((x) => x.id === d.depotId)?.name ?? "") : scoped.depots.length === 1 ? scoped.depots[0]!.name : t("map.depots", { count: scoped.depots.length });
  const g = useDesignG();
  const panel = "overflow-hidden rounded-[18px] border border-line-strong bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] shadow-overlay backdrop-blur-[18px]";

  const mapNode = (
    <RouteMap
      depots={data.depots}
      summaries={summaries}
      unassigned={data.unassigned}
      colorOf={colorOf}
      selectedTourId={selectedTourId}
      selectedStopId={selectedStopId}
      onSelectTour={selectTour}
      onSelectStop={(stopId, tourId) => selectStop(stopId, tourId)}
      fitRequest={fitRequest}
      road={road?.source === "osrm" && road.geometry && selectedTourId ? { tourId: selectedTourId, geometry: road.geometry } : null}
      vehicles={live.allowed ? live.vehicles : undefined}
      serverNow={live.serverNow}
      selectedDriverId={liveOfSelected?.driverId ?? null}
      onSelectVehicle={selectVehicle}
      focus={focus}
      locationChecks={d.locationChecks}
      insetStart={g ? 0 : isDesktop && showLeft ? 380 : 0}
      insetEnd={g ? 0 : showRight ? 432 : 0}
    />
  );
  const detailPanel = (
    <>
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 g:h-12 g:px-4 g:py-0">
      <div className="min-w-0">
        <h2 className="truncate text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{selected ? t("map.tourTitle", { name: selected.tour.name }) : t("map.opsOverview")}</h2>
        <p className="truncate text-[12.5px] text-muted g:text-[12px]">{selected ? `${selected.depot.name} · ${selected.tour.date}` : t("map.asOf", { date: data.date, time: formatClock(data.asOfMinute) })}</p>
      </div>
      {selected && (
        <Button variant="ghost" size="sm" onClick={() => selectTour(null)}>
          {t("map.clear")}
        </Button>
      )}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {selected ? (
        <div className="flex flex-col gap-4">
          {liveOfSelected && <LiveVehiclePanel v={liveOfSelected} serverNow={live.serverNow} onFocus={() => focusVehicle(liveOfSelected)} />}
          <TourDetail summary={selected} onFit={() => setFitRequest((n) => n + 1)} />
        </div>
      ) : (
        <Overview live={live} onSelectVehicle={selectVehicle} />
      )}
    </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5 g:gap-4">
      <PageHeader
        title={data.date === today ? t("map.titleToday") : t("map.title")}
        description={`${dayLabel} · ${depotLabel}`}
        actions={
          d.session.role !== "driver" && (
            <Button variant="primary" asChild>
              <Link href="/planning?new=1">
                <Plus /> {t("map.newTour")}
              </Link>
            </Button>
          )
        }
      />
      <OpsSummary />

      {/* Phone/tablet switch */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="relative inline-flex rounded-xl border border-line bg-surface p-[3px] g:rounded-md g:p-0.5" role="tablist" aria-label={t("map.workspaceTabs")}>
          {(["tours", "map"] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={mobilePane === p}
              onClick={() => setMobilePane(p)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-bold transition-colors",
                mobilePane === p ? "bg-raised text-ink shadow-[var(--seg-ind-shadow)]" : "text-muted",
              )}
            >
              {p === "tours" ? <List className="size-4" /> : <MapIcon className="size-4" />}
              {p === "tours" ? t("map.tabTours") : t("map.tabMap")}
            </button>
          ))}
        </div>
        {selected && (
          <span className="truncate text-xs text-muted">
            {tr("map.selected", { name: <span className="font-semibold text-ink">{selected.tour.name}</span> })}
          </span>
        )}
      </div>

      {g ? (
        /*
         * Phase G workspace: one bordered frame, three docked columns (tour list · map · details),
         * separated by hairlines – no floating, blurred or shadowed cards above the map. Panels can
         * still be hidden; below 1024 px the tour list and map switch with the tabs above, below
         * 1280 px details open as a drawer (unchanged behaviour).
         */
        <div className="relative flex h-[calc(100dvh-262px)] min-h-[520px] overflow-hidden rounded-lg border border-line bg-surface">
          {showLeft && (
            <aside className={cn("flex min-h-0 flex-col bg-surface", isDesktop ? "w-[340px] shrink-0 border-e border-line" : "absolute inset-0 z-[470]")} aria-label={t("map.toursAndDrivers")}>
              <TourList onPick={() => !isDesktop && setMobilePane("map")} />
            </aside>
          )}
          <div className={cn("relative min-w-0 flex-1", !isDesktop && mobilePane === "tours" && "hidden")}>
            <div className="absolute inset-0">{mapNode}</div>
            {isDesktop && (
              <div className="absolute start-3 top-3 z-[460] flex overflow-hidden rounded-md border border-line-2 bg-surface">
                <Tooltip content={leftOpen ? t("map.hideTourList") : t("map.showTourList")} side="bottom">
                  <button type="button" onClick={() => setLeftOpen((o) => !o)} aria-label={leftOpen ? t("map.hideTourList") : t("map.showTourList")} className="grid size-7 place-items-center text-muted hover:bg-[var(--hover)] hover:text-ink">
                    {leftOpen ? <PanelLeftClose className="size-[15px] rtl:-scale-x-100" /> : <PanelLeftOpen className="size-[15px] rtl:-scale-x-100" />}
                  </button>
                </Tooltip>
                {isWide && (
                  <Tooltip content={rightOpen ? t("map.hideDetails") : t("map.showDetails")} side="bottom">
                    <button type="button" onClick={() => setRightOpen((o) => !o)} aria-label={rightOpen ? t("map.hideDetailsPanel") : t("map.showDetailsPanel")} className="grid size-7 place-items-center border-s border-line-2 text-muted hover:bg-[var(--hover)] hover:text-ink">
                      {rightOpen ? <PanelRightClose className="size-[15px] rtl:-scale-x-100" /> : <PanelRightOpen className="size-[15px] rtl:-scale-x-100" />}
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          {showRight && (
            <aside className="flex w-[380px] shrink-0 flex-col border-s border-line bg-surface" aria-label={t("common.details")}>
              {detailPanel}
            </aside>
          )}
        </div>
      ) : (
      /* Map card – the map fills it; tour list and details float above it (prototype overview). */
      <div className="relative h-[calc(100dvh-150px)] min-h-[560px] overflow-hidden rounded-[22px] border border-line bg-canvas-2 shadow-card lg:h-[calc(100dvh-120px)]">
        <div className={cn("absolute inset-0", !isDesktop && mobilePane === "tours" && "hidden")}>
          {mapNode}
        </div>

        <AnimatePresence initial={false}>
          {showLeft && (
            <motion.aside
              key="left"
              initial={isDesktop ? { opacity: 0, x: -16 * sx } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * sx }}
              transition={{ duration: 0.25, ease: [0.2, 0.75, 0.25, 1] }}
              className={cn("absolute z-[470]", isDesktop ? cn("bottom-4 start-4 top-4 w-[360px]", panel) : "inset-0 bg-surface")}
              aria-label={t("map.toursAndDrivers")}
            >
              <TourList onPick={() => !isDesktop && setMobilePane("map")} />
            </motion.aside>
          )}
        </AnimatePresence>

        {isDesktop && (
          <div className="absolute top-4 z-[460] flex gap-1.5 transition-[inset-inline-start] duration-300" style={{ insetInlineStart: showLeft ? 392 : 16 }}>
            <Tooltip content={leftOpen ? t("map.hideTourList") : t("map.showTourList")} side="bottom">
              <Button variant="secondary" size="icon" onClick={() => setLeftOpen((o) => !o)} aria-label={leftOpen ? t("map.hideTourList") : t("map.showTourList")} className="bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] shadow-overlay backdrop-blur hover:translate-y-0">
                {leftOpen ? <PanelLeftClose className="rtl:-scale-x-100" /> : <PanelLeftOpen className="rtl:-scale-x-100" />}
              </Button>
            </Tooltip>
            {isWide && (
              <Tooltip content={rightOpen ? t("map.hideDetails") : t("map.showDetails")} side="bottom">
                <Button variant="secondary" size="icon" onClick={() => setRightOpen((o) => !o)} aria-label={rightOpen ? t("map.hideDetailsPanel") : t("map.showDetailsPanel")} className="bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] shadow-overlay backdrop-blur hover:translate-y-0">
                  {rightOpen ? <PanelRightClose className="rtl:-scale-x-100" /> : <PanelRightOpen className="rtl:-scale-x-100" />}
                </Button>
              </Tooltip>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {showRight && (
            <motion.aside
              key="right"
              initial={{ opacity: 0, x: 16 * sx }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 * sx }}
              transition={{ duration: 0.25, ease: [0.2, 0.75, 0.25, 1] }}
              className={cn("absolute bottom-4 end-4 top-4 z-[470] flex w-[400px] flex-col", panel)}
              aria-label={t("common.details")}
            >
              {detailPanel}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Below 1280px the details open as a drawer. */}
      {!isWide && (
        <Sheet
          open={!!selected}
          onOpenChange={(o) => !o && selectTour(null)}
          title={selected ? t("map.tourTitle", { name: selected.tour.name }) : ""}
          description={selected ? `${selected.depot.name} · ${selected.tour.date}` : undefined}
          className="max-w-lg"
        >
          {selected && (
            <div className="flex flex-col gap-4">
              {liveOfSelected && <LiveVehiclePanel v={liveOfSelected} serverNow={live.serverNow} onFocus={() => focusVehicle(liveOfSelected)} />}
              <TourDetail summary={selected} onFit={() => setFitRequest((n) => n + 1)} />
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
