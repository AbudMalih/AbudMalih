import type { GeoPoint } from "./schemas";

const EARTH_RADIUS_M = 6_371_008.8;

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
