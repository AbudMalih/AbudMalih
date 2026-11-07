// Real road-based optimization through the full production path:
// TURVIO API -> optimizer service (VROOM + OR-Tools) -> OSRM (Region Hannover).
//
//   node e2e/hannover-optimize.mjs [stops=90] [seed=1]
//
// Needs a running API (TURVIO_API, default http://localhost:4000) with OSRM configured, the seeded
// dispatcher account, and the OSM address CSV (TURVIO_ADDRESSES). Stops are real public OSM
// addresses (© OpenStreetMap contributors, ODbL) with fictional recipients. Prints a JSON report.
import { readFileSync } from "node:fs";

const API = process.env.TURVIO_API ?? "http://localhost:4000";
const N = Number(process.argv[2] ?? 90);
const SEED = Number(process.argv[3] ?? 1);
const CSV = process.env.TURVIO_ADDRESSES ?? "/opt/turvio-osm/hannover-addresses.csv";
const AREA = ["30161", "30163", "30165", "30177", "30655", "30657"];

let s = SEED;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

const rows = readFileSync(CSV, "utf8").trim().split("\n").slice(1).map((l) => l.split(";")).filter((r) => AREA.includes(r[2]));
const pick = new Map();
while (pick.size < N) {
  const r = rows[Math.floor(rnd() * rows.length)];
  pick.set(`${r[0]} ${r[1]}`, r);
}
const stops = [...pick.values()].map(([street, house, postcode, city, lat, lng], i) => {
  const parcels = 1 + (rnd() < 0.15 ? 1 : 0) + (rnd() < 0.05 ? 1 : 0);
  const express = rnd() < 0.1;
  return {
    recipientName: `Empfänger ${i + 1}`,
    address: { street, houseNumber: house, postalCode: postcode, city },
    location: { lat: Number(lat), lng: Number(lng) },
    serviceSeconds: 90 + 30 * (parcels - 1),
    priority: express,
    ...(express ? { timeWindow: { start: 480, end: rnd() < 0.5 ? 630 : 720 } } : {}),
    trackingNumbers: Array.from({ length: parcels }, (_, k) => `TVOHN${SEED}${String(i).padStart(3, "0")}${k}`),
  };
});

const login = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dispatch.hannover@jarbou.test", password: process.env.SEED_PASSWORD ?? "Turvio-Demo-2026" }) });
const token = (await login.json()).accessToken;
const call = async (method, path, body) => {
  const r = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const me = await call("GET", "/v1/me");
const org = me.memberships?.[0]?.organizationId ?? me.organizations?.[0]?.id;
const depots = await call("GET", `/v1/orgs/${org}/depots`);
const depot = depots.find((d) => /hannover/i.test(d.name)) ?? depots[0];
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000 * (SEED + 1)));
const tour = await call("POST", `/v1/orgs/${org}/tours`, { depotId: depot.id, date, name: `E2E Hannover ${N} #${SEED}` });
await call("POST", `/v1/orgs/${org}/stops`, { tourId: tour.id, stops });

const route = async () => call("GET", `/v1/orgs/${org}/tours/${tour.id}/route`);
const before = await route();
const t0 = Date.now();
const opt = await call("POST", `/v1/orgs/${org}/tours/${tour.id}/optimize`, {});
const ms = Date.now() - t0;
const after = await route();
const late = (opt.result.violations ?? []).filter((v) => v.kind === "late").length;
console.log(
  JSON.stringify(
    {
      stops: N,
      seed: SEED,
      depot: depot.name,
      routing: after.source,
      imported: { km: +(before.metrics.totalMeters / 1000).toFixed(1), driveMin: +(before.metrics.totalDriveSeconds / 60).toFixed(1) },
      optimized: { km: +(after.metrics.totalMeters / 1000).toFixed(1), driveMin: +(after.metrics.totalDriveSeconds / 60).toFixed(1) },
      improvementPercent: +((1 - after.metrics.totalDriveSeconds / before.metrics.totalDriveSeconds) * 100).toFixed(1),
      apiRoundTripSeconds: +(ms / 1000).toFixed(1),
      solverSeconds: opt.result.solveSeconds,
      engine: opt.result.engine,
      matrix: opt.result.matrixSource,
      lateStops: late,
      unassigned: opt.result.unassignedStopIds.length,
      violations: opt.result.violations,
      finish: opt.result.endMinute != null ? `${String(Math.floor(opt.result.endMinute / 60)).padStart(2, "0")}:${String(Math.round(opt.result.endMinute % 60)).padStart(2, "0")}` : null,
    },
    null,
    1,
  ),
);
