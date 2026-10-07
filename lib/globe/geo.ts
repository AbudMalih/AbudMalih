import * as THREE from "three";
import { ROUTE_WAYPOINTS } from "./coords";

export { ROUTE_WAYPOINTS, formatLat, formatLon } from "./coords";

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
