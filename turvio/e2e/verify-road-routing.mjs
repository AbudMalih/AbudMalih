// Verifies that tours use REAL road routing (OSRM): optimization succeeds on road data,
// total kilometres and driving time are road values, ETAs include travel time, and the map
// geometry follows roads. Also checks that locations outside the routing data are reported
// as an error instead of a "successful" 0 km plan.
//
// Existing tour (staging; read + optional re-optimization of that tour only):
//   API_URL=https://api.<staging> EMAIL=… PASSWORD=… TOUR=HER-01 [DATE=YYYY-MM-DD] [OPTIMIZE=true] node e2e/verify-road-routing.mjs
// Synthetic tour (local/dev; creates a depot + tour + 5 stops with fictional recipients):
//   API_URL=http://localhost:4000 EMAIL=… PASSWORD=… CREATE=suhl|hannover EXPECT=road|out_of_coverage node e2e/verify-road-routing.mjs
// Passwords come from the environment only; nothing is printed except results.
import assert from "node:assert/strict";

const API = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const EXPECT = process.env.EXPECT ?? "road";
const OPTIMIZE = (process.env.OPTIMIZE ?? "true") === "true";
const SUHL_DEPOT = { lat: 50.6106, lng: 10.6936 };
const SUHL_STOPS = [
  { street: "Friedrich-König-Straße", houseNumber: "7", postalCode: "98527", city: "Suhl", location: { lat: 50.6085, lng: 10.6929 } },
  { street: "Steinweg", houseNumber: "20", postalCode: "98527", city: "Suhl", location: { lat: 50.6116, lng: 10.6965 } },
  { street: "Auenstraße", houseNumber: "36", postalCode: "98529", city: "Suhl", location: { lat: 50.6265, lng: 10.7208 } },
  { street: "Würzburger Straße", houseNumber: "21", postalCode: "98529", city: "Suhl", location: { lat: 50.6039, lng: 10.7173 } },
  { street: "Hoher Rain", houseNumber: "5", postalCode: "98527", city: "Suhl", location: { lat: 50.5953, lng: 10.6865 } },
];
const HANNOVER_DEPOT = { lat: 52.3759, lng: 9.7320 };
const HANNOVER_STOPS = [
  { street: "Lister Meile", houseNumber: "42", postalCode: "30161", city: "Hannover", location: { lat: 52.3826, lng: 9.7462 } },
  { street: "Podbielskistraße", houseNumber: "11", postalCode: "30163", city: "Hannover", location: { lat: 52.3897, lng: 9.7552 } },
  { street: "Hildesheimer Straße", houseNumber: "20", postalCode: "30169", city: "Hannover", location: { lat: 52.3657, lng: 9.7449 } },
  { street: "Limmerstraße", houseNumber: "10", postalCode: "30451", city: "Hannover", location: { lat: 52.3747, lng: 9.7105 } },
  { street: "Göttinger Chaussee", houseNumber: "100", postalCode: "30459", city: "Hannover", location: { lat: 52.3421, lng: 9.7243 } },
];
const SITES = { suhl: { depot: SUHL_DEPOT, stops: SUHL_STOPS, address: { street: "Bahnhofstraße", houseNumber: "1", postalCode: "98527", city: "Suhl" } }, hannover: { depot: HANNOVER_DEPOT, stops: HANNOVER_STOPS, address: { street: "Ernst-August-Platz", houseNumber: "1", postalCode: "30159", city: "Hannover" } } };
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` – ${detail}` : ""}`);
};

const login = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.EMAIL, password: process.env.PASSWORD }) });
assert.equal(login.status, 200, "login failed (an account with two-step verification cannot be used here – use a dispatcher account)");
const { accessToken } = await login.json();
assert.ok(accessToken, "login needs a second factor – use a dispatcher account");
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${accessToken}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const me = (await call("GET", "/v1/me")).body;
const membership = me.memberships.find((m) => !process.env.ORG_NAME || m.organizationName === process.env.ORG_NAME) ?? me.memberships[0];
const org = membership.organizationId;
const date = process.env.DATE ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

let tourId;
if (process.env.CREATE) {
  const site = SITES[process.env.CREATE];
  assert.ok(site, "CREATE must be suhl or hannover");
  const depot = await call("POST", `/v1/orgs/${org}/depots`, { name: `${process.env.CREATE} routing test ${Date.now()}`, ...site.address, ...site.depot });
  assert.equal(depot.status, 201, JSON.stringify(depot.body));
  const tour = await call("POST", `/v1/orgs/${org}/tours`, { depotId: depot.body.id, date, plannedStartMinute: 480 });
  assert.equal(tour.status, 201, JSON.stringify(tour.body));
  tourId = tour.body.id;
  const stops = site.stops.map((s, i) => ({ type: "delivery", recipientName: `Routing-Test ${i + 1} (synthetic)`, address: { street: s.street, houseNumber: s.houseNumber, postalCode: s.postalCode, city: s.city }, location: s.location }));
  const added = await call("POST", `/v1/orgs/${org}/stops`, { tourId, stops });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  console.log(`created synthetic ${process.env.CREATE} tour ${tour.body.name} (${tourId}) with 5 stops`);
} else {
  assert.ok(process.env.TOUR, "set TOUR=<name> or CREATE=suhl|hannover");
  const ds = (await call("GET", `/v1/orgs/${org}/dispatch?date=${date}`)).body;
  const t = ds.tours.find((x) => x.name === process.env.TOUR);
  assert.ok(t, `tour ${process.env.TOUR} not found on ${date} (set DATE=YYYY-MM-DD)`);
  tourId = t.id;
}

if (OPTIMIZE) {
  const opt = await call("POST", `/v1/orgs/${org}/tours/${tourId}/optimize`, {});
  if (EXPECT === "out_of_coverage") {
    check("optimization refused outside the routing data (no silent success)", opt.status === 422 && opt.body?.error?.code === "routing_out_of_coverage", `HTTP ${opt.status} ${opt.body?.error?.code ?? ""}`);
    check("error names the affected stops", (opt.body?.error?.points ?? []).filter((p) => p.kind === "stop").length >= 1, `${(opt.body?.error?.points ?? []).length} point(s)`);
  } else {
    check("optimization succeeded on road data", opt.status === 200 && opt.body?.result?.matrixSource === "osrm", `HTTP ${opt.status} matrix=${opt.body?.result?.matrixSource ?? opt.body?.error?.code}`);
  }
}

const route = (await call("GET", `/v1/orgs/${org}/tours/${tourId}/route`)).body;
if (EXPECT === "out_of_coverage") {
  check("map route reports the coverage problem", route.source === "none" && route.routingError?.code === "routing_out_of_coverage", route.note ?? "");
} else {
  const m = route.metrics ?? {};
  const pts = route.geometry?.length ?? 0;
  const wps = route.waypointStopIds?.length ?? 0;
  check("route source is OSRM", route.source === "osrm", route.note ?? "");
  check("total road distance > 1 km", (m.totalMeters ?? 0) > 1000, `${((m.totalMeters ?? 0) / 1000).toFixed(1)} km`);
  check("total driving time > 3 min", (m.totalDriveSeconds ?? 0) > 180, `${Math.round((m.totalDriveSeconds ?? 0) / 60)} min`);
  check("every leg has road distance", (route.legs ?? []).every((l) => l.meters > 0), (route.legs ?? []).map((l) => `${(l.meters / 1000).toFixed(1)}`).join(" / ") + " km");
  check("geometry follows roads (many more points than stops)", pts > wps * 3, `${pts} geometry points for ${wps} waypoints`);
  const etas = Object.values(m.etas ?? {}).sort((a, b) => a - b);
  const gaps = etas.slice(1).map((v, i) => v - etas[i]);
  check("ETAs include travel time (not only service time)", gaps.some((g) => g > 3), `gaps ${gaps.join(", ")} min`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
