import { orderStopsLocally } from "../localHeuristic";
import { estimateDrive } from "../geo";
import type { Depot, Driver, GeoPoint, Stop, Tour, TourStatus, Vehicle } from "../schemas";
import { SYNTHETIC_ORG_ID } from "../synthetic";

/**
 * SYNTHETIC multi-depot dataset for the JARBOU pilot in TURVIO Dispatch.
 *
 * Fictional people, customers, house numbers and "TVO…" tracking numbers;
 * coordinates are random points around real city centres. The data describes
 * one operating day as seen at a fixed synthetic clock (`asOfMinute`), so
 * progress, delays and pickup deadlines are consistent whatever time the page
 * is opened. Nothing here is live data and there are no GPS positions.
 */

export interface UnassignedStop extends Omit<Stop, "tourId" | "sequence"> {
  depotId: string;
}

export interface DispatchDataset {
  organizationId: string;
  /** Operating day (YYYY-MM-DD). */
  date: string;
  /** Synthetic operations clock, minutes since midnight. */
  asOfMinute: number;
  depots: Depot[];
  drivers: Driver[];
  vehicles: Vehicle[];
  tours: Tour[];
  stops: Stop[];
  unassigned: UnassignedStop[];
}

export const DISPATCH_SNAPSHOT_MINUTE = 11 * 60 + 30;

// Deterministic PRNG so the dataset is identical on server and client.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DepotSeed {
  id: string;
  name: string;
  city: string;
  postal: string;
  depot: GeoPoint;
  centre: GeoPoint;
  radiusKm: number;
  plate: string;
}

const DEPOTS: DepotSeed[] = [
  { id: "dep_hannover", name: "Hannover", city: "Hannover", postal: "30179", depot: { lat: 52.4189, lng: 9.7686 }, centre: { lat: 52.3759, lng: 9.732 }, radiusKm: 5.5, plate: "H-JL" },
  { id: "dep_bremen", name: "Bremen", city: "Bremen", postal: "28197", depot: { lat: 53.0921, lng: 8.7268 }, centre: { lat: 53.0793, lng: 8.8017 }, radiusKm: 5, plate: "HB-JL" },
  { id: "dep_kassel", name: "Kassel", city: "Kassel", postal: "34123", depot: { lat: 51.2954, lng: 9.5186 }, centre: { lat: 51.3127, lng: 9.4797 }, radiusKm: 4.5, plate: "KS-JL" },
  { id: "dep_haiger", name: "Haiger", city: "Haiger", postal: "35708", depot: { lat: 50.7517, lng: 8.1932 }, centre: { lat: 50.7427, lng: 8.2079 }, radiusKm: 6, plate: "LDK-JL" },
];

const DRIVER_NAMES = [
  "Lena Hoffmann", "Mihai Popescu", "Samir Haddad", "Jonas Becker", "Aylin Demir", "Tobias Krüger", "Andrei Ionescu", "Nadia Benali",
  "Felix Wagner", "Olena Kovalenko", "Marco Rossi", "Sara Lindqvist", "Yusuf Aydın", "Katharina Braun", "Daniel Mayer", "Ioana Stan",
];

const RECIPIENTS = [
  "M. Schulz", "A. Fischer", "K. Weber", "S. Meyer", "J. Wolf", "L. Neumann", "P. Schwarz", "E. Zimmermann", "R. Hartmann", "T. Lange",
  "N. Krause", "D. Werner", "H. Lehmann", "C. Köhler", "B. Herrmann", "F. König", "G. Walter", "I. Peters", "V. Möller", "Z. Arslan",
];
const BUSINESSES = [
  "Autohaus Lindner", "Praxis Dr. Lang", "Druckerei Nordlicht", "Elektro Brandt", "Optik Sonnenschein", "Kanzlei Vogt & Partner",
  "Feinkost Albers", "Sanitätshaus Reuter", "Möbel Kranz", "Apotheke am Markt", "Fahrradwerk Hesse", "Labor Medica",
];
const STREETS = [
  "Bahnhofstraße", "Lindenallee", "Gartenweg", "Schulstraße", "Am Markt", "Mühlenweg", "Bergstraße", "Kirchplatz", "Rosenstraße",
  "Industriestraße", "Am Stadtpark", "Friedrichstraße", "Wiesenweg", "Hafenstraße", "Ahornweg", "Ringstraße",
];

interface TourPlan {
  code: string;
  depot: string;
  driver: number | null;
  vehicle: number | null;
  status: TourStatus;
  start: number;
  /** Actual start delay in minutes for started tours. */
  startDelay: number;
  stops: number;
  pickups: number;
  /** Extra service time factor (simulates a slow tour). */
  slow?: number;
}

