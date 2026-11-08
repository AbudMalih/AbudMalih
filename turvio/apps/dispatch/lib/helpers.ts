import { formatClock, parseMinuteOfDay, tourEndPoint, tourStartPoint, type DispatchDataset, type GeoPoint, type NewStopInput, type Stop, type Tour } from "@turvio/shared";

/** Open tours (not completed) that already use this driver / vehicle. */
export function driverBusy(data: Pick<DispatchDataset, "tours">, driverId: string, exceptTourId?: string): Tour | undefined {
  return data.tours.find((t) => t.driverId === driverId && t.status !== "completed" && t.id !== exceptTourId);
}
export function vehicleBusy(data: Pick<DispatchDataset, "tours">, vehicleId: string, exceptTourId?: string): Tour | undefined {
  return data.tours.find((t) => t.vehicleId === vehicleId && t.status !== "completed" && t.id !== exceptTourId);
}

/**
 * Points a tour is drawn through when no road geometry is available: its own start (else the
 * depot), its located stops in order, and – only for an own end address – that end. A return to the
 * depot is not drawn (it was not before; the road route shows the full trip). `customStart`/`customEnd`
 * are set when they differ from the depot, so the map can mark them.
 */
export function tourMapPoints(tour: Tour, depot: { location: GeoPoint }, stops: Pick<Stop, "location">[]) {
  const start = tourStartPoint(tour, depot.location);
  const end = tourEndPoint(tour, depot.location);
  const same = (a: GeoPoint, b: GeoPoint) => a.lat === b.lat && a.lng === b.lng;
  const customStart = same(start, depot.location) ? null : start;
  const customEnd = end && !same(end, depot.location) ? end : null;
  const located = stops.filter((s): s is { location: GeoPoint } => !!s.location).map((s) => s.location);
  return { path: [start, ...located, ...(customEnd ? [customEnd] : [])], customStart, customEnd, endsAtLastStop: !end };
}

/** Distinct, accessible route colours (blue first = brand). */
export const ROUTE_COLORS = ["#2563EB", "#7C3AED", "#0D9488", "#D97706", "#DB2777", "#059669", "#EA580C", "#4F46E5", "#0891B2", "#BE123C", "#65A30D", "#9333EA"];

export function tourColor(data: Pick<DispatchDataset, "tours">, tourId: string): string {
  const i = data.tours.findIndex((t) => t.id === tourId);
  return ROUTE_COLORS[(i < 0 ? 0 : i) % ROUTE_COLORS.length]!;
}

export function publicationLabel(tour: Tour): string {
  return tour.publishedAt ? `Published ${new Date(tour.publishedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Not published";
}

export interface ParsedLine {
  line: number;
  stop?: NewStopInput;
  error?: string;
}

/**
 * Parse pasted stop lists (one stop per line, separated by ; or tab):
 *   recipient; street; house no.; postcode; city; lat; lng; [type]; [window from-to]; [tracking numbers, comma separated]
 * Coordinates are required until a geocoding provider is connected.
 */
export function parseStopLines(text: string, defaults: { city?: string; countryCode?: string } = {}): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((l) => l.raw && !l.raw.startsWith("#"))
    .map(({ raw, line }) => {
      const c = raw.split(/\t|;/).map((x) => x.trim());
      const [recipient, street, no, postal, city, lat, lng, type, window, tracking] = c;
      const la = Number(String(lat ?? "").replace(",", "."));
      const ln = Number(String(lng ?? "").replace(",", "."));
      if (!street || !postal) return { line, error: "street and postcode are required" };
      if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180 || (la === 0 && ln === 0)) return { line, error: "valid latitude and longitude are required" };
      let tw: { start: number; end: number } | undefined;
      if (window) {
        const [a, b] = window.split("-").map((x) => parseMinuteOfDay(x.trim()));
        if (a == null || b == null || b <= a) return { line, error: `invalid time window "${window}"` };
        tw = { start: a, end: b };
      }
      const t = (type ?? "").toLowerCase();
      return {
        line,
        stop: {
          type: t.startsWith("p") || t.startsWith("abh") ? "pickup" : "delivery",
          recipientName: recipient || undefined,
          address: { street, houseNumber: no || undefined, postalCode: postal, city: city || defaults.city || "", countryCode: defaults.countryCode ?? "DE" },
          location: { lat: la, lng: ln },
          timeWindow: tw,
          trackingNumbers: tracking ? tracking.split(",").map((x) => x.trim()).filter(Boolean) : [],
        },
      };
    });
}

export const windowLabel = (w?: { start: number; end: number }) => (w ? `${formatClock(w.start)}–${formatClock(w.end)}` : "–");
