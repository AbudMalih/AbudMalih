import { z } from "zod";

/**
 * Domain model and validation schemas shared by the driver app, the dispatch
 * dashboard and the API. The database schema (supabase/migrations) mirrors
 * these shapes in snake_case.
 */

/** Role of a user inside one tenant organization. */
export const OrgRole = z.enum(["owner", "admin", "dispatcher", "driver"]);
export type OrgRole = z.infer<typeof OrgRole>;

export const OrgStatus = z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]);
export type OrgStatus = z.infer<typeof OrgStatus>;

/** A tenant: one logistics company subscribing to TURVIO. */
export const Organization = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  countryCode: z.string().length(2).default("DE"),
  status: OrgStatus,
  defaultLocale: z.enum(["de", "en", "ro", "ar"]).default("de"),
  locationRetentionDays: z.number().int().min(1).max(365).default(30),
  proofRetentionDays: z.number().int().min(1).max(3650).default(90),
});
export type Organization = z.infer<typeof Organization>;

export const Membership = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  role: OrgRole,
  active: z.boolean().default(true),
  /** Optional depot restriction for dispatchers (null/empty = all depots). */
  depotIds: z.array(z.string().min(1)).nullable().optional(),
});
export type Membership = z.infer<typeof Membership>;

export const Locale = z.enum(["de", "en", "ro", "ar"]);
export type Locale = z.infer<typeof Locale>;

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

/** Minutes since local midnight (0–1439). Time windows are same-day. */
export const MinuteOfDay = z.number().int().min(0).max(24 * 60 - 1);

export const TimeWindow = z
  .object({
    start: MinuteOfDay,
    end: MinuteOfDay,
  })
  .refine((w) => w.end > w.start, {
    message: "Time window end must be after start",
    path: ["end"],
  });
export type TimeWindow = z.infer<typeof TimeWindow>;

export const Address = z.object({
  street: z.string().trim().min(1).max(200),
  houseNumber: z.string().trim().max(20).optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z -]{3,10}$/, "Invalid postal code"),
  city: z.string().trim().min(1).max(100),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .default("DE"),
});
export type Address = z.infer<typeof Address>;

export const StopType = z.enum(["delivery", "pickup", "break"]);
export type StopType = z.infer<typeof StopType>;

/**
 * Stop lifecycle. `pending` and `in_progress` (driver arrived) are open;
 * every other status closes the stop. `failed`, `attempted`, `rescheduled`
 * and `returned` are "not delivered" outcomes and carry a failure reason.
 */
export const StopStatus = z.enum([
  "pending",
  "in_progress",
  "delivered",
  "picked_up",
  "failed",
  "attempted",
  "rescheduled",
  "returned",
  "skipped",
]);
export type StopStatus = z.infer<typeof StopStatus>;

export const Parcel = z.object({
  id: z.string().min(1),
  trackingNumber: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(128).optional(),
  recipientName: z.string().trim().max(120).optional(),
  /** Set when the parcel was scanned into the vehicle. */
  loadedAt: z.iso.datetime().optional(),
});
export type Parcel = z.infer<typeof Parcel>;

/** Where a stop's coordinates came from. `null` location = needs resolution. */
export const LocationSource = z.enum(["geocoder", "manual_pin", "import", "dispatch"]);
export type LocationSource = z.infer<typeof LocationSource>;

export const ProofKind = z.enum(["photo", "signature"]);
export type ProofKind = z.infer<typeof ProofKind>;

/** Metadata of a proof-of-delivery record (the file itself is fetched separately, with access checks). */
export const ProofSummary = z.object({
  id: z.string().min(1),
  kind: ProofKind,
  capturedAt: z.iso.datetime(),
  recipientName: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  hasLocation: z.boolean().optional(),
});
export type ProofSummary = z.infer<typeof ProofSummary>;

export const Stop = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  tourId: z.string().min(1),
  type: StopType,
  /** Position in the driver's current sequence (0-based). */
  sequence: z.number().int().min(0),
  recipientName: z.string().trim().max(120).optional(),
  address: Address,
  /** Null until geocoded or placed on the map by the driver. */
  location: GeoPoint.nullable(),
  timeWindow: TimeWindow.optional(),
  /** Expected handling time at the stop in seconds. */
  serviceSeconds: z.number().int().min(0).max(3 * 3600).default(120),
  priority: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  parcels: z.array(Parcel).default([]),
  status: StopStatus.default("pending"),
  completedAt: z.iso.datetime().optional(),
  /** Note written by the driver (dispatch instructions are in `notes`). */
  driverNotes: z.string().max(1000).optional(),
  /** Code from the organization's failure-reason list (not-delivered outcomes). */
  failureReason: z.string().max(40).optional(),
  /** Keeps its position when the route is re-optimized. */
  locked: z.boolean().optional(),
  locationSource: LocationSource.nullable().optional(),
  /** Recipient phone – only present when the organization shares it with drivers. */
  recipientPhone: z.string().max(40).optional(),
  proofs: z.array(ProofSummary).optional(),
});
export type Stop = z.infer<typeof Stop>;

