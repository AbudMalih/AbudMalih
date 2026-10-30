"use client";

import "leaflet/dist/leaflet.css";
import type { Depot, Stop } from "@turvio/shared";
import { useEffect, useRef } from "react";

/**
 * Leaflet map with OpenStreetMap tiles. OSM's public tile servers are for
 * light development use only; production must use a commercial or
 * self-hosted tile provider (see docs/ARCHITECTURE.md).
 */
export function TourMap({ depot, stops }: { depot: Depot; stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const pin = (label: string, color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:15px;min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;box-shadow:0 1px 3px rgba(0,0,0,.3)">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

      const points: [number, number][] = [[depot.location.lat, depot.location.lng]];
      L.marker([depot.location.lat, depot.location.lng], { icon: pin("D", "#1F2937"), title: depot.name }).addTo(map);
      stops.forEach((s, i) => {
        if (!s.location) return;
        const color = s.status !== "pending" ? "#16A34A" : s.priority ? "#D97706" : "#2563EB";
        L.marker([s.location.lat, s.location.lng], { icon: pin(String(i + 1), color), title: s.recipientName ?? "" }).addTo(map!);
        points.push([s.location.lat, s.location.lng]);
      });
      // Straight order preview, not road geometry.
      L.polyline(points, { color: "#2563EB", weight: 3, dashArray: "6 6" }).addTo(map);
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [depot, stops]);

  return <div ref={el} style={{ height: 420, borderRadius: 12, border: "1px solid var(--border)" }} aria-label="Karte der Tour" />;
}
