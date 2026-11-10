import type { GeoPoint } from "./schemas";

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * A device-captured coordinate (GPS fix, map tap/drag) normalised to 7 decimal places (~1 cm).
 * Raw device values carry 13–15 decimals; such a value printed by a server with
 * `extra_float_digits = 0` (15 significant digits) no longer equals the stored one, which breaks
 * exact location-change checks. 7 decimals stay exact in every float output setting.
 */
export function roundCoordinate(v: number): number {
  return Math.round(v * 1e7) / 1e7;
}

/** {@link roundCoordinate} for both axes. */
export function roundPoint<P extends GeoPoint>(p: P): P {
  return { ...p, lat: roundCoordinate(p.lat), lng: roundCoordinate(p.lng) };
}

/** Great-circle distance in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rough road-distance estimate used only when no routing engine is available.
 * Straight-line distance × detour factor; urban average speed. These are
 * estimates, not road-network values, and the UI must label them as such.
 */
export const ESTIMATE_DETOUR_FACTOR = 1.35;
export const ESTIMATE_SPEED_KMH = 30;

export function estimateDrive(a: GeoPoint, b: GeoPoint): { meters: number; seconds: number } {
  const meters = haversineMeters(a, b) * ESTIMATE_DETOUR_FACTOR;
  const seconds = meters / ((ESTIMATE_SPEED_KMH * 1000) / 3600);
  return { meters, seconds };
}

export function boundingRegion(points: GeoPoint[], paddingFactor = 1.3) {
  if (points.length === 0) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * paddingFactor, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * paddingFactor, 0.01),
  };
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type MapItem<T> = { kind: "single"; item: T; point: GeoPoint } | { kind: "cluster"; items: T[]; point: GeoPoint; id: string };

/**
 * Grid clustering + viewport culling for large tours (hundreds of stops): items outside the
 * visible region (plus a margin) are skipped; inside, items sharing a grid cell are merged
 * into one cluster when there are too many to draw individually. `keep` items (current/next
 * stop) are always drawn on their own. O(n), no allocation-heavy spatial index.
 */
export function clusterForRegion<T>(
  items: T[],
  pointOf: (t: T) => GeoPoint | null,
  region: MapRegion,
  opts: { maxMarkers?: number; cellsAcross?: number; keep?: (t: T) => boolean } = {},
): MapItem<T>[] {
  const maxMarkers = opts.maxMarkers ?? 60;
  const margin = 0.25;
  const minLat = region.latitude - region.latitudeDelta * (0.5 + margin);
  const maxLat = region.latitude + region.latitudeDelta * (0.5 + margin);
  const minLng = region.longitude - region.longitudeDelta * (0.5 + margin);
  const maxLng = region.longitude + region.longitudeDelta * (0.5 + margin);
  const visible: { item: T; point: GeoPoint }[] = [];
  const out: MapItem<T>[] = [];
  for (const item of items) {
    const point = pointOf(item);
    if (!point) continue;
    if (opts.keep?.(item)) {
      out.push({ kind: "single", item, point });
      continue;
    }
    if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) continue;
    visible.push({ item, point });
  }
  if (visible.length <= maxMarkers) return [...out, ...visible.map((v) => ({ kind: "single" as const, ...v }))];
  const cells = opts.cellsAcross ?? 8;
  const cw = region.longitudeDelta / cells;
  const ch = region.latitudeDelta / cells;
  const grid = new Map<string, { item: T; point: GeoPoint }[]>();
  for (const v of visible) {
    const key = `${Math.floor(v.point.lng / cw)}:${Math.floor(v.point.lat / ch)}`;
    const cell = grid.get(key);
    if (cell) cell.push(v);
    else grid.set(key, [v]);
  }
  for (const [key, cell] of grid) {
    if (cell.length === 1) out.push({ kind: "single", ...cell[0]! });
    else {
      const lat = cell.reduce((a, c) => a + c.point.lat, 0) / cell.length;
      const lng = cell.reduce((a, c) => a + c.point.lng, 0) / cell.length;
      out.push({ kind: "cluster", id: key, items: cell.map((c) => c.item), point: { lat, lng } });
    }
  }
  return out;
}

/**
 * The point routing drives to for a stop: its accepted approach point when one is valid (only
 * then present on the stop), otherwise its coordinate. Addresses and map pins stay the stop's own.
 */
export function routePoint(s: { location?: GeoPoint | null; approach?: { lat: number; lng: number } | null }): GeoPoint | null {
  if (!s.location) return null;
  return s.approach ? { lat: s.approach.lat, lng: s.approach.lng } : s.location;
}
