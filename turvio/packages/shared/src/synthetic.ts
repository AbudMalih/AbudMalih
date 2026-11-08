import type { Subscription } from "./billing";
import type { Depot, Driver, Membership, Organization, Stop, Tour, Vehicle } from "./schemas";

/**
 * SYNTHETIC development data. Recipient names are fictional, street names are
 * public Erfurt street names with invented house numbers and approximate
 * coordinates, and tracking numbers use a made-up "TVO" format that does not
 * correspond to any carrier. Never replace this with real customer data.
 */

/** First pilot tenant (synthetic stand-in; no real company data). */
export const SYNTHETIC_ORG_ID = "org_jarbou";
/** A second synthetic tenant used to exercise tenant isolation. */
export const SYNTHETIC_OTHER_ORG_ID = "org_muster";

export const SYNTHETIC_ORGANIZATIONS: Organization[] = [
  { id: SYNTHETIC_ORG_ID, name: "JARBOU Logistik GmbH", slug: "jarbou", countryCode: "DE", status: "active", defaultLocale: "de", locationRetentionDays: 30, proofRetentionDays: 90 },
  { id: SYNTHETIC_OTHER_ORG_ID, name: "Muster Kurier GmbH", slug: "muster-kurier", countryCode: "DE", status: "trialing", defaultLocale: "de", locationRetentionDays: 14, proofRetentionDays: 60 },
];

export const SYNTHETIC_MEMBERSHIPS: Membership[] = [
  { organizationId: SYNTHETIC_ORG_ID, userId: "usr_owner_jarbou", role: "owner", active: true },
  // Synthetic dispatcher for all JARBOU locations (explicit grant – location access is fail-closed).
  { organizationId: SYNTHETIC_ORG_ID, userId: "usr_dispatch_jarbou", role: "dispatcher", active: true, allLocations: true },
  { organizationId: SYNTHETIC_ORG_ID, userId: "usr_drv_01", role: "driver", active: true },
  { organizationId: SYNTHETIC_OTHER_ORG_ID, userId: "usr_owner_muster", role: "owner", active: true },
];

/** Synthetic subscriptions: pilot tenant on an active plan, second tenant in trial. */
export function syntheticSubscriptions(now: Date = new Date()): Subscription[] {
  const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString();
  const in10 = new Date(now.getTime() + 10 * 86400_000).toISOString();
  return [
    { organizationId: SYNTHETIC_ORG_ID, planCode: "business", status: "active", interval: "month", seats: 5, trialEndsAt: null, currentPeriodEnd: in30, cancelAtPeriodEnd: false, limitOverrides: {} },
    { organizationId: SYNTHETIC_OTHER_ORG_ID, planCode: "team", status: "trialing", interval: "month", seats: 2, trialEndsAt: in10, currentPeriodEnd: in10, cancelAtPeriodEnd: false, limitOverrides: {} },
  ];
}

export const SYNTHETIC_DEPOTS: Depot[] = [
  {
    id: "dep_erfurt",
    organizationId: SYNTHETIC_ORG_ID,
    name: "Depot Erfurt Nord",
    address: { street: "Am Synthetikpark", houseNumber: "1", postalCode: "99087", city: "Erfurt", countryCode: "DE" },
    location: { lat: 51.0095, lng: 11.0405 },
  },
  {
    id: "dep_weimar",
    organizationId: SYNTHETIC_ORG_ID,
    name: "Depot Weimar",
    address: { street: "Musterweg", houseNumber: "5", postalCode: "99427", city: "Weimar", countryCode: "DE" },
    location: { lat: 50.9935, lng: 11.3205 },
  },
];

export const SYNTHETIC_DRIVERS: Driver[] = [
  { organizationId: SYNTHETIC_ORG_ID, id: "drv_01", displayName: "Lena Hoffmann", depotId: "dep_erfurt", maxShiftMinutes: 480, active: true },
  { organizationId: SYNTHETIC_ORG_ID, id: "drv_02", displayName: "Mihai Popescu", depotId: "dep_erfurt", maxShiftMinutes: 480, active: true },
  { organizationId: SYNTHETIC_ORG_ID, id: "drv_03", displayName: "Samir Haddad", depotId: "dep_erfurt", maxShiftMinutes: 540, active: true },
  { organizationId: SYNTHETIC_ORG_ID, id: "drv_04", displayName: "Jonas Becker", depotId: "dep_weimar", maxShiftMinutes: 480, active: false },
];

export const SYNTHETIC_VEHICLES: Vehicle[] = [
  { organizationId: SYNTHETIC_ORG_ID, id: "veh_01", label: "Sprinter 1", licensePlate: "EF-TV 101", depotId: "dep_erfurt", capacityParcels: 180 },
  { organizationId: SYNTHETIC_ORG_ID, id: "veh_02", label: "Sprinter 2", licensePlate: "EF-TV 102", depotId: "dep_erfurt", capacityParcels: 180 },
  { organizationId: SYNTHETIC_ORG_ID, id: "veh_03", label: "eVito 1", licensePlate: "EF-TV 201E", depotId: "dep_erfurt", capacityParcels: 90 },
  { organizationId: SYNTHETIC_ORG_ID, id: "veh_04", label: "Crafter 1", licensePlate: "WE-TV 301", depotId: "dep_weimar", capacityParcels: 200 },
];