// Per depot: 4 drivers, 5 vehicles (index within depot).
const TOURS: TourPlan[] = [
  { code: "HAN-01", depot: "dep_hannover", driver: 0, vehicle: 0, status: "in_progress", start: 450, startDelay: 5, stops: 36, pickups: 2 },
  { code: "HAN-02", depot: "dep_hannover", driver: 1, vehicle: 1, status: "in_progress", start: 450, startDelay: 50, stops: 34, pickups: 2, slow: 1.45 },
  { code: "HAN-03", depot: "dep_hannover", driver: 2, vehicle: 2, status: "planned", start: 750, startDelay: 0, stops: 14, pickups: 3 },
  { code: "BRE-01", depot: "dep_bremen", driver: 0, vehicle: 0, status: "in_progress", start: 465, startDelay: 0, stops: 32, pickups: 1 },
  { code: "BRE-02", depot: "dep_bremen", driver: 1, vehicle: 1, status: "completed", start: 420, startDelay: 0, stops: 18, pickups: 0 },
  { code: "BRE-03", depot: "dep_bremen", driver: 2, vehicle: 2, status: "paused", start: 480, startDelay: 10, stops: 30, pickups: 2 },
  { code: "KAS-01", depot: "dep_kassel", driver: 0, vehicle: 0, status: "in_progress", start: 450, startDelay: 0, stops: 34, pickups: 2 },
  { code: "KAS-02", depot: "dep_kassel", driver: null, vehicle: null, status: "planned", start: 780, startDelay: 0, stops: 12, pickups: 2 },
  { code: "HAI-01", depot: "dep_haiger", driver: 0, vehicle: 0, status: "in_progress", start: 480, startDelay: 20, stops: 28, pickups: 2, slow: 1.3 },
  { code: "HAI-02", depot: "dep_haiger", driver: 1, vehicle: 1, status: "planned", start: 720, startDelay: 0, stops: 12, pickups: 1 },
];

