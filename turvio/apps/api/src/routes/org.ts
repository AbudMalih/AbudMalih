import { OrgRole, can, canAssignRole } from "@turvio/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OrgParams, parse, problem, type RouteCtx } from "../http";
import { newOpaqueToken } from "../auth/tokens";
import { ApiError } from "../db";
import { loadDispatchDataset, toDepot, toDriver, toVehicle, type DepotRow, type DriverRow, type VehicleRow } from "../data/dispatch";

const Uuid = z.string().uuid();
const IdParams = OrgParams.extend({ id: Uuid });
const DateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

const DepotInput = z.object({
  name: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(200),
  houseNumber: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().regex(/^[0-9A-Za-z -]{3,10}$/),
  city: z.string().trim().min(1).max(100),
  countryCode: z.string().trim().length(2).default("DE"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const DriverInput = z.object({
  displayName: z.string().trim().min(1).max(120),
  depotId: Uuid.nullable(),
  maxShiftMinutes: z.number().int().min(60).max(600).default(480),
  active: z.boolean().default(true),
});

const VehicleInput = z.object({
  label: z.string().trim().min(1).max(60),
  licensePlate: z.string().trim().min(1).max(15),
  depotId: Uuid.nullable(),
  capacityParcels: z.number().int().min(1).max(5000).nullable().default(null),
  active: z.boolean().default(true),
});

export function registerOrgRoutes(app: FastifyInstance, { deps, guards }: RouteCtx) {
  const db = deps.db;

  // ---------------------------------------------------------------- dispatch day
  app.get("/v1/orgs/:orgId/dispatch", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(DateQuery, req.query, reply);
    if (!q) return;
    return db.asUser(guards.claims(req), (tx) => loadDispatchDataset(tx, orgId, q.date));
  });

  // ---------------------------------------------------------------- depots
  app.get("/v1/orgs/:orgId/depots", { preHandler: guards.requireTenant("depots.view") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(guards.claims(req), async (tx) => (await tx.query<DepotRow>(`select * from depots where organization_id = $1 order by name`, [orgId])).rows.map(toDepot));
  });

  app.post("/v1/orgs/:orgId/depots", { preHandler: guards.requireTenant("depots.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(DepotInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<DepotRow>(
          `insert into depots (organization_id, name, street, house_number, postal_code, city, country_code, lat, lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
          [orgId, b.name, b.street, b.houseNumber ?? null, b.postalCode, b.city, b.countryCode.toUpperCase(), b.lat, b.lng],
        )
      ).rows[0]!,
    );
    return reply.status(201).send(toDepot(row));
  });

  app.patch("/v1/orgs/:orgId/depots/:id", { preHandler: guards.requireTenant("depots.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(DepotInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<DepotRow>(
          `update depots set name=$3, street=$4, house_number=$5, postal_code=$6, city=$7, country_code=$8, lat=$9, lng=$10 where id=$2 and organization_id=$1 returning *`,
          [orgId, id, b.name, b.street, b.houseNumber ?? null, b.postalCode, b.city, b.countryCode.toUpperCase(), b.lat, b.lng],
        )
      ).rows[0],
    );
    if (!row) return problem(reply, 404, "not_found", "Depot not found");
    return toDepot(row);
  });

  // ---------------------------------------------------------------- drivers
  app.get("/v1/orgs/:orgId/drivers", { preHandler: guards.requireTenant("drivers.view") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(guards.claims(req), async (tx) => (await tx.query<DriverRow>(`select * from drivers where organization_id = $1 order by display_name`, [orgId])).rows.map(toDriver));
  });

  app.post("/v1/orgs/:orgId/drivers", { preHandler: guards.requireTenant("drivers.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(DriverInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<DriverRow>(`insert into drivers (organization_id, display_name, depot_id, max_shift_minutes, active) values ($1,$2,$3,$4,$5) returning *`, [
          orgId,
          b.displayName,
          b.depotId,
          b.maxShiftMinutes,
          b.active,
        ])
      ).rows[0]!,
    );
    return reply.status(201).send(toDriver(row));
  });

  app.patch("/v1/orgs/:orgId/drivers/:id", { preHandler: guards.requireTenant("drivers.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(DriverInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<DriverRow>(`update drivers set display_name=$3, depot_id=$4, max_shift_minutes=$5, active=$6 where id=$2 and organization_id=$1 returning *`, [
          orgId,
          id,
          b.displayName,
          b.depotId,
          b.maxShiftMinutes,
          b.active,
        ])
      ).rows[0],
    );
    if (!row) return problem(reply, 404, "not_found", "Driver not found");
    return toDriver(row);
  });

  // ---------------------------------------------------------------- vehicles
  app.get("/v1/orgs/:orgId/vehicles", { preHandler: guards.requireTenant("depots.view") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(guards.claims(req), async (tx) => (await tx.query<VehicleRow>(`select * from vehicles where organization_id = $1 order by label`, [orgId])).rows.map(toVehicle));
  });

  app.post("/v1/orgs/:orgId/vehicles", { preHandler: guards.requireTenant("vehicles.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(VehicleInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<VehicleRow>(`insert into vehicles (organization_id, label, license_plate, depot_id, capacity_parcels, active) values ($1,$2,$3,$4,$5,$6) returning *`, [
          orgId,
          b.label,
          b.licensePlate.toUpperCase(),
          b.depotId,
          b.capacityParcels,
          b.active,
        ])
      ).rows[0]!,
    );
    return reply.status(201).send(toVehicle(row));
  });

  app.patch("/v1/orgs/:orgId/vehicles/:id", { preHandler: guards.requireTenant("vehicles.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(VehicleInput, req.body, reply);
    if (!b) return;
    const row = await db.asUser(guards.claims(req), async (tx) =>
      (
        await tx.query<VehicleRow>(`update vehicles set label=$3, license_plate=$4, depot_id=$5, capacity_parcels=$6, active=$7 where id=$2 and organization_id=$1 returning *`, [
          orgId,
          id,
          b.label,
          b.licensePlate.toUpperCase(),
          b.depotId,
          b.capacityParcels,
          b.active,
        ])
      ).rows[0],
    );
    if (!row) return problem(reply, 404, "not_found", "Vehicle not found");
    return toVehicle(row);
  });

  // ---------------------------------------------------------------- team
  app.get("/v1/orgs/:orgId/members", { preHandler: guards.requireTenant("org.members.manage") }, async (req) => {
    const { orgId } = OrgParams.parse(req.params);
    return db.asUser(guards.claims(req), async (tx) => {
      const allLoc = new Map((await tx.query<{ id: string; all_locations: boolean }>(`select id, all_locations from memberships where organization_id = $1`, [orgId])).rows.map((r) => [r.id, r.all_locations]));
      const members = (await tx.query(`select * from org_members($1)`, [orgId])).rows.map((r) => ({
        membershipId: r.membership_id,
        userId: r.user_id,
        email: r.email,
        role: r.role,
        active: r.active,
        depotIds: r.depot_ids,
        allLocations: r.role === "owner" || r.role === "admin" || !!allLoc.get(r.membership_id),
        driverId: r.driver_id,
      }));
      const invitations = (
        await tx.query(
          `select id, email, role, depot_ids, all_locations, driver_id, created_at, expires_at from invitations where organization_id = $1 and accepted_at is null and revoked_at is null order by created_at desc`,
          [orgId],
        )
      ).rows.map((r) => ({ id: r.id, email: r.email, role: r.role, depotIds: r.depot_ids, allLocations: r.all_locations, driverId: r.driver_id, createdAt: r.created_at, expiresAt: r.expires_at }));
      return { members, invitations };
    });
  });

  app.post("/v1/orgs/:orgId/invitations", { preHandler: guards.requireTenant("drivers.manage") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const b = parse(
      z.object({
        email: z.string().trim().toLowerCase().email().max(254),
        role: OrgRole,
        depotIds: z.array(Uuid).max(50).nullable().default(null),
        /** Dispatcher for every location – only a Company Admin/Owner may grant it. */
        allLocations: z.boolean().default(false),
        driverId: Uuid.nullable().default(null),
      }),
      req.body,
      reply,
    );
    if (!b) return;
    const actor = req.membership!.role;
    if (b.role !== "driver" && !canAssignRole(actor, b.role)) return problem(reply, 403, "forbidden", "You cannot invite users with this role");
    if (b.role === "driver" && !b.driverId) return problem(reply, 400, "validation_failed", "Choose the driver profile this login belongs to");
    if (b.role === "dispatcher") {
      if (b.allLocations && !can(actor, "org.members.manage")) return problem(reply, 403, "forbidden", "Only a Company Admin can grant access to all locations");
      if (!b.allLocations && !b.depotIds?.length) return problem(reply, 422, "location_required", "Choose at least one location for this dispatcher");
    }
    const t = newOpaqueToken();
    const inv = await db.asUser(guards.claims(req), async (tx) => {
      // The profile must be in a location the inviter may access and must not have a login yet
      // (also enforced by the database: app.invitations_guard).
      if (b.role === "driver" && b.driverId && !(await tx.query<{ ok: boolean }>(`select app.can_link_driver($1, $2) as ok`, [orgId, b.driverId])).rows[0]!.ok)
        throw new ApiError(409, "driver_profile_unavailable", "This driver profile is not in your locations or already has a login");
      const org = (await tx.query<{ name: string }>(`select name from organizations where id = $1`, [orgId])).rows[0]!;
      const row = (
        await tx.query(
          `insert into invitations (organization_id, email, role, depot_ids, all_locations, driver_id, token_hash) values ($1,$2,$3,$4,$5,$6,$7) returning id, email, role, expires_at`,
          [orgId, b.email, b.role, b.role === "dispatcher" && !b.allLocations ? b.depotIds : null, b.role === "dispatcher" && b.allLocations, b.role === "driver" ? b.driverId : null, t.hash],
        )
      ).rows[0];
      return { ...row, orgName: org.name };
    });
    const link = `${deps.urls?.dispatch ?? "http://localhost:3000"}/invite?token=${encodeURIComponent(t.token)}`;
    await deps.mailer?.send({
      to: b.email,
      subject: `You are invited to ${inv.orgName} on TURVIO`,
      text: `${inv.orgName} invited you to TURVIO as ${b.role}.\n\nAccept the invitation (valid for 7 days):\n${link}\n\n${
        b.role === "driver" ? "After accepting, sign in with the same email and password in the TURVIO Driver app.\n" : ""
      }`,
    });
    return reply.status(201).send({ id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expires_at, emailSent: !!deps.mailer });
  });

  app.delete("/v1/orgs/:orgId/invitations/:id", { preHandler: guards.requireTenant("drivers.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const n = await db.asUser(guards.claims(req), async (tx) => (await tx.query(`update invitations set revoked_at = now() where id = $2 and organization_id = $1 and accepted_at is null and revoked_at is null`, [orgId, id])).rowCount);
    if (!n) return problem(reply, 404, "not_found", "Invitation not found");
    return reply.status(204).send();
  });

  app.patch("/v1/orgs/:orgId/members/:id", { preHandler: guards.requireTenant("org.members.manage") }, async (req, reply) => {
    const { orgId, id } = IdParams.parse(req.params);
    const b = parse(
      z.object({ role: OrgRole.optional(), active: z.boolean().optional(), depotIds: z.array(Uuid).max(50).nullable().optional(), allLocations: z.boolean().optional() }),
      req.body,
      reply,
    );
    if (!b) return;
    if (b.role && !canAssignRole(req.membership!.role, b.role)) return problem(reply, 403, "forbidden", "You cannot assign this role");
    await db.asUser(guards.claims(req), async (tx) => {
      const cur = (await tx.query<{ user_id: string; role: string }>(`select user_id, role from memberships where id = $2 and organization_id = $1`, [orgId, id])).rows[0];
      if (!cur) throw new ApiError(404, "not_found", "Member not found");
      if (cur.user_id === req.user!.userId && (b.active === false || (b.role && b.role !== cur.role))) throw new ApiError(422, "invalid_operation", "You cannot change your own role or deactivate yourself");
      const upd = await tx.query(`update memberships set role = coalesce($3, role), active = coalesce($4, active), all_locations = coalesce($5, all_locations) where id = $2 and organization_id = $1`, [
        orgId,
        id,
        b.role ?? null,
        b.active ?? null,
        b.allLocations ?? null,
      ]);
      if (!upd.rowCount) throw new ApiError(403, "forbidden", "You cannot change this member");
      // Locations are replaced as given; an empty list means NO location access (fail-closed),
      // company-wide access only via allLocations.
      if (b.depotIds !== undefined) {
        await tx.query(`delete from membership_depots where membership_id = $1`, [id]);
        for (const d of b.depotIds ?? []) await tx.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1,$2,$3)`, [orgId, id, d]);
      }
    });
    return reply.status(204).send();
  });
}
