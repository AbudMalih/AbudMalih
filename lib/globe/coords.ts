/* Three.js-free geographic data and formatting, safe to import anywhere
   (header, footer, hero). The 3D maths stays in geo.ts, which is only
   loaded with the globe's async chunk. */

/**
 * Indicative maritime route Asia → Europe (open-sea waypoints, then Rhine
 * corridor to Cologne). Purely geographic — no claim about specific ports or
 * shipping lanes used by the company.
 */
export const ROUTE_WAYPOINTS: [number, number][] = [
  [121.9, 30.9],
  [122.6, 27.5],
  [119.6, 23.6],
  [114.6, 19.6],
  [110.2, 11.0],
  [105.8, 3.2],
  [103.6, 1.2],
  [100.0, 3.6],
  [95.6, 6.0],
  [80.6, 5.4],
  [66.0, 11.5],
  [52.0, 12.8],
  [43.4, 12.6],
  [40.0, 17.0],
  [36.2, 23.4],
  [33.6, 27.6],
  [32.5, 30.2],
  [32.3, 31.5],
  [27.0, 33.6],
  [18.0, 35.4],
  [11.6, 37.4],
  [5.0, 37.6],
  [-2.0, 36.1],
  [-5.6, 35.9],
  [-9.6, 37.2],
  [-10.0, 42.8],
  [-6.6, 47.6],
  [-3.4, 49.4],
  [1.4, 50.6],
  [3.6, 51.9],
  [4.6, 51.85],
  [5.8, 51.85],
  [6.6, 51.45],
  [6.9603, 50.9375],
];

export function formatLat(lat: number) {
  return `${Math.abs(lat).toFixed(2).padStart(5, "0")}° ${lat >= 0 ? "N" : "S"}`;
}
export function formatLon(lon: number) {
  return `${Math.abs(lon).toFixed(2).padStart(6, "0")}° ${lon >= 0 ? "E" : "W"}`;
}
