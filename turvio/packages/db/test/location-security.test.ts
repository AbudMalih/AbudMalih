import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

/**
 * Phase B (migration 20261117000100): fail-closed location scope, safe invitations, protected
 * driver logins, location-scoped invitations / tracking confirmations / GPS. Database layer –
 * these rules hold for direct (PostgREST) access too, not only through the API.
 */
let db: PGlite;
const depotA2 = "00000000-0000-4000-8000-0000000600a2"; // second JARBOU location (Bremen)
const drvA3 = "00000000-0000-4000-8000-0000000100a3"; // driver in Bremen, linked
const drvFreeA = "00000000-0000-4000-8000-0000000100f1"; // no login yet, depot A
const drvFreeA2 = "00000000-0000-4000-8000-0000000100f2"; // no login yet, Bremen
const tourA3 = "00000000-0000-4000-8000-0000000700a3"; // Bremen tour
const bremenUser = "00000000-0000-4000-8000-0000000000a5";
const newUser = "00000000-0000-4000-8000-0000000000a9";
const count = async (sql: string, params: unknown[] = []) => Number(((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!).n);

beforeEach(async () => {
  db = await createSeededDb();
  await db.query(`update subscriptions set seats = 20 where organization_id = $1`, [ids.orgJarbou]); // room for the extra test drivers
  await db.query(`insert into depots (id, organization_id, name, street, postal_code, city, lat, lng) values ($1, $2, 'Depot Bremen', 'Logistikring', '28197', 'Bremen', 53.09, 8.72)`, [depotA2, ids.orgJarbou]);
  await db.query(`insert into auth.users (id, email) values ($1, 'bremen.driver@jarbou.example'), ($2, 'new.person@example.test')`, [bremenUser, newUser]);
  await db.query(`insert into memberships (organization_id, user_id, role) values ($1, $2, 'driver')`, [ids.orgJarbou, bremenUser]);
  await db.query(
    `insert into drivers (id, organization_id, depot_id, display_name, user_id) values ($1, $2, $3, 'Bremen Driver', $4), ($5, $2, $6, 'Free A', null), ($7, $2, $3, 'Free Bremen', null)`,
    [drvA3, ids.orgJarbou, depotA2, bremenUser, drvFreeA, ids.depotA, drvFreeA2],
  );
  await db.query(`insert into tours (id, organization_id, depot_id, driver_id, name, tour_date, status, published_at) values ($1, $2, $3, $4, 'BRE-01', current_date, 'in_progress', now())`, [tourA3, ids.orgJarbou, depotA2, drvA3]);
  await db.query(`insert into driver_positions (organization_id, driver_id, tour_id, lat, lng, recorded_at) values ($1, $2, $3, 53.08, 8.8, now())`, [ids.orgJarbou, drvA3, tourA3]);
  await db.query(`insert into location_pings (organization_id, driver_id, tour_id, lat, lng) values ($1, $2, $3, 53.08, 8.8)`, [ids.orgJarbou, drvA3, tourA3]);
  await db.query(`insert into tracking_notice_acks (organization_id, driver_id, notice_version) values ($1, $2, 1), ($1, $3, 1)`, [ids.orgJarbou, drvA3, ids.drvRowA1]);
  // The dispatcher works for depot A (Erfurt) only.
  await db.query(`update memberships set all_locations = false where organization_id = $1 and user_id = $2`, [ids.orgJarbou, ids.dispatcherA]);
  const m = (await db.query<{ id: string }>(`select id from memberships where organization_id = $1 and user_id = $2`, [ids.orgJarbou, ids.dispatcherA])).rows[0]!.id;
  await db.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1, $2, $3)`, [ids.orgJarbou, m, ids.depotA]);
});

const invite = (by: string, values: { email: string; role: string; hash: string; driver?: string | null; depots?: string[] | null; all?: boolean }) =>
  asUser(db, by, () =>
    db.query(`insert into invitations (organization_id, email, role, token_hash, driver_id, depot_ids, all_locations) values ($1,$2,$3,$4,$5,$6,$7)`, [
      ids.orgJarbou,
      values.email,
      values.role,
      values.hash,
      values.driver ?? null,
      values.depots ?? null,
      values.all ?? false,
    ]),
  );

describe("driver-profile takeover", () => {
  it("a dispatcher cannot invite a login onto a profile in another location", async () => {
    await expect(invite(ids.dispatcherA, { email: "x@example.test", role: "driver", hash: "t1", driver: drvFreeA2 })).rejects.toThrow(/not in your locations/);
  });

  it("nobody – not even the owner – can invite onto a profile that already has a login", async () => {
    await expect(invite(ids.dispatcherA, { email: "x@example.test", role: "driver", hash: "t2", driver: ids.drvRowA1 })).rejects.toThrow(/already has a login/);
    await expect(invite(ids.ownerA, { email: "x@example.test", role: "driver", hash: "t3", driver: drvA3 })).rejects.toThrow(/already has a login/);
  });

  it("a dispatcher may invite for an unlinked profile in their own location", async () => {
    await invite(ids.dispatcherA, { email: "new.person@example.test", role: "driver", hash: "t4", driver: drvFreeA });
    await db.query(`select app.accept_invitation('t4', $1)`, [newUser]);
    expect((await db.query<{ user_id: string }>(`select user_id from drivers where id = $1`, [drvFreeA])).rows[0]!.user_id).toBe(newUser);
  });

  it("a driver's login cannot be changed directly by a dispatcher (also via PostgREST), only by an admin", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`update drivers set user_id = $1 where id = $2`, [ids.dispatcherA, ids.drvRowA1])).rejects.toThrow(/only a Company Admin/);
      await expect(db.query(`update drivers set user_id = null where id = $1`, [ids.drvRowA1])).rejects.toThrow(/only a Company Admin/);
      await expect(
        db.query(`insert into drivers (organization_id, depot_id, display_name, user_id) values ($1, $2, 'Sneaky', $3)`, [ids.orgJarbou, ids.depotA, newUser]),
      ).rejects.toThrow(/only a Company Admin/);
      // Other fields of their own drivers stay editable.
      await db.query(`update drivers set display_name = 'Lena H.' where id = $1`, [ids.drvRowA1]);
    });
    await asUser(db, ids.ownerA, async () => {
      await db.query(`update drivers set user_id = null where id = $1`, [drvFreeA]);
    });
  });

  it("two invitations for the same profile cannot both win: the second acceptance is refused", async () => {
    await invite(ids.ownerA, { email: "new.person@example.test", role: "driver", hash: "r1", driver: drvFreeA });
    await invite(ids.ownerA, { email: "bremen.driver@jarbou.example", role: "driver", hash: "r2", driver: drvFreeA });
    await db.query(`select app.accept_invitation('r1', $1)`, [newUser]);
    await expect(db.query(`select app.accept_invitation('r2', $1)`, [bremenUser])).rejects.toThrow(/already belongs to another login/);
    expect((await db.query<{ user_id: string }>(`select user_id from drivers where id = $1`, [drvFreeA])).rows[0]!.user_id).toBe(newUser);
    expect((await db.query<{ user_id: string }>(`select user_id from drivers where id = $1`, [drvA3])).rows[0]!.user_id).toBe(bremenUser);
  });
});

describe("existing members are never overwritten", () => {
  it("an invitation for an existing admin as driver is refused; the role stays", async () => {
    await invite(ids.ownerA, { email: "dispatch@jarbou.example", role: "driver", hash: "o1", driver: drvFreeA });
    await expect(db.query(`select app.accept_invitation('o1', $1)`, [ids.dispatcherA])).rejects.toThrow(/already a member/);
    expect((await db.query<{ role: string }>(`select role from memberships where organization_id = $1 and user_id = $2`, [ids.orgJarbou, ids.dispatcherA])).rows[0]!.role).toBe("dispatcher");
    expect((await db.query<{ user_id: string | null }>(`select user_id from drivers where id = $1`, [drvFreeA])).rows[0]!.user_id).toBeNull();
  });

  it("dispatchers cannot invite or promote admins/owners", async () => {
    await expect(invite(ids.dispatcherA, { email: "x@example.test", role: "admin", hash: "p1" })).rejects.toThrow(/row-level security/);
    await expect(invite(ids.dispatcherA, { email: "x@example.test", role: "owner", hash: "p2" })).rejects.toThrow(/row-level security/);
    await asUser(db, ids.dispatcherA, async () => {
      const r = await db.query(`update memberships set role = 'admin' where user_id = $1`, [ids.dispatcherA]);
      expect(r.affectedRows ?? 0).toBe(0);
    });
  });
});

describe("dispatcher invitations need locations", () => {
  it("no location = refused; all locations only from an admin; unknown depots refused", async () => {
    await expect(invite(ids.ownerA, { email: "d@example.test", role: "dispatcher", hash: "d1" })).rejects.toThrow(/at least one location/);
    await expect(invite(ids.ownerA, { email: "d@example.test", role: "dispatcher", hash: "d2", depots: ["00000000-0000-4000-8000-00000000dead"] })).rejects.toThrow(/unknown location/);
    await expect(invite(ids.ownerA, { email: "d@example.test", role: "dispatcher", hash: "d3", depots: [ids.depotB] })).rejects.toThrow(/unknown location/); // other company's depot
    await invite(ids.ownerA, { email: "new.person@example.test", role: "dispatcher", hash: "d4", depots: [depotA2] });
    await db.query(`select app.accept_invitation('d4', $1)`, [newUser]);
    const m = (await db.query<{ all_locations: boolean; n: number }>(`select m.all_locations, (select count(*)::int from membership_depots md where md.membership_id = m.id) as n from memberships m where user_id = $1`, [newUser])).rows[0]!;
    expect(m).toEqual({ all_locations: false, n: 1 });
    await asUser(db, newUser, async () => {
      expect(await count(`select * from tours`)).toBe(1); // Bremen only
    });
  });

  it("an admin can invite a dispatcher for all locations", async () => {
    await invite(ids.ownerA, { email: "new.person@example.test", role: "dispatcher", hash: "d5", all: true });
    await db.query(`select app.accept_invitation('d5', $1)`, [newUser]);
    await asUser(db, newUser, async () => {
      expect(await count(`select * from tours`)).toBeGreaterThan(1);
    });
  });
});

describe("invitations, confirmations and GPS are scoped by location", () => {
  it("a dispatcher sees and cancels only driver invitations of their locations; can change nothing else", async () => {
    await invite(ids.ownerA, { email: "a@example.test", role: "driver", hash: "s1", driver: drvFreeA });
    await invite(ids.ownerA, { email: "b@example.test", role: "driver", hash: "s2", driver: drvFreeA2 });
    await invite(ids.ownerA, { email: "c@example.test", role: "dispatcher", hash: "s3", depots: [depotA2] });
    await asUser(db, ids.dispatcherA, async () => {
      expect((await db.query<{ email: string }>(`select email from invitations order by email`)).rows.map((r) => r.email)).toEqual(["a@example.test"]);
      expect((await db.query(`update invitations set revoked_at = now() where token_hash = 's2'`)).affectedRows ?? 0).toBe(0);
      // Not even their own location's invitation may be redirected to another profile or role.
      await expect(db.query(`update invitations set driver_id = $1 where token_hash = 's1'`, [drvFreeA2])).rejects.toThrow(/only cancelling/);
      await expect(db.query(`update invitations set expires_at = now() + interval '1 year' where token_hash = 's1'`)).rejects.toThrow(/only cancelling/);
      expect((await db.query(`update invitations set revoked_at = now() where token_hash = 's1'`)).affectedRows).toBe(1);
    });
  });

  it("tracking-notice confirmations, live positions and the GPS trail of other locations are hidden", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      expect((await db.query<{ driver_id: string }>(`select driver_id from tracking_notice_acks`)).rows.map((r) => r.driver_id)).toEqual([ids.drvRowA1]);
      expect(await count(`select * from driver_positions`)).toBe(0);
      expect(await count(`select * from location_pings`)).toBe(0);
    });
    await asUser(db, ids.ownerA, async () => {
      expect(await count(`select * from tracking_notice_acks`)).toBe(2);
      expect(await count(`select * from driver_positions`)).toBe(1);
    });
    // The Bremen driver still sees their own.
    await asUser(db, bremenUser, async () => {
      expect(await count(`select * from tracking_notice_acks`)).toBe(1);
    });
  });

  it("the other company sees none of it", async () => {
    await invite(ids.ownerA, { email: "a@example.test", role: "driver", hash: "x1", driver: drvFreeA });
    await asUser(db, ids.ownerB, async () => {
      for (const t of ["invitations", "tracking_notice_acks", "driver_positions", "location_pings", "membership_depots"]) expect(await count(`select * from ${t} where organization_id = '${ids.orgJarbou}'`)).toBe(0);
      expect(await count(`select * from memberships where organization_id = '${ids.orgJarbou}'`)).toBe(0);
    });
  });
});