function pointNear(rand: () => number, centre: GeoPoint, radiusKm: number): GeoPoint {
  const r = radiusKm * Math.sqrt(rand());
  const theta = rand() * 2 * Math.PI;
  const dLat = (r / 111.32) * Math.cos(theta);
  const dLng = (r / (111.32 * Math.cos((centre.lat * Math.PI) / 180))) * Math.sin(theta);
  return { lat: +(centre.lat + dLat).toFixed(5), lng: +(centre.lng + dLng).toFixed(5) };
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function isoAt(date: string, minute: number): string {
  // Times are modelled in local operating time; stored as UTC-less ISO for display only.
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(Math.floor(minute % 60)).padStart(2, "0");
  return `${date}T${h}:${m}:00.000Z`;
}

export function createDispatchDataset(now: Date = new Date()): DispatchDataset {
  const rand = mulberry32(20261105);
  const date = now.toISOString().slice(0, 10);
  const asOf = DISPATCH_SNAPSHOT_MINUTE;
  const org = SYNTHETIC_ORG_ID;

  const depots: Depot[] = DEPOTS.map((d) => ({
    id: d.id,
    organizationId: org,
    name: d.name,
    address: { street: "Logistikring", houseNumber: String(10 + Math.floor(rand() * 80)), postalCode: d.postal, city: d.city, countryCode: "DE" },
    location: d.depot,
  }));

  const drivers: Driver[] = [];
  const vehicles: Vehicle[] = [];
  DEPOTS.forEach((d, di) => {
    for (let i = 0; i < 4; i++) {
      drivers.push({
        id: `drv_${d.id.slice(4, 7)}_${i + 1}`,
        organizationId: org,
        displayName: DRIVER_NAMES[di * 4 + i]!,
        depotId: d.id,
        maxShiftMinutes: i === 3 ? 360 : 480,
        active: !(di === 3 && i === 3),
      });
    }
    for (let i = 0; i < 5; i++) {
      const electric = i === 4;
      vehicles.push({
        id: `veh_${d.id.slice(4, 7)}_${i + 1}`,
        organizationId: org,
        label: electric ? `eVan ${i + 1}` : `Sprinter ${i + 1}`,
        licensePlate: `${d.plate} ${electric ? `${400 + di * 10 + i}E` : 100 + di * 10 + i}`,
        depotId: d.id,
        capacityParcels: electric ? 110 : 180,
      });
    }
  });

  const driverOf = (depot: string, i: number | null) => (i === null ? null : drivers.filter((x) => x.depotId === depot)[i]!.id);
  const vehicleOf = (depot: string, i: number | null) => (i === null ? null : vehicles.filter((x) => x.depotId === depot)[i]!.id);

  const tours: Tour[] = [];
  const stops: Stop[] = [];
  let tn = 4_200_000;

  const makeStop = (tourId: string, d: DepotSeed, type: "delivery" | "pickup", idx: number): Stop => {
    const business = type === "pickup" || rand() < 0.25;
    const name = business ? pick(rand, BUSINESSES) : pick(rand, RECIPIENTS);
    const parcels = type === "pickup" ? 1 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 3);
    // Windows are placeholders here; planned tours get them from their planned timeline.
    let timeWindow: Stop["timeWindow"];
    if (type === "pickup") {
      const startH = 13 + Math.floor(rand() * 3);
      timeWindow = { start: startH * 60, end: startH * 60 + (rand() < 0.5 ? 90 : 120) };
    } else if (rand() < 0.15) {
      timeWindow = { start: 0, end: 1 };
    }
    return {
      id: `${tourId}_${type === "pickup" ? "p" : "d"}${String(idx).padStart(2, "0")}`,
      organizationId: org,
      tourId,
      type,
      sequence: 0,
      recipientName: name,
      address: { street: pick(rand, STREETS), houseNumber: String(1 + Math.floor(rand() * 120)), postalCode: d.postal, city: d.city, countryCode: "DE" },
      location: pointNear(rand, d.centre, d.radiusKm),
      timeWindow,
      serviceSeconds: type === "pickup" ? 360 : 210 + parcels * 60,
      priority: type === "pickup" ? rand() < 0.4 : rand() < 0.08,
      notes: type === "pickup" ? "Express-Abholung (synthetisch)" : undefined,
      parcels: Array.from({ length: parcels }, (_, p) => ({
        id: `${tourId}_${idx}_${p}`,
        trackingNumber: `TVO${(tn += 7)}DE`,
        recipientName: name,
      })),
      status: "pending",
    };
  };

  for (const plan of TOURS) {
    const d = DEPOTS.find((x) => x.id === plan.depot)!;
    const tourId = `tour_${plan.code.toLowerCase().replace("-", "_")}`;
    const tour: Tour = {
      id: tourId,
      organizationId: org,
      name: plan.code,
      date,
      depotId: d.id,
      driverId: driverOf(d.id, plan.driver),
      vehicleId: vehicleOf(d.id, plan.vehicle),
      status: plan.status,
      plannedStartMinute: plan.start,
    };
    let list: Stop[] = [];
    for (let i = 0; i < plan.stops - plan.pickups; i++) list.push(makeStop(tourId, d, "delivery", i + 1));
    for (let i = 0; i < plan.pickups; i++) list.push(makeStop(tourId, d, "pickup", i + 1));
    // Plan like a dispatcher: deliveries in heuristic order from the depot,
    // express pickups afterwards in window order.
    const deliveries = orderStopsLocally(list.filter((s) => s.type === "delivery"), d.depot).stops;
    const pickups = list.filter((s) => s.type === "pickup");
    list = [...deliveries, ...pickups].map((s, i) => ({ ...s, sequence: i }));

    // Time windows follow the planned timeline (what the customer was promised).
    {
      let t = plan.start;
      let prev = d.depot;
      for (const s of list) {
        t += estimateDrive(prev, s.location!).seconds / 60;
        if (s.type === "pickup" || s.timeWindow) {
          const start = Math.max(plan.start, Math.floor((t - (s.type === "pickup" ? 30 : 60)) / 30) * 30);
          s.timeWindow = { start, end: start + (s.type === "pickup" ? 120 : 180) };
          if (t < s.timeWindow.start) t = s.timeWindow.start;
        }
        t += s.serviceSeconds / 60;
        prev = s.location!;
      }
    }

    // Simulate the day up to the synthetic clock.
    if (plan.status !== "planned") {
      const actualStart = plan.start + plan.startDelay;
      tour.startedAt = isoAt(date, actualStart);
      let t = actualStart;
      let prev = d.depot;
      const limit = plan.status === "completed" ? Infinity : asOf - (plan.status === "paused" ? 25 : 0);
      for (const s of list) {
        const drive = estimateDrive(prev, s.location!).seconds / 60;
        let arrive = t + drive;
        if (s.timeWindow && arrive < s.timeWindow.start) arrive = s.timeWindow.start;
        const done = arrive + (s.serviceSeconds / 60) * (plan.slow ?? 1);
        if (done > limit) break;
        const failed = s.type === "delivery" && rand() < 0.07;
        s.status = s.type === "pickup" ? "picked_up" : failed ? "failed" : "delivered";
        s.completedAt = isoAt(date, done);
        t = done;
        prev = s.location!;
      }
      if (plan.status === "completed") tour.finishedAt = isoAt(date, t + estimateDrive(prev, d.depot).seconds / 60);
    }
    tours.push(tour);
    stops.push(...list);
  }

  // Unassigned stops waiting for planning (incl. late-registered express pickups).
  const unassigned: UnassignedStop[] = [];
  const counts: Record<string, [number, number]> = { dep_hannover: [4, 2], dep_bremen: [2, 1], dep_kassel: [3, 1], dep_haiger: [1, 1] };
  for (const d of DEPOTS) {
    const [del, pick_] = counts[d.id]!;
    for (let i = 0; i < del + pick_; i++) {
      const s = makeStop(`un_${d.id.slice(4, 7)}`, d, i < del ? "delivery" : "pickup", i + 1);
      if (s.timeWindow && s.type === "delivery") s.timeWindow = { start: 840, end: 1020 };
      const { tourId: _t, sequence: _s, ...rest } = s;
      unassigned.push({ ...rest, depotId: d.id });
    }
  }

  return { organizationId: org, date, asOfMinute: asOf, depots, drivers, vehicles, tours, stops, unassigned };
}
