// TURVIO staging smoke test: optimizer + OSRM on real Hannover streets, round trip vs open end.
const U = process.env.OPTIMIZER_URL;
const start = { lat: 52.3759, lng: 9.732 };
const stops = [[52.3974, 9.7469], [52.3905, 9.757], [52.3851, 9.7521], [52.4012, 9.7398], [52.393, 9.735]].map(([lat, lng], i) => ({ id: "s" + i, location: { lat, lng }, serviceSeconds: 90 }));
const run = async (end) => {
  const r = await fetch(U + "/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicles: [{ id: "v", start, ...(end ? { end } : {}), shiftStart: 480, maxShiftMinutes: 480 }], stops, timeLimitSeconds: 2 }) });
  const j = await r.json();
  return { status: r.status, matrix: j.matrixSource, km: (j.routes?.[0]?.distanceMeters ?? 0) / 1000, stops: j.routes?.[0]?.visits?.length ?? 0, violations: j.violations?.length ?? null };
};
const roundTrip = await run(start);
const openEnd = await run(null);
console.log("round trip", JSON.stringify(roundTrip));
console.log("open end  ", JSON.stringify(openEnd));
const ok = roundTrip.status === 200 && openEnd.status === 200 && roundTrip.matrix === "osrm" && openEnd.matrix === "osrm" && roundTrip.stops === 5 && openEnd.stops === 5 && openEnd.km > 0 && openEnd.km < roundTrip.km;
console.log(ok ? "SMOKE OK" : "SMOKE FAILED");
process.exit(ok ? 0 : 1);
