"use client";

import { formatClock } from "@turvio/shared";
import { Button, Sheet, Tooltip, cn } from "@turvio/web-ui/ds";
import { AlertTriangle, ArrowUpFromLine, List, Map as MapIcon, MousePointerClick, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { tourColor } from "../lib/helpers";
import { useLiveFleet, type LiveVehicle } from "../lib/live";
import { routeKey, useRoadRoute } from "../lib/road";
import { useDispatch } from "../lib/store";
import { LiveFleetList, LiveVehiclePanel } from "./LiveFleet";
import { PickupStateBadge, deadlineLabel } from "./StatusBadge";
import { TourDetail } from "./TourDetail";
import { TourList } from "./TourList";

const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" aria-label="Loading map" />,
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
  const urgent = pickups.filter((p) => p.state === "late" || p.state === "at_risk" || p.state === "unassigned").slice(0, 6);
  const delayed = summaries.filter((s) => s.status === "delayed");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2/50 p-3 text-[13px] text-muted">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-subtle" />
        Select a tour in the list or on the map to see its driver, vehicle, schedule and stops.
      </div>
      {live.allowed && <LiveFleetList vehicles={live.vehicles} serverNow={live.serverNow} onSelect={onSelectVehicle} />}
      {delayed.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
            <AlertTriangle className="size-3.5 text-danger" /> Delayed tours
          </h3>
          <ul className="flex flex-col gap-1.5">
            {delayed.map((s) => (
              <li key={s.tour.id}>
                <button onClick={() => selectTour(s.tour.id)} className="w-full rounded-md border border-red-200 bg-danger-soft/60 px-3 py-2 text-start text-[13px] hover:bg-danger-soft">
                  <span className="font-semibold text-danger-ink">{s.tour.name}</span> <span className="text-muted">· {s.driver?.displayName ?? "no driver"}</span>
                  <span className="mt-0.5 block text-xs text-danger-ink/80">{s.timeline.delayReasons[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
            <ArrowUpFromLine className="size-3.5" /> Pickups needing attention
          </h3>
          <Link href="/pickups" className="text-xs font-medium text-brand-600 hover:underline">
            All pickups
          </Link>
        </div>
        {urgent.length === 0 ? (
          <p className="text-[13px] text-muted">All pickups are on schedule.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {urgent.map((p) => (
              <li key={p.stop.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{p.stop.recipientName}</div>
                  <div className="truncate text-2xs text-muted">
                    {p.tourName ?? "No tour"} · {p.stop.timeWindow ? `${formatClock(p.stop.timeWindow.start)}–${formatClock(p.stop.timeWindow.end)}` : ""} · closes {deadlineLabel(p.minutesToDeadline)}
                  </div>
                </div>
                <PickupStateBadge state={p.state} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-2xs text-subtle">
        {data.tours.length} tours · {data.depots.length} depot{data.depots.length === 1 ? "" : "s"} in view
      </p>
    </div>
  );
}

export function MapWorkspace() {
  const d = useDispatch();
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Phone/tablet switch */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
        <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Map workspace">
          {(["tours", "map"] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={mobilePane === p}
              onClick={() => setMobilePane(p)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium", mobilePane === p ? "bg-surface text-ink shadow-xs" : "text-muted")}
            >
              {p === "tours" ? <List className="size-4" /> : <MapIcon className="size-4" />}
              {p === "tours" ? "Tours" : "Map"}
            </button>
          ))}
        </div>
        {selected && (
          <span className="truncate text-xs text-muted">
            Selected: <span className="font-medium text-ink">{selected.tour.name}</span>
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {showLeft && (
            <motion.aside
              key="left"
              initial={isDesktop ? { width: 0, opacity: 0 } : false}
              animate={{ width: isDesktop ? 340 : "100%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="z-10 shrink-0 overflow-hidden border-e border-line bg-canvas"
              aria-label="Tours and drivers"
            >
              <div className="h-full w-full lg:w-[340px]">
                <TourList onPick={() => !isDesktop && setMobilePane("map")} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className={cn("relative min-w-0 flex-1", !isDesktop && mobilePane === "tours" && "hidden")}>
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
          />
          {isDesktop && (
            <div className="absolute start-3 top-3 z-[460] flex gap-1.5">
              <Tooltip content={leftOpen ? "Hide tour list" : "Show tour list"} side="bottom">
                <Button variant="secondary" size="icon" onClick={() => setLeftOpen((o) => !o)} aria-label={leftOpen ? "Hide tour list" : "Show tour list"} className="shadow-raised">
                  {leftOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
                </Button>
              </Tooltip>
              {isWide && (
                <Tooltip content={rightOpen ? "Hide details" : "Show details"} side="bottom">
                  <Button variant="secondary" size="icon" onClick={() => setRightOpen((o) => !o)} aria-label={rightOpen ? "Hide details panel" : "Show details panel"} className="shadow-raised">
                    {rightOpen ? <PanelRightClose /> : <PanelRightOpen />}
                  </Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {showRight && (
            <motion.aside
              key="right"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="z-10 shrink-0 overflow-hidden border-s border-line bg-surface"
              aria-label="Details"
            >
              <div className="flex h-full w-[400px] flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{selected ? `Tour ${selected.tour.name}` : "Operations overview"}</h2>
                    <p className="truncate text-xs text-muted">{selected ? `${selected.depot.name} · ${selected.tour.date}` : `${data.date} · as of ${formatClock(data.asOfMinute)}`}</p>
                  </div>
                  {selected && (
                    <Button variant="ghost" size="sm" onClick={() => selectTour(null)}>
                      Clear
                    </Button>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{selected ? (
                    <div className="flex flex-col gap-4">
                      {liveOfSelected && <LiveVehiclePanel v={liveOfSelected} serverNow={live.serverNow} onFocus={() => focusVehicle(liveOfSelected)} />}
                      <TourDetail summary={selected} onFit={() => setFitRequest((n) => n + 1)} />
                    </div>
                  ) : (
                    <Overview live={live} onSelectVehicle={selectVehicle} />
                  )}</div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Below 1280px the details open as a drawer. */}
      {!isWide && (
        <Sheet
          open={!!selected}
          onOpenChange={(o) => !o && selectTour(null)}
          title={selected ? `Tour ${selected.tour.name}` : ""}
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
