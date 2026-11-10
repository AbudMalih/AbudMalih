"use client";

import { cn } from "@turvio/web-ui/ds";
import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiCallError } from "../lib/api";

export interface PickedPlace {
  lat: number;
  lng: number;
  label: string;
  /** Search hits: the geocoder's precision; typed coordinates: undefined (a hand-placed pin). */
  precision?: "house" | "street" | "postal_code" | "city" | "other";
}

interface GeocodeHit {
  label: string;
  location: { lat: number; lng: number };
  precision: "house" | "street" | "postal_code" | "city" | "other";
}

const PRECISION: Record<GeocodeHit["precision"], string> = { house: "house number", street: "street", postal_code: "postcode", city: "city", other: "approximate" };

/** "52.3759, 9.732" → coordinates (manual fallback when no address search is available). */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]!.replace(",", "."));
  const lng = Number(m[2]!.replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/**
 * Address search on the TURVIO geocoder (server side). Results are real geocoder hits with their
 * precision; nothing is guessed. Coordinates can be typed as a fallback ("52.37, 9.73").
 */
export function AddressSearch({ near, onPick, placeholder = "Street and number, city", autoFocus }: { near?: { lat: number; lng: number }; onPick: (p: PickedPlace) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [state, setState] = useState<"idle" | "busy" | "none" | "unavailable" | "error">("idle");
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3 || parseLatLng(text)) {
      setHits([]);
      setState("idle");
      return;
    }
    const mine = ++seq.current;
    setState("busy");
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: text, limit: "6", country: "de" });
        if (near) {
          params.set("lat", String(near.lat));
          params.set("lng", String(near.lng));
        }
        const r = await api<{ results: GeocodeHit[] }>("GET", `/v1/geocode/search?${params}`);
        if (mine !== seq.current) return;
        const results = r.results ?? [];
        setHits(results);
        setState(results.length ? "idle" : "none");
      } catch (e) {
        if (mine !== seq.current) return;
        setHits([]);
        setState(e instanceof ApiCallError && e.code === "geocoder_unavailable" ? "unavailable" : "error");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, near]);

  const coords = parseLatLng(q);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-subtle" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Search address"
          className="h-9 w-full rounded-md border border-line bg-surface ps-8 pe-8 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none"
        />
        {state === "busy" && <Loader2 className="absolute end-2.5 top-2.5 size-4 animate-spin text-subtle" aria-label="Searching" />}
      </div>
      {coords && (
        <button type="button" onClick={() => onPick({ ...coords, label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` })} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-2 text-start text-sm hover:bg-surface-2">
          <MapPin className="size-4 text-brand-600" /> Use coordinates {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </button>
      )}
      {hits.length > 0 && (
        <ul role="listbox" aria-label="Address results" className="max-h-56 divide-y divide-line overflow-auto rounded-md border border-line bg-surface">
          {hits.map((h, i) => (
            <li key={`${h.label}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onPick({ lat: h.location.lat, lng: h.location.lng, label: h.label, precision: h.precision })}
                className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-start text-sm hover:bg-surface-2"
              >
                <span className="text-ink">{h.label}</span>
                <span className={cn("shrink-0 text-2xs", h.precision === "house" ? "text-success-ink" : "text-warning-ink")}>{PRECISION[h.precision]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {state === "none" && <p className="text-xs text-muted">No address found. Check the spelling, or enter coordinates (e.g. 52.3759, 9.7320).</p>}
      {state === "unavailable" && <p className="text-xs text-warning-ink">Address search is not available on this server. Enter coordinates instead (e.g. 52.3759, 9.7320).</p>}
      {state === "error" && <p className="text-xs text-danger">Address search failed. Try again, or enter coordinates.</p>}
    </div>
  );
}
