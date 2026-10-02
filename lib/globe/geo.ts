import * as THREE from "three";

const DEG = Math.PI / 180;

/**
 * lon/lat → unit-sphere position, matching THREE.SphereGeometry's UV layout
 * with an equirectangular texture (u = 0 at −180°).
 */
export function lonLatToVec3(lon: number, lat: number, r = 1, out = new THREE.Vector3()) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return out.set(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

export function vec3ToLonLat(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) / DEG;
  let phi = Math.atan2(n.z, -n.x);
  if (phi < 0) phi += Math.PI * 2;
  const lon = (phi / (Math.PI * 2)) * 360 - 180;
  return { lon, lat };
}

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

/** Densify waypoints along great circles. Returns positions + per-point lon/lat. */
export function buildRoute(radius: number, stepDeg = 0.6) {
  const pts: THREE.Vector3[] = [];
  const ll: { lon: number; lat: number }[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < ROUTE_WAYPOINTS.length - 1; i++) {
    lonLatToVec3(ROUTE_WAYPOINTS[i][0], ROUTE_WAYPOINTS[i][1], 1, a);
    lonLatToVec3(ROUTE_WAYPOINTS[i + 1][0], ROUTE_WAYPOINTS[i + 1][1], 1, b);
    const ang = a.angleTo(b);
    const steps = Math.max(2, Math.ceil(ang / (stepDeg * DEG)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const p = slerp(a, b, ang, t);
      ll.push(vec3ToLonLat(p));
      pts.push(p.multiplyScalar(radius));
    }
  }
  const last = lonLatToVec3(...ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1], 1);
  ll.push(vec3ToLonLat(last));
  pts.push(last.multiplyScalar(radius));

  // cumulative arc length → uniform-speed progress
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  return { pts, ll, cum: cum.map((c) => c / total) };
}

function slerp(a: THREE.Vector3, b: THREE.Vector3, ang: number, t: number) {
  if (ang < 1e-6) return a.clone();
  const s = Math.sin(ang);
  const wa = Math.sin((1 - t) * ang) / s;
  const wb = Math.sin(t * ang) / s;
  return new THREE.Vector3().addScaledVector(a, wa).addScaledVector(b, wb);
}

export function formatLat(lat: number) {
  return `${Math.abs(lat).toFixed(2).padStart(5, "0")}° ${lat >= 0 ? "N" : "S"}`;
}
export function formatLon(lon: number) {
  return `${Math.abs(lon).toFixed(2).padStart(6, "0")}° ${lon >= 0 ? "E" : "W"}`;
}