export const TourStatus = z.enum(["planned", "in_progress", "paused", "completed"]);
export type TourStatus = z.infer<typeof TourStatus>;

export const Depot = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  address: Address,
  location: GeoPoint,
});
export type Depot = z.infer<typeof Depot>;

export const Driver = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  displayName: z.string().min(1).max(120),
  depotId: z.string().min(1),
  /** Maximum working time per shift in minutes (ArbZG: 8h, extendable to 10h). */
  maxShiftMinutes: z.number().int().min(60).max(600).default(480),
  active: z.boolean().default(true),
});
export type Driver = z.infer<typeof Driver>;

export const Vehicle = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  label: z.string().min(1).max(60),
  licensePlate: z.string().min(1).max(15),
  depotId: z.string().min(1),
  /** Parcel capacity; null = unlimited / not tracked. */
  capacityParcels: z.number().int().min(1).nullable().default(null),
});
export type Vehicle = z.infer<typeof Vehicle>;

/**
 * Where a tour ends: back at its depot (default), at a chosen address, or at its last stop
 * (no return trip in optimization, distance or ETA).
 */
export const TourEndMode = z.enum(["depot", "address", "last_stop"]);
export type TourEndMode = z.infer<typeof TourEndMode>;

/** A tour's own start or end address (overrides the depot). */
export const TourPlace = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Address shown to people, e.g. "Hauptstraße 1, 30159 Hannover". */
  label: z.string().trim().min(1).max(200).nullable().optional(),
});
export type TourPlace = z.infer<typeof TourPlace>;

export const Tour = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  date: z.iso.date(),
  depotId: z.string().min(1),
  driverId: z.string().min(1).nullable(),
  vehicleId: z.string().min(1).nullable(),
  status: TourStatus,
  /** Start/end override; defaults to the depot location. */
  startLocation: GeoPoint.optional(),
  endLocation: GeoPoint.optional(),
  startLabel: z.string().nullable().optional(),
  endLabel: z.string().nullable().optional(),
  /** Missing on older data: "address" when endLocation is set, else "depot" (see tourEndPoint). */
  endMode: TourEndMode.optional(),
  plannedStartMinute: MinuteOfDay.default(8 * 60),
  startedAt: z.iso.datetime().optional(),
  finishedAt: z.iso.datetime().optional(),
  /** Optimistic-concurrency version (persisted tours). */
  version: z.number().int().min(1).optional(),
  /** Set when dispatch published the tour to the driver. */
  publishedAt: z.iso.datetime().nullable().optional(),
  optimizedAt: z.iso.datetime().nullable().optional(),
  /** "driver" = personal route created in the driver app. */
  origin: z.enum(["dispatch", "driver"]).optional(),
  optimization: z
    .object({ engine: z.string(), matrixSource: z.string(), unassignedStopIds: z.array(z.string()).optional() })
    .nullable()
    .optional(),
});
export type Tour = z.infer<typeof Tour>;

/** Organization settings that affect the driver app. */
export const DriverSettings = z.object({
  failureReasons: z
    .array(
      z.object({
        code: z.string().regex(/^[a-z0-9_]{2,40}$/),
        label: z.string().trim().min(1).max(80).optional(),
        requiresNote: z.boolean().optional(),
      }),
    )
    .max(30)
    .optional(),
  /** Store the device position with proof of delivery (needs a DPIA / works-council agreement). */
  podLocation: z.boolean().optional(),
  /** Show recipient phone numbers to drivers. */
  showRecipientPhone: z.boolean().optional(),
});
export type DriverSettings = z.infer<typeof DriverSettings>;

