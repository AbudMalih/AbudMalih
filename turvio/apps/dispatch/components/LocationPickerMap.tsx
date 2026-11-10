"use client";

import "leaflet/dist/leaflet.css";
import { haversineMeters, type GeoPoint } from "@turvio/shared";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";

/**
 * Small map for choosing one point (P0-3.6): a new pin position or a navigation approach point.
 * Click anywhere or drag the blue marker. Shows the current pin, the original location and a
 * suggestion for reference; an optional circle marks the allowed area. Choosing a point here
 * changes nothing – the dialog around it applies it only on an explicit confirmation.
 */
export interface PickerMarker {
  point: GeoPoint;
  label: string;
  kind: "current" | "original" | "suggestion" | "approach";
}

const STYLE: Record<PickerMarker["kind"], { color: string; fill: string; radius: number; dash?: string }> = {
  current: { color: "#334155", fill: "#94A3B8", radius: 7 },
  original: { color: "#7C3AED", fill: "#FFFFFF", radius: 7, dash: "3 3" },
  suggestion: { color: "#059669", fill: "#A7F3D0", radius: 7 },
  approach: { color: "#2563EB", fill: "#BFDBFE", radius: 7 },
};

/** Distance and permission of a picked point (pure – also used by the dialogs and tests). */
export function pickStatus(picked: GeoPoint | null, center: GeoPoint, maxMeters?: number): { meters: number | null; allowed: boolean } {
  if (!picked) return { meters: null, allowed: false };
  const meters = Math.round(haversineMeters(center, picked));
  return { meters, allowed: maxMeters === undefined || meters <= maxMeters };
}

export function LocationPickerMap({
  center,
  markers,
  value,
  onPick,
  limit,
  height = 280,
}: {
  center: GeoPoint;
  markers: PickerMarker[];
  value: GeoPoint | null;
  onPick: (p: GeoPoint) => void;
  /** Allowed area around `center` (e.g. 300 m for an approach point). */
  limit?: number;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const fixed = useRef<Leaflet.LayerGroup | null>(null);
  const pick = useRef<Leaflet.Marker | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const latest = useRef(onPick);
  latest.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("leaflet");
        if (cancelled || !el.current) return;
        L.current = mod;
        const m = mod.map(el.current, { zoomControl: true, attributionControl: true });
        mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
        fixed.current = mod.layerGroup().addTo(m);
        m.setView([center.lat, center.lng], 17);
        m.on("click", (e: Leaflet.LeafletMouseEvent) => latest.current({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }));
        map.current = m;
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pick.current = null;
    };
    // The map is created once per dialog; markers update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reference markers and the allowed area.
  useEffect(() => {
    const Lf = L.current;
    if (state !== "ready" || !Lf || !fixed.current) return;
    fixed.current.clearLayers();
    if (limit) Lf.circle([center.lat, center.lng], { radius: limit, color: "#2563EB", weight: 1, dashArray: "4 4", fillOpacity: 0.04 }).addTo(fixed.current);
    for (const mk of markers) {
      const st = STYLE[mk.kind];
      Lf.circleMarker([mk.point.lat, mk.point.lng], { radius: st.radius, color: st.color, fillColor: st.fill, fillOpacity: 1, weight: 2, dashArray: st.dash })
        .bindTooltip(mk.label, { direction: "top" })
        .on("click", (e: Leaflet.LeafletMouseEvent) => {
          Lf.DomEvent.stopPropagation(e);
          latest.current(mk.point);
        })
        .addTo(fixed.current);
    }
  }, [state, markers, center.lat, center.lng, limit]);

  // The picked point: a draggable marker.
  useEffect(() => {
    const Lf = L.current;
    const m = map.current;
    if (state !== "ready" || !Lf || !m) return;
    if (!value) {
      pick.current?.remove();
      pick.current = null;
      return;
    }
    if (!pick.current) {
      pick.current = Lf.marker([value.lat, value.lng], {
        draggable: true,
        icon: Lf.divIcon({ className: "turvio-pick", html: '<div style="width:18px;height:18px;border-radius:999px;background:#2563EB;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: "Chosen point – drag to adjust",
      })
        .on("dragend", () => {
          const p = pick.current!.getLatLng();
          latest.current({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
        })
        .addTo(m);
    } else pick.current.setLatLng([value.lat, value.lng]);
  }, [state, value]);

  return (
    <div className="relative overflow-hidden rounded-md border border-line" style={{ height }} data-testid="location-picker-map">
      <div ref={el} className="h-full w-full" />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-xs text-muted">{state === "loading" ? "Loading map…" : "Map unavailable – use the address search or type coordinates."}</div>
      )}
    </div>
  );
}