type SeedStop = [
  recipient: string,
  street: string,
  houseNumber: string,
  postalCode: string,
  lat: number,
  lng: number,
  parcels: number,
  extra?: Partial<Pick<Stop, "priority" | "timeWindow" | "type" | "notes">>,
];

const ERFURT_STOPS: SeedStop[] = [
  ["Anna Krüger", "Anger", "12", "99084", 50.9762, 11.0329, 1],
  ["Thomas Wagner", "Krämpferstraße", "27", "99084", 50.9790, 11.0395, 2, { priority: true }],
  ["Elif Yılmaz", "Johannesstraße", "88", "99084", 50.9805, 11.0352, 1],
  ["Praxis Dr. Sommer", "Löberstraße", "14", "99096", 50.9701, 11.0315, 3, { timeWindow: { start: 540, end: 720 }, notes: "Anmeldung, 2. OG" }],
  ["Maria Ionescu", "Magdeburger Allee", "103", "99086", 50.9925, 11.0402, 1],
  ["Klaus Richter", "Nordhäuser Straße", "45", "99089", 50.9918, 11.0151, 1],
  ["Café Morgenrot", "Michaelisstraße", "9", "99084", 50.9791, 11.0268, 2, { timeWindow: { start: 480, end: 600 } }],
  ["Fatima Al-Masri", "Leipziger Straße", "61", "99085", 50.9822, 11.0498, 1],
  ["Peter Schmitt", "Gothaer Straße", "33", "99094", 50.9712, 10.9952, 1],
  ["Buchhandlung Seitenweise", "Schlösserstraße", "20", "99084", 50.9768, 11.0283, 4, { priority: true }],
  ["Sabine Neumann", "Arnstädter Straße", "71", "99096", 50.9608, 11.0262, 1],
  ["Andrei Munteanu", "Juri-Gagarin-Ring", "118", "99084", 50.9745, 11.0402, 2],
  ["Rücksendung Elektro Mayer", "Stauffenbergallee", "6", "99085", 50.9862, 11.0455, 2, { type: "pickup", timeWindow: { start: 780, end: 960 } }],
  ["Ines Vogel", "Schillerstraße", "40", "99096", 50.9672, 11.0368, 1],
];

function seedToStop(tourId: string, seed: SeedStop, index: number): Stop {
  const [recipientName, street, houseNumber, postalCode, lat, lng, parcelCount, extra] = seed;
  return {
    id: `${tourId}_s${String(index + 1).padStart(2, "0")}`,
    organizationId: SYNTHETIC_ORG_ID,
    tourId,
    type: extra?.type ?? "delivery",
    sequence: index,
    recipientName,
    address: { street, houseNumber, postalCode, city: "Erfurt", countryCode: "DE" },
    location: { lat, lng },
    timeWindow: extra?.timeWindow,
    serviceSeconds: 90 + parcelCount * 30,
    priority: extra?.priority ?? false,
    notes: extra?.notes,
    parcels: Array.from({ length: parcelCount }, (_, p) => ({
      id: `${tourId}_s${index + 1}_p${p + 1}`,
      trackingNumber: `TVO${(4_100_000 + index * 37 + p * 7).toString()}DE`,
      recipientName,
    })),
    status: "pending",
  };
}

export function syntheticTourDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface SyntheticDataset {
  organizationId: string;
  depots: Depot[];
  drivers: Driver[];
  vehicles: Vehicle[];
  tours: Tour[];
  stops: Stop[];
}

export function createSyntheticDataset(now: Date = new Date()): SyntheticDataset {
  const date = syntheticTourDate(now);
  const tours: Tour[] = [
    { organizationId: SYNTHETIC_ORG_ID, id: "tour_ef_a", name: "Erfurt Zentrum A", date, depotId: "dep_erfurt", driverId: "drv_01", vehicleId: "veh_01", status: "planned", plannedStartMinute: 480 },
    { organizationId: SYNTHETIC_ORG_ID, id: "tour_ef_b", name: "Erfurt Nord B", date, depotId: "dep_erfurt", driverId: "drv_02", vehicleId: "veh_02", status: "planned", plannedStartMinute: 480 },
    { organizationId: SYNTHETIC_ORG_ID, id: "tour_ef_c", name: "Erfurt Süd C", date, depotId: "dep_erfurt", driverId: null, vehicleId: null, status: "planned", plannedStartMinute: 540 },
  ];
  const stops: Stop[] = [
    ...ERFURT_STOPS.slice(0, 8).map((s, i) => seedToStop("tour_ef_a", s, i)),
    ...ERFURT_STOPS.slice(8).map((s, i) => seedToStop("tour_ef_b", s, i)),
  ];
  return {
    organizationId: SYNTHETIC_ORG_ID,
    depots: SYNTHETIC_DEPOTS,
    drivers: SYNTHETIC_DRIVERS,
    vehicles: SYNTHETIC_VEHICLES,
    tours,
    stops,
  };
}
