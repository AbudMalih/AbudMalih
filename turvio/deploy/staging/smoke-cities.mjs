// TURVIO staging: optimizer + OSRM in five cities (run inside the API container).
// Each city: start + 3 stops on real streets, open end; must route on the road network (no 422/503).
const U = process.env.OPTIMIZER_URL;
const C = {
  Hannover: [[52.3759, 9.732], [52.3170, 9.8045], [52.3974, 9.7469], [52.3851, 9.7521]],
  Kassel: [[51.3127, 9.4797], [51.3155, 9.4419], [51.3180, 9.4980], [51.3080, 9.4600]],
  Bremen: [[53.0793, 8.8017], [53.0545, 8.8622], [53.0750, 8.8070], [53.0880, 8.8250]],
  Cologne: [[50.9413, 6.9583], [50.9201, 6.9831], [50.9375, 6.9603], [50.9500, 6.9400]],
  Suhl: [[50.6106, 10.6936], [50.6155, 10.7105], [50.6080, 10.6950], [50.6200, 10.7000]],
};
let ok = true;
for (const [city, pts] of Object.entries(C)) {
  const [start, ...rest] = pts.map(([lat, lng]) => ({ lat, lng }));
  const t0 = Date.now();
  const r = await fetch(U + "/optimize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vehicles: [{ id: "v", start, shiftStart: 480, maxShiftMinutes: 480 }], stops: rest.map((location, i) => ({ id: `s${i}`, location, serviceSeconds: 60 })), timeLimitSeconds: 1 }),
  });
  const j = await r.json();
  const route = j.routes?.[0];
  const good = r.status === 200 && j.matrixSource === "osrm" && route?.visits?.length === 3 && route.distanceMeters > 500;
  ok &&= good;
  console.log(`${good ? "OK  " : "FAIL"} ${city.padEnd(9)} HTTP ${r.status} ${good ? `${(route.distanceMeters / 1000).toFixed(1)} km, ${Math.round(route.driveSeconds / 60)} min driving, ${Date.now() - t0} ms` : JSON.stringify(j.detail ?? j).slice(0, 160)}`);
}
console.log(ok ? "CITY SMOKE OK" : "CITY SMOKE FAILED");
