"use client";

import "leaflet/dist/leaflet.css";
import { formatClock, hasUsableLocation, isNotDelivered, isOpen, type Depot, type TourSummary, type UnassignedStop } from "@turvio/shared";
import { stopTooltipHtml } from "../lib/eta";
import { locationBadge, type LocationReport } from "../lib/locations";
import { Button, Skeleton, Tooltip, cn } from "@turvio/web-ui/ds";
import { CircleAlert, Layers, LocateFixed, Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { tourMapPoints } from "../lib/helpers";
import { ageLabel, freshnessOf, FRESHNESS_LABEL, type LiveVehicle } from "../lib/live";

type MapState = "loading" | "ready" | "error";

export interface RouteMapProps {
  depots: Depot[];
  summaries: TourSummary[];
  unassigned: UnassignedStop[];
  colorOf: (tourId: string) => string;
  selectedTourId: string | null;
  selectedStopId: string | null;
  onSelectTour: (id: string | null) => void;
  onSelectStop: (stopId: string, tourId: string) => void;
  /** Increment to request "fit to selection". */
  fitRequest?: number;
  /** Road geometry of the selected tour (OSRM); without it the order is drawn as straight lines. */
  road?: { tourId: string; geometry: [number, number][] } | null;
  /** Live GPS positions (only for roles allowed to see them; undefined = not available). */
  vehicles?: LiveVehicle[];
  /** Server clock (ms) for position ages. */
  serverNow?: number;
  selectedDriverId?: string | null;
  onSelectVehicle?: (v: LiveVehicle) => void;
  /** Change `n` to centre the map on this point (e.g. a selected vehicle). */
  focus?: { lat: number; lng: number; n: number } | null;
  /** Location checks per stop (P0-3.4): shown in the stop tooltip. */
  locationChecks?: Map<string, LocationReport>;
  /** Width (px) covered by floating panels at the start/end edge: kept clear when fitting and for controls. */
  insetStart?: number;
  insetEnd?: number;
}

const MAPBTN =
  "grid size-10 place-items-center rounded-xl border border-line-strong bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] text-ink-2 shadow-overlay backdrop-blur transition-[color,border-color,transform] hover:border-line-3 hover:text-ink active:scale-[0.93]";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function RouteMap(props: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const liveLayer = useRef<Leaflet.LayerGroup | null>(null);
  const [state, setState] = useState<MapState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [tiles, setTiles] = useState<"loading" | "ok" | "unavailable">("loading");
  const [showCompleted, setShowCompleted] = useState(true);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  // Initialise Leaflet (client only).
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const mod = await import("leaflet");
        if (cancelled || !el.current) return;
        L.current = mod;
        const m = mod.map(el.current, { zoomControl: false, attributionControl: true, preferCanvas: false, zoomSnap: 0.25 });
        let loaded = 0;
        let failed = 0;
        const tl = mod
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            className: "turvio-tiles",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          })
          .on("tileload", () => {
            loaded++;
            setTiles("ok");
          })
          .on("tileerror", () => {
            failed++;
            if (failed >= 4 && loaded === 0) setTiles("unavailable");
          });
        tl.addTo(m);
        m.on("click", () => latest.current.onSelectTour(null));
        layer.current = mod.layerGroup().addTo(m);
        liveLayer.current = mod.layerGroup().addTo(m);
        map.current = m;
        m.setView([51.6, 9.2], 7);
        // Panels collapse/expand around the map: keep Leaflet's size in sync.
        const ro = new ResizeObserver(() => m.invalidateSize({ pan: false }));
        ro.observe(el.current);
        m.on("unload", () => ro.disconnect());
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      liveLayer.current = null;
    };
  }, [attempt]);

  const boundsFor = useCallback((tourId: string | null): Leaflet.LatLngBounds | null => {
    const Lf = L.current;
    if (!Lf) return null;
    const p = latest.current;
    const pts: [number, number][] = [];
    const list = tourId ? p.summaries.filter((s) => s.tour.id === tourId) : p.summaries;
    for (const s of list) {
      // The tour's own start/end (else its depot) and its stops – not a far-away depot it never visits.
      for (const p of tourMapPoints(s.tour, s.depot, s.stops).path) pts.push([p.lat, p.lng]);
    }
    if (!tourId) {
      for (const d of p.depots) pts.push([d.location.lat, d.location.lng]);
      for (const u of p.unassigned) if (u.location) pts.push([u.location.lat, u.location.lng]);
    }
    return pts.length ? Lf.latLngBounds(pts) : null;
  }, []);

  const fit = useCallback(
    (tourId: string | null) => {
      const b = boundsFor(tourId);
      const { insetStart = 0, insetEnd = 0 } = latest.current;
      if (b && map.current)
        map.current.fitBounds(b, { paddingTopLeft: [insetStart + 40, 64], paddingBottomRight: [insetEnd + 64, 40], maxZoom: 15, animate: !prefersReducedMotion() });
    },
    [boundsFor],
  );

  // Draw layers whenever data, selection or toggles change.
  useEffect(() => {
    const Lf = L.current;
    const group = layer.current;
    if (state !== "ready" || !Lf || !group) return;
    group.clearLayers();
    const { summaries, depots, unassigned, selectedTourId, selectedStopId } = props;
    const colorOf = latest.current.colorOf;

    for (const d of depots) {
      Lf.marker([d.location.lat, d.location.lng], {
        icon: Lf.divIcon({
          className: "turvio-marker",
          html: `<div style="width:30px;height:30px;border-radius:8px;background:var(--solid);border:2px solid rgba(255,255,255,.9);box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/></svg></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        zIndexOffset: 1000,
        keyboard: false,
      })
        .bindTooltip(`<strong>Depot ${esc(d.name)}</strong>`, { direction: "top", offset: [0, -14] })
        .addTo(group);
    }

    for (const s of summaries) {
      const color = colorOf(s.tour.id);
      const selected = s.tour.id === selectedTourId;
      const dim = selectedTourId !== null && !selected;
      const located = s.stops.filter((x) => hasUsableLocation(x));
      const ends = tourMapPoints(s.tour, s.depot, located);
      const path: [number, number][] = ends.path.map((p) => [p.lat, p.lng] as [number, number]);
      // An own start/end address gets its own small marker (the depot marker stays where it is).
      for (const [p, letter, what] of [
        [ends.customStart, "S", "Start"],
        [ends.customEnd, "E", "End"],
      ] as const) {
        if (!p || (dim && !selected)) continue;
        Lf.marker([p.lat, p.lng], {
          icon: Lf.divIcon({
            className: "turvio-marker",
            html: `<div style="width:22px;height:22px;border-radius:50%;background:var(--surface);border:3px solid ${color};color:var(--text);font:700 11px/16px var(--font-sans),system-ui;text-align:center">${letter}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          keyboard: false,
        })
          .bindTooltip(`<strong>${esc(s.tour.name)}</strong> · ${what}${what === "Start" && s.tour.startLabel ? `: ${esc(s.tour.startLabel)}` : what === "End" && s.tour.endLabel ? `: ${esc(s.tour.endLabel)}` : ""}`, { direction: "top", offset: [0, -10] })
          .addTo(group);
      }
      const doneCount = located.filter((x) => !isOpen(x.status)).length;
      // Completed part in grey, remaining part in the tour colour.
      if (doneCount > 0 && showCompleted) {
        Lf.polyline(path.slice(0, doneCount + 1), { color: "#94A3B8", weight: selected ? 3 : 2, opacity: dim ? 0.15 : 0.7, dashArray: "4 6" }).addTo(group);
      }
      const remaining = path.slice(doneCount);
      if (props.road && props.road.tourId === s.tour.id && props.road.geometry.length > 1) {
        Lf.polyline(props.road.geometry, { color, weight: selected ? 5 : 3, opacity: dim ? 0.18 : 0.95 })
          .bindTooltip(`<strong>${esc(s.tour.name)}</strong> · road route (OSRM)`, { sticky: true })
          .addTo(group);
      } else if (remaining.length > 1) {
        Lf.polyline(remaining, { color, weight: selected ? 5 : 3, opacity: dim ? 0.18 : selected ? 0.95 : 0.7 })
          .on("click", (e) => {
            Lf.DomEvent.stopPropagation(e);
            latest.current.onSelectTour(s.tour.id);
          })
          .bindTooltip(`<strong>${esc(s.tour.name)}</strong> · ${esc(s.driver?.displayName ?? "no driver")}`, { sticky: true })
          .addTo(group);
      }

      located.forEach((stop) => {
        const done = !isOpen(stop.status);
        if (done && !showCompleted) return;
        const idx = s.stops.indexOf(stop) + 1;
        const tip = stopTooltipHtml(s, stop, idx, locationBadge(latest.current.locationChecks?.get(stop.id)));
        const onClick = (e: Leaflet.LeafletEvent) => {
          Lf.DomEvent.stopPropagation(e as Leaflet.LeafletMouseEvent);
          latest.current.onSelectStop(stop.id, s.tour.id);
        };
        if (!selected) {
          Lf.circleMarker([stop.location!.lat, stop.location!.lng], {
            radius: stop.type === "pickup" ? 5 : 3.5,
            color: done ? "#94A3B8" : color,
            weight: stop.type === "pickup" ? 2 : 1,
            fillColor: stop.type === "pickup" ? "#fff" : done ? "#CBD5E1" : color,
            fillOpacity: dim ? 0.25 : 0.9,
            opacity: dim ? 0.3 : 1,
          })
            .on("click", onClick)
            .bindTooltip(tip, { direction: "top" })
            .addTo(group);
          return;
        }
        const isSel = stop.id === selectedStopId;
        const failed = isNotDelivered(stop.status);
        const eta = s.timeline.projections.get(stop.id);
        const late = eta?.state === "deadline_missed" || eta?.state === "delivered_late" || (eta?.state === "projected_late" && s.timeline.projection.source === "road");
        const shape = stop.type === "pickup" ? "border-radius:7px" : "border-radius:999px";
        // NEXT markers: outlined in the tour colour on the map surface; the selected stop is filled.
        const bg = failed ? "var(--surface)" : done ? "var(--surface-2)" : isSel ? color : "var(--surface)";
        const fg = failed ? "var(--coral)" : done ? "var(--text-3)" : isSel ? "#fff" : "var(--text)";
        const border = failed || late ? "var(--coral)" : done ? "var(--line-3)" : color;
        const size = isSel ? 32 : 24;
        const label = failed ? "✕" : done ? "✓" : String(idx);
        Lf.marker([stop.location!.lat, stop.location!.lng], {
          icon: Lf.divIcon({
            className: "turvio-marker",
            html: `<div style="width:${size}px;height:${size}px;${shape};background:${bg};color:${fg};border:2px solid ${border};box-shadow:${isSel ? `0 0 0 5px ${color}40,` : ""}0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:700 ${isSel ? 13 : 11}px var(--font-sans),system-ui">${label}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          zIndexOffset: isSel ? 900 : done ? 100 : 500,
          title: `${idx}. ${stop.recipientName ?? ""}`,
        })
          .on("click", onClick)
          .bindTooltip(tip, { direction: "top", offset: [0, -size / 2] })
          .addTo(group);
      });
    }

    if (showUnassigned) {
      for (const u of unassigned) {
        if (!u.location) continue;
        Lf.circleMarker([u.location.lat, u.location.lng], { radius: 5, color: "#8A93A8", weight: 1.5, dashArray: "2 2", fillColor: "#F1F3F9", fillOpacity: 1, opacity: selectedTourId ? 0.4 : 1 })
          .bindTooltip(`<strong>Unassigned ${u.type}</strong><br/>${esc(u.recipientName ?? "")}${u.timeWindow ? `<br/>window ${formatClock(u.timeWindow.start)}–${formatClock(u.timeWindow.end)}` : ""}`, { direction: "top" })
          .addTo(group);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.summaries, props.depots, props.unassigned, props.selectedTourId, props.selectedStopId, showCompleted, showUnassigned, props.road, props.locationChecks]);

  // Live vehicles: own layer, redrawn on every position update / clock tick only.
  useEffect(() => {
    const Lf = L.current;
    const group = liveLayer.current;
    if (state !== "ready" || !Lf || !group) return;
    group.clearLayers();
    const now = props.serverNow ?? Date.now();
    for (const v of props.vehicles ?? []) {
      const { state: fresh, ageSeconds } = freshnessOf(v.recordedAt, now);
      const sel = v.driverId === props.selectedDriverId;
      const color = fresh === "live" ? "#3478FF" : fresh === "delayed" ? "#E8962E" : "#8A93A8";
      const ring = fresh === "live" ? "#2CE6A6" : "#fff";
      const moving = fresh === "live" && (v.position.speedMps ?? 0) > 1 && v.position.headingDeg != null;
      const size = sel ? 40 : 34;
      const arrow = moving
        ? `<div style="position:absolute;inset:-9px;transform:rotate(${v.position.headingDeg}deg)"><div style="margin:0 auto;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid ${color}"></div></div>`
        : "";
      const label = esc(v.vehicle?.label ?? v.driverName.split(" ").map((x) => x[0]).join("").slice(0, 3));
      if (sel && v.position.accuracyMeters && fresh !== "offline") {
        Lf.circle([v.position.lat, v.position.lng], { radius: v.position.accuracyMeters, color, weight: 1, fillColor: color, fillOpacity: 0.08, interactive: false }).addTo(group);
      }
      Lf.marker([v.position.lat, v.position.lng], {
        icon: Lf.divIcon({
          className: "turvio-marker",
          html: `<div style="position:relative;width:${size}px;height:${size}px">${arrow}<div style="width:${size}px;height:${size}px;border-radius:999px;background:${fresh === "offline" ? "#F1F5F9" : color};border:3px solid ${ring};${fresh === "offline" ? "border-style:dashed;border-color:#94A3B8;" : ""}box-shadow:${sel ? "0 0 0 5px rgba(117,91,255,.35)," : ""}0 4px 12px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:${fresh === "offline" ? "#64748B" : "#fff"};font:700 10px var(--font-sans),system-ui;opacity:${fresh === "offline" ? 0.75 : 1}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: 2000 + (sel ? 500 : 0),
        title: `${v.driverName} – ${FRESHNESS_LABEL[fresh]}`,
      })
        .on("click", (e) => {
          Lf.DomEvent.stopPropagation(e);
          latest.current.onSelectVehicle?.(v);
        })
        .bindTooltip(
          `<strong>${esc(v.driverName)}</strong>${v.vehicle ? ` · ${esc(v.vehicle.label ?? "")} ${esc(v.vehicle.licensePlate ?? "")}` : ""}<br/>${esc(v.tourName)} · ${v.progress.done}/${v.progress.done + v.progress.remaining} stops<br/>${
            fresh === "live" ? `Live · updated ${ageLabel(ageSeconds)}` : fresh === "delayed" ? `Delayed · last position ${ageLabel(ageSeconds)}` : `No signal · last known position ${ageLabel(ageSeconds)} – not live`
          }${v.position.accuracyMeters != null ? ` · ±${Math.round(v.position.accuracyMeters)} m` : ""}<br/><span style="opacity:.7">${label}</span>`,
          { direction: "top", offset: [0, -size / 2] },
        )
        .addTo(group);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.vehicles, props.serverNow, props.selectedDriverId]);

  useEffect(() => {
    if (state !== "ready" || !props.focus || !map.current) return;
    map.current.setView([props.focus.lat, props.focus.lng], Math.max(map.current.getZoom(), 15), { animate: !prefersReducedMotion() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.focus?.n]);

  // Fit on first load, on selection change and on request.
  const firstFit = useRef(false);
  useEffect(() => {
    if (state !== "ready") return;
    if (!firstFit.current) {
      firstFit.current = true;
      fit(props.selectedTourId);
      return;
    }
    // Wait for panel transitions to settle before fitting.
    const t = window.setTimeout(() => {
      map.current?.invalidateSize({ pan: false });
      fit(props.selectedTourId);
    }, 230);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.selectedTourId, props.fitRequest, props.summaries.length, fit]);

  const empty = props.summaries.length === 0 && props.unassigned.length === 0;

  return (
    // `isolate` keeps Leaflet's internal z-indexes (400–700) from covering drawers and menus.
    <div className="relative isolate h-full w-full overflow-hidden bg-canvas-2">
      <div ref={el} className="absolute inset-0" aria-label="Route map" role="region" />

      {state === "loading" && (
        <div className="absolute inset-0 z-[500] flex flex-col gap-3 bg-canvas-2 p-6" aria-busy="true" aria-label="Loading map">
          <Skeleton className="h-full w-full rounded-2xl bg-surface" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-canvas-2 p-6" role="alert">
          <div className="max-w-sm rounded-2xl border border-line-strong bg-raised p-5 text-center shadow-overlay">
            <CircleAlert className="mx-auto size-6 text-danger" />
            <p className="mt-2 text-sm font-semibold text-ink">The map could not be loaded</p>
            <p className="mt-1 text-[13px] text-muted">Tours remain available in the list and in the detail panel.</p>
            <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
              <RefreshCw /> Try again
            </Button>
          </div>
        </div>
      )}

      {state === "ready" && tiles === "unavailable" && (
        <div className="absolute top-4 z-[450] mx-auto w-fit max-w-md rounded-xl border border-line-strong bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3.5 py-2.5 text-xs font-semibold text-ink-2 shadow-overlay backdrop-blur" style={{ insetInlineStart: (props.insetStart ?? 0) + 120, insetInlineEnd: (props.insetEnd ?? 0) + 16 }} role="status">
          <span className="me-2 inline-block size-2 rounded-full bg-nx-amber align-middle" aria-hidden="true" />
          Base map tiles are unavailable (network or tile provider). Stops, routes and depots are still shown at their positions.
        </div>
      )}
      {state === "ready" && empty && (
        <div className="absolute inset-0 z-[440] flex items-center justify-center">
          <div className="rounded-xl border border-line-strong bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-3 text-[13px] font-semibold text-ink-2 shadow-overlay backdrop-blur">No tours or stops for this selection.</div>
        </div>
      )}

      {state === "ready" && (
        <>
          <div className="absolute bottom-6 z-[460] flex flex-col gap-2 transition-[inset-inline-end] duration-300" style={{ insetInlineEnd: (props.insetEnd ?? 0) + 16 }}>
            <Tooltip content="Zoom in" side="left">
              <button className={MAPBTN} onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
                <Plus className="size-4" />
              </button>
            </Tooltip>
            <Tooltip content="Zoom out" side="left">
              <button className={MAPBTN} onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
                <Minus className="size-4" />
              </button>
            </Tooltip>
            <Tooltip content={props.selectedTourId ? "Fit selected route" : "Fit all routes"} side="left">
              <button className={MAPBTN} onClick={() => fit(props.selectedTourId)} aria-label={props.selectedTourId ? "Fit selected route" : "Fit all routes"}>
                <LocateFixed className="size-4" />
              </button>
            </Tooltip>
            {props.selectedTourId && (
              <Tooltip content="Show all routes" side="left">
                <button className={MAPBTN} onClick={() => props.onSelectTour(null)} aria-label="Show all routes">
                  <Maximize2 className="size-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Map layers" side="left">
              <button
                className={cn(MAPBTN, layersOpen && "border-brand-500 text-nx-violet-text")}
                onClick={() => setLayersOpen((o) => !o)}
                aria-label="Map layers"
                aria-expanded={layersOpen}
              >
                <Layers className="size-4" />
              </button>
            </Tooltip>
          </div>
          {layersOpen && (
            <div className="absolute bottom-6 z-[460] w-56 rounded-2xl border border-line-strong bg-raised p-3 text-[13px] font-semibold shadow-overlay" style={{ insetInlineEnd: (props.insetEnd ?? 0) + 68 }}>
              <label className="flex items-center justify-between gap-2 py-1">
                Completed stops
                <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="size-4 accent-[var(--violet)]" />
              </label>
              <label className="flex items-center justify-between gap-2 py-1">
                Unassigned stops
                <input type="checkbox" checked={showUnassigned} onChange={(e) => setShowUnassigned(e.target.checked)} className="size-4 accent-[var(--violet)]" />
              </label>
            </div>
          )}
          <div
            className="pointer-events-none absolute bottom-4 z-[440] hidden max-w-[min(560px,calc(100%-32px))] rounded-[10px] border border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2 backdrop-blur sm:block"
            style={{ insetInlineStart: (props.insetStart ?? 0) + 16 }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full border-2 border-nx-violet bg-surface" /> Open stop
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-[3px] border-2 border-nx-violet bg-surface" /> Pickup
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full border border-line-strong bg-surface-2" /> Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-[3px] border border-white/80 bg-navy" /> Depot
              </span>
            </div>
            <div className="mt-1 font-medium text-muted">
              {props.road ? "Selected tour: road route (OSRM); other tours: stop order as straight lines" : "Lines show stop order, not road geometry"} ·{" "}
              {props.vehicles === undefined
                ? "live positions not available for your role"
                : props.vehicles.length
                  ? `${props.vehicles.length} vehicle(s) with live GPS (blue = live, amber = delayed, grey = no signal)`
                  : "no live GPS positions (tracking off or no tour on the road)"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
