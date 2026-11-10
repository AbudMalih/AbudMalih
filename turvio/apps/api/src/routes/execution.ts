import { DriverSettings, defaultFailureReasons, hasUsableLocation, roundPoint, nowInZone, roadMetrics, routePoint, sortBySequence } from "@turvio/shared";
import { STOP_SELECT, orgTimeZone, toStop, tourEndOf, tourStartOf, type StopRow, type TourRow } from "../data/dispatch";
import { RoutingOutOfCoverage, RoutingUnavailable, type RoutingProvider } from "../routing";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError, type Tx } from "../db";
import { GeocoderUnavailable, RateLimiter, type Geocoder } from "../geocode";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { sha256, validateProofContent, type ProofStore } from "../storage";

const Uuid = z.string().uuid();
const IdParams = OrgParams.extend({ id: Uuid });
// Device-captured positions (also from older app builds) are stored to 7 decimals (~1 cm).
const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).transform(roundPoint);

const ProofUpload = z.object({
  /** Client-generated id: retries of the same upload never create a second record. */
  id: Uuid,
  kind: z.enum(["photo", "signature"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/svg+xml"]),
  dataBase64: z.string().min(4).max(7_200_000),
  capturedAt: z.iso.datetime(),
  recipientName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  location: Point.optional(),
});

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/svg+xml": "svg" };

export async function driverSettingsOf(tx: Tx, orgId: string) {
  const row = (await tx.query<{ driver_settings: unknown }>(`select driver_settings from organizations where id = $1`, [orgId])).rows[0];
  const parsed = DriverSettings.safeParse(row?.driver_settings ?? {});
  const s = parsed.success ? parsed.data : {};
  return {
    failureReasons: s.failureReasons?.length ? s.failureReasons : defaultFailureReasons(),
    customFailureReasons: !!s.failureReasons?.length,
    podLocation: !!s.podLocation,
    showRecipientPhone: !!s.showRecipientPhone,
  };
}

export type ExecutionDeps = { proofStore?: ProofStore; geocoder?: Geocoder; routing?: RoutingProvider };

export function registerExecutionRoutes(app: FastifyInstance, { deps, guards }: RouteCtx, extra: ExecutionDeps) {
  const db = deps.db;
  const claims = guards.claims;

  // ------------------------------------------------------------ notes, scans, stop corrections
  app.post("/v1/orgs/:orgId/stops/:id/note", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ note: z.string().trim().min(1).max(1000), clientEventId: Uuid.optional() }), req.body, reply);
    if (!b) return;
    await db.asUser(claims(req), (tx) => tx.query(`select driver_add_stop_note($1, $2, $3)`, [id, b.note, b.clientEventId ?? null]));
    return reply.status(204).send();
  });

  app.post("/v1/orgs/:orgId/tours/:id/scans", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(z.object({ scans: z.array(z.object({ code: z.string().trim().min(5).max(64), at: z.iso.datetime().optional() })).min(1).max(1000) }), req.body, reply);
    if (!b) return;
    const r = await db.asUser(claims(req), async (tx) => (await tx.query<{ r: { matched: string[]; unknown: string[] } }>(`select driver_record_scans($1, $2::jsonb) as r`, [id, JSON.stringify(b.scans)])).rows[0]!.r);
    return r;
  });

  /** Driver corrections on their own stop: lock position, set/adjust the map position. */
  app.post("/v1/orgs/:orgId/stops/:id/driver-update", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const b = parse(
      z.object({
        locked: z.boolean().optional(),
        location: Point.optional(),
        locationSource: z.enum(["geocoder", "manual_pin"]).optional(),
        // P0-3.2: why, and the location version the driver saw (offline edits must not overwrite a newer change).
        reason: z.string().trim().max(500).optional(),
        expectedLocationVersion: z.number().int().min(1).optional(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    if (b.locked === undefined && !b.location) return problem(reply, 400, "validation_failed", "Nothing to update");
    await db.asUser(claims(req), (tx) =>
      tx.query(`select driver_update_stop($1, $2, $3, $4, $5, $6, $7)`, [
        id,
        b.locked ?? null,
        b.location?.lat ?? null,
        b.location?.lng ?? null,
        b.location ? (b.locationSource ?? "manual_pin") : null,
        b.reason ?? null,
        b.expectedLocationVersion ?? null,
      ]),
    );
    return reply.status(204).send();
  });

  // ------------------------------------------------------------ route editing (driver and staff)
  const AddressBody = z.object({
    street: z.string().trim().min(1).max(200),
    houseNumber: z.string().trim().max(20).optional(),
    postalCode: z.string().trim().regex(/^[0-9A-Za-z -]{3,10}$/),
    city: z.string().trim().min(1).max(100),
  });
  app.post("/v1/orgs/:orgId/stops/:id/edit", { preHandler: guards.requireTenant("stops.update_status_own") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(
      z.object({
        recipientName: z.string().trim().max(120).nullable().optional(),
        address: AddressBody,
        location: Point.optional(),
        locationSource: z.enum(["geocoder", "manual_pin"]).optional(),
        reason: z.string().trim().max(500).optional(),
        expectedAddressVersion: z.number().int().min(1).optional(),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      await tx.query(`select driver_edit_stop($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
        id,
        b.recipientName ?? null,
        b.address.street,
        b.address.houseNumber ?? null,
        b.address.postalCode,
        b.address.city,
        b.location?.lat ?? null,
        b.location?.lng ?? null,
        b.location ? (b.locationSource ?? "manual_pin") : null,
        b.reason ?? null,
        b.expectedAddressVersion ?? null,
      ]);
      return (await tx.query<StopRow>(`${STOP_SELECT} where s.id = $1 and s.organization_id = $2`, [id, orgId])).rows[0]!;
    });
    return { stop: toStop(row) };
  });

  app.post("/v1/orgs/:orgId/stops/:id/remove", { preHandler: guards.requireTenant("stops.add_own") }, async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    await db.asUser(claims(req), (tx) => tx.query(`select driver_delete_stop($1)`, [id]));
    return reply.status(204).send();
  });

  app.post("/v1/orgs/:orgId/stops/:id/merge", { preHandler: guards.requireTenant("stops.add_own") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(z.object({ intoStopId: Uuid }), req.body, reply);
    if (!b) return;
    const row = await db.asUser(claims(req), async (tx) => {
      await tx.query(`select merge_stops($1, $2)`, [id, b.intoStopId]);
      return (await tx.query<StopRow>(`${STOP_SELECT} where s.id = $1 and s.organization_id = $2`, [b.intoStopId, orgId])).rows[0]!;
    });
    return { stop: toStop(row) };
  });

  // ------------------------------------------------------------ driver settings (failure reasons, PoD location)
  app.get("/v1/orgs/:orgId/settings/driver", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(claims(req), (tx) => driverSettingsOf(tx, orgId));
  });

  app.put("/v1/orgs/:orgId/settings/driver", { preHandler: guards.requireTenant("org.settings.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(DriverSettings, req.body, reply);
    if (!b) return;
    if (b.failureReasons && new Set(b.failureReasons.map((r) => r.code)).size !== b.failureReasons.length) {
      return problem(reply, 400, "validation_failed", "Failure reason codes must be unique");
    }
    return db.asUser(claims(req), async (tx) => {
      const r = await tx.query(`update organizations set driver_settings = $2::jsonb where id = $1`, [orgId, JSON.stringify(b)]);
      if (!r.rowCount) throw new ApiError(403, "forbidden", "You are not allowed to change these settings");
      return driverSettingsOf(tx, orgId);
    });
  });

  // ------------------------------------------------------------ proof of delivery
  app.post("/v1/orgs/:orgId/stops/:id/proofs", { preHandler: guards.requireTenant("stops.update_status_own"), bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const { orgId, id: stopId } = IdParams.parse(req.params);
    const store = extra.proofStore;
    if (!store) return problem(reply, 503, "storage_unavailable", "Proof storage is not configured");
    const b = parse(ProofUpload, req.body, reply);
    if (!b) return;
    const allowed = b.kind === "photo" ? ["image/jpeg", "image/png"] : ["image/svg+xml", "image/png"];
    if (!allowed.includes(b.contentType)) return problem(reply, 400, "validation_failed", "Signatures are SVG/PNG, photos are JPEG/PNG");
    const bytes = Buffer.from(b.dataBase64, "base64");
    const invalid = validateProofContent(b.contentType, bytes);
    if (invalid) return problem(reply, 422, invalid, "The file is not an allowed image");
    const hash = sha256(bytes);
    const path = `${orgId}/${stopId}/${b.id}.${EXT[b.contentType]}`;
    const result = await db.asUser(claims(req), async (tx) => {
      const settings = await driverSettingsOf(tx, orgId);
      const location = settings.podLocation ? b.location : undefined; // never stored unless the company enabled it
      const existing = (await tx.query<{ stop_id: string; sha256: string | null }>(`select stop_id, sha256 from proofs where id = $1`, [b.id])).rows[0];
      if (existing) {
        if (existing.stop_id !== stopId || existing.sha256 !== hash) throw new ApiError(409, "conflict", "A different proof with this id already exists");
      } else {
        const visible = (await tx.query(`select 1 from stops where id = $1 and organization_id = $2`, [stopId, orgId])).rowCount;
        if (!visible) throw new ApiError(404, "not_found", "Stop not found");
        await tx.query(
          `insert into proofs (id, organization_id, stop_id, kind, storage_path, recipient_name, notes, captured_at, lat, lng, content_type, size_bytes, sha256)
           values ($1,$2,$3,$4,$5,$6,$7,least($8::timestamptz, now()),$9,$10,$11,$12,$13)`,
          [b.id, orgId, stopId, b.kind, path, b.recipientName ?? null, b.notes ?? null, b.capturedAt, location?.lat ?? null, location?.lng ?? null, b.contentType, bytes.length, hash],
        );
      }
      // Write (or re-write after an interrupted earlier attempt) inside the transaction:
      // if storage fails, the record is rolled back and the client retries.
      await store.put(path, bytes, b.contentType);
      return { id: b.id, created: !existing, locationStored: !!location };
    });
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.get("/v1/orgs/:orgId/stops/:id/proofs", { preHandler: guards.requireTenant("tours.view_own") }, async (req) => {
    const { orgId, id } = IdParams.parse(req.params);
    return db.asUser(claims(req), async (tx) => {
      const { rows } = await tx.query(
        `select id, kind, captured_at as "capturedAt", recipient_name as "recipientName", notes, lat is not null as "hasLocation", created_by as "createdBy", size_bytes as "sizeBytes"
           from proofs where stop_id = $1 and organization_id = $2 order by captured_at`,
        [id, orgId],
      );
      return { proofs: rows };
    });
  });

  /** Streams the file only after RLS confirmed the caller may see the proof record. */
  app.get("/v1/orgs/:orgId/proofs/:id/file", { preHandler: guards.requireTenant("tours.view_own") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const store = extra.proofStore;
    if (!store) return problem(reply, 503, "storage_unavailable", "Proof storage is not configured");
    const row = await db.asUser(claims(req), async (tx) =>
      (await tx.query<{ storage_path: string; content_type: string }>(`select storage_path, content_type from proofs where id = $1 and organization_id = $2`, [id, orgId])).rows[0],
    );
    if (!row) return problem(reply, 404, "not_found", "Proof not found");
    // Accountability: who looked at which proof (personal data) and when.
    await db.asService((tx) =>
      tx.query(`select app.log_read($1, $2, 'proofs', $3)`, [orgId, req.user!.userId, id]),
    );
    const file = await store.get(row.storage_path);
    if (!file) return problem(reply, 404, "file_missing", "The file of this proof is not available");
    return reply
      .header("content-type", row.content_type)
      .header("cache-control", "private, no-store")
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      .header("content-disposition", "inline")
      .send(file.bytes);
  });

  app.delete("/v1/orgs/:orgId/proofs/:id", { preHandler: guards.requireTenant("org.settings.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const n = await db.asUser(claims(req), async (tx) => (await tx.query(`delete from proofs where id = $1 and organization_id = $2`, [id, orgId])).rowCount);
    if (!n) return problem(reply, 404, "not_found", "Proof not found");
    return reply.status(204).send(); // the file is removed by the storage-deletion worker
  });

  // ------------------------------------------------------------ road route (Dispatch and Driver use the same figures)
  app.get("/v1/orgs/:orgId/tours/:id/route", { preHandler: guards.requireTenant("tours.view_own") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const data = await db.asUser(claims(req), async (tx) => {
      const tour = (await tx.query<TourRow>(`select * from tours where id = $1 and organization_id = $2`, [id, orgId])).rows[0];
      if (!tour) throw new ApiError(404, "not_found", "Tour not found");
      const depot = (await tx.query<{ lat: number; lng: number }>(`select lat, lng from depots where id = $1`, [tour.depot_id])).rows[0]!;
      const stops = (await tx.query<StopRow>(`${STOP_SELECT} where s.tour_id = $1 order by s.sequence`, [id])).rows.map(toStop);
      const tz = await orgTimeZone(tx, orgId);
      return { tour, depot, stops, now: nowInZone(tz).minute };
    });
    const start = tourStartOf(data.tour, data.depot);
    // undefined = the tour ends at its last stop: no return leg in the route, distance or ETAs.
    const end = tourEndOf(data.tour, data.depot);
    // Certainly wrong coordinates (0,0, German address abroad) are not routed – same rule as the projection.
    const located = sortBySequence(data.stops).filter((s) => s.type !== "break" && hasUsableLocation(s));
    const waypointStopIds: (string | null)[] = [null, ...located.map((s) => s.id), ...(end ? [null] : [])];
    // Accepted approach points are where the vehicle drives to (the map line ends there, too).
    const points = [start, ...located.map((s) => routePoint(s)!), ...(end ? [end] : [])];
    const unlocated = data.stops.filter((s) => !hasUsableLocation(s)).map((s) => s.id);
    if (points.length < 2) return { source: "none", note: "No located stops to route", waypointStopIds, unlocatedStopIds: unlocated };
    if (!extra.routing) return { source: "none", note: "No routing service configured – figures are straight-line estimates", waypointStopIds, unlocatedStopIds: unlocated };
    try {
      const r = await extra.routing.route(points);
      const running = data.tour.status === "in_progress" || data.tour.status === "paused";
      const metrics = roadMetrics(data.stops, { legs: r.legs, waypointStopIds }, running ? data.now : data.tour.planned_start_minute);
      return { source: "osrm", waypointStopIds, legs: r.legs, geometry: r.geometry, metrics, unlocatedStopIds: unlocated, computedAt: new Date().toISOString() };
    } catch (e) {
      if (e instanceof RoutingOutOfCoverage) {
        const ids = e.points.map((p) => waypointStopIds[p.index]);
        req.log.warn({ tourId: id, points: e.points }, "road routing: locations outside the routing data");
        return reply.send({
          source: "none",
          note: `${e.message} – the map shows straight lines, distances and times are not road values`,
          routingError: { code: "routing_out_of_coverage", stopIds: ids.filter((x): x is string => !!x), depotAffected: ids.some((x) => x === null) },
          waypointStopIds,
          unlocatedStopIds: unlocated,
        });
      }
      if (e instanceof RoutingUnavailable) {
        req.log.warn({ tourId: id, err: e.message }, "road routing unavailable");
        return reply.send({ source: "none", note: `${e.message} – figures are straight-line estimates`, routingError: { code: "routing_unavailable" }, waypointStopIds, unlocatedStopIds: unlocated });
      }
      throw e;
    }
  });

  // ------------------------------------------------------------ address search
  const limiter = new RateLimiter(2, 6);
  const geocodeGuard = (userId: string) => {
    if (!extra.geocoder || extra.geocoder.name === "none") throw new ApiError(503, "geocoder_unavailable", "Address search is not configured. The address is kept and marked as needing a map position.");
    if (!limiter.take(userId)) throw new ApiError(429, "rate_limited", "Too many address searches – try again in a moment");
    return extra.geocoder;
  };
  const wrap = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof GeocoderUnavailable) throw new ApiError(503, "geocoder_unavailable", e.message);
      throw e;
    }
  };

  app.get("/v1/geocode/search", { preHandler: guards.authenticate }, async (req, reply) => {
    const q = parse(
      z.object({
        q: z.string().trim().min(3).max(200),
        country: z.string().regex(/^[A-Za-z]{2}(,[A-Za-z]{2})*$/).optional(),
        limit: z.coerce.number().int().min(1).max(10).default(5),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
      }),
      req.query,
      reply,
    );
    if (!q) return;
    const g = geocodeGuard(req.user!.userId);
    const results = await wrap(() =>
      g.search(q.q, { countryCodes: q.country?.toUpperCase().split(","), limit: q.limit, near: q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined }),
    );
    return { provider: g.name, results };
  });

  app.get("/v1/geocode/reverse", { preHandler: guards.authenticate }, async (req, reply) => {
    const q = parse(z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }), req.query, reply);
    if (!q) return;
    const g = geocodeGuard(req.user!.userId);
    return { provider: g.name, result: await wrap(() => g.reverse(q.lat, q.lng)) };
  });

  /** Bulk geocoding for imports: exact structured matches only (house or street level), never fuzzy guesses. */
  const batchLimiter = new RateLimiter(0.5, 3);
  app.post("/v1/geocode/batch", { preHandler: guards.authenticate }, async (req, reply) => {
    const b = parse(
      z.object({ addresses: z.array(z.object({ street: z.string().trim().min(2).max(200), houseNumber: z.string().trim().max(20).optional(), postalCode: z.string().trim().max(10), city: z.string().trim().max(100).optional() })).min(1).max(200) }),
      req.body,
      reply,
    );
    if (!b) return;
    const g = extra.geocoder;
    if (!g || g.name === "none") throw new ApiError(503, "geocoder_unavailable", "Address search is not configured");
    if (!batchLimiter.take(req.user!.userId)) throw new ApiError(429, "rate_limited", "Too many batch requests – try again in a moment");
    const exact = (g as { exact?: (a: { street: string; houseNumber?: string; postalCode: string }) => Promise<unknown> }).exact?.bind(g);
    const results = [];
    for (const a of b.addresses) {
      const r = exact
        ? await exact(a)
        : (await wrap(() => g.search(`${a.street} ${a.houseNumber ?? ""}, ${a.postalCode} ${a.city ?? ""}`, { countryCodes: ["DE"], limit: 1 })))[0] ?? null;
      results.push(r ?? null);
    }
    return { provider: g.name, results };
  });

  /**
   * Does each postcode belong to the given city? (import validation; never changes anything).
   * ok = the address data has this postcode in this city; mismatch = it has the postcode, but only
   * in other cities (listed); unknown = postcode not in the address data (cannot be checked).
   */
  app.post("/v1/geocode/postcodes", { preHandler: guards.authenticate }, async (req, reply) => {
    const b = parse(z.object({ pairs: z.array(z.object({ postalCode: z.string().trim().regex(/^\d{5}$/), city: z.string().trim().min(1).max(100) })).min(1).max(2000) }), req.body, reply);
    if (!b) return;
    const g = extra.geocoder as (typeof extra.geocoder & { postcodeCities?: (codes: string[]) => Promise<Map<string, string[]>> }) | undefined;
    if (!g?.postcodeCities) return { available: false, results: b.pairs.map((p) => ({ ...p, status: "unknown" as const })) };
    const known = await g.postcodeCities([...new Set(b.pairs.map((p) => p.postalCode))]);
    const norm = (s: string) => s.toLowerCase().replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/([aou])e/g, "$1").replace(/[^a-z0-9]/g, "");
    const results = b.pairs.map((p) => {
      const cities = known.get(p.postalCode) ?? [];
      if (!cities.length) return { ...p, status: "unknown" as const };
      const c = norm(p.city);
      // "Hannover" also matches "Hannover-List" / "Hannover OT Linden".
      const ok = cities.some((k) => norm(k) === c || c.startsWith(norm(k)) || norm(k).startsWith(c));
      return ok ? { ...p, status: "ok" as const } : { ...p, status: "mismatch" as const, knownCities: cities.slice(0, 5) };
    });
    return { available: true, results };
  });

  app.get("/v1/geocode/status", { preHandler: guards.authenticate }, async () => ({ provider: extra.geocoder?.name ?? "none", available: !!extra.geocoder && extra.geocoder.name !== "none" }));
}