/** Payload for manual stop entry (driver app and dispatch). */
export const NewStopInput = z.object({
  /** Client-generated id (UUID) – makes offline creation idempotent. */
  id: z.uuid().optional(),
  type: StopType.exclude(["break"]).default("delivery"),
  locationSource: LocationSource.nullable().optional(),
  recipientPhone: z.string().trim().max(40).optional(),
  recipientName: z.string().trim().max(120).optional(),
  address: Address,
  location: GeoPoint.nullable().default(null),
  timeWindow: TimeWindow.optional(),
  serviceSeconds: z.number().int().min(0).max(3 * 3600).default(120),
  priority: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional(),
  trackingNumbers: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
});
export type NewStopInput = z.input<typeof NewStopInput>;
export type NewStopParsed = z.output<typeof NewStopInput>;

// ---------------------------------------------------------------------------
// Optimization contract (API <-> optimizer service). Keep in sync with
// services/optimizer/turvio_optimizer/models.py.
// ---------------------------------------------------------------------------

export const OptimizeVehicle = z.object({
  id: z.string().min(1),
  start: GeoPoint,
  end: GeoPoint.optional(),
  /** Shift start in minutes since midnight. */
  shiftStart: MinuteOfDay,
  /** Maximum route duration (driving + service + waiting) in minutes. */
  maxShiftMinutes: z.number().int().min(1).max(24 * 60),
  capacity: z.number().int().min(1).optional(),
});
export type OptimizeVehicle = z.infer<typeof OptimizeVehicle>;

export const OptimizeStop = z.object({
  id: z.string().min(1),
  location: GeoPoint,
  serviceSeconds: z.number().int().min(0),
  timeWindow: TimeWindow.optional(),
  priority: z.boolean().default(false),
  demand: z.number().int().min(0).default(1),
});
export type OptimizeStop = z.infer<typeof OptimizeStop>;

export const OptimizeRequest = z
  .object({
    vehicles: z.array(OptimizeVehicle).min(1).max(100),
    stops: z.array(OptimizeStop).min(1).max(2000),
    /** Solver time limit in seconds. */
    timeLimitSeconds: z.number().int().min(1).max(120).default(10),
    /** Pickup must precede its delivery on the same vehicle. */
    pickupDeliveries: z.array(z.object({ pickupId: z.string().min(1), deliveryId: z.string().min(1) })).max(1000).optional(),
    /** true: a deadline that cannot be met drops the stop; default: served late and reported. */
    strictTimeWindows: z.boolean().optional(),
    /** Set: the shift may be exceeded at this cost per minute (reported); unset: hard shift limit. */
    overtimePenaltyPerMinute: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((r) => new Set(r.stops.map((s) => s.id)).size === r.stops.length, {
    message: "Stop ids must be unique",
    path: ["stops"],
  });
export type OptimizeRequest = z.input<typeof OptimizeRequest>;

export const OptimizedVisit = z.object({
  stopId: z.string(),
  /** Planned service start in minutes since midnight (after any waiting for the window). */
  arrivalMinute: z.number(),
  /** When the vehicle physically arrives (earlier than arrivalMinute = waiting). */
  travelArrivalMinute: z.number().nullable().optional(),
  /** Minutes after the stop's deadline; 0 when on time. */
  lateMinutes: z.number().optional(),
});

/** Why a plan is not fully within its constraints. */
export const OptimizeViolation = z.object({
  kind: z.enum(["late", "overtime", "unassigned_unreachable", "unassigned_infeasible", "pair_split"]),
  stopId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  minutes: z.number().nullable().optional(),
});
export type OptimizeViolation = z.infer<typeof OptimizeViolation>;

export const OptimizeResponse = z.object({
  routes: z.array(
    z.object({
      vehicleId: z.string(),
      visits: z.array(OptimizedVisit),
      distanceMeters: z.number().min(0),
      durationSeconds: z.number().min(0),
      driveSeconds: z.number().min(0).optional(),
      serviceSeconds: z.number().min(0).optional(),
      waitSeconds: z.number().min(0).optional(),
      startMinute: z.number().nullable().optional(),
      endMinute: z.number().nullable().optional(),
      overtimeMinutes: z.number().min(0).optional(),
    }),
  ),
  unassignedStopIds: z.array(z.string()),
  /** How travel times were obtained: road network or straight-line estimate. */
  matrixSource: z.enum(["osrm", "haversine_estimate"]),
  /** Set when OSRM is configured but could not be used (the estimate was used instead). */
  matrixNote: z.string().nullable().optional(),
  /** Solver status; "feasible" means a valid, not proven-optimal, solution. */
  status: z.enum(["feasible", "no_solution"]),
  engine: z.string(),
  violations: z.array(OptimizeViolation).optional(),
  solveSeconds: z.number().nullable().optional(),
});
export type OptimizeResponse = z.infer<typeof OptimizeResponse>;
