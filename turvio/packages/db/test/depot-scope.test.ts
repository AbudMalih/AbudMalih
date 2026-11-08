import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

/**
 * Depot-level access inside one tenant (migration *_depot_scope.sql).
 * Adds a second JARBOU depot with its own driver, tour and an unassigned stop.
 */
const depotA2 = "00000000-0000-4000-8000-0000000d00a2";
const drvRowA3 = "00000000-0000-4000-8000-0000000100a3";
const tourA3 = "00000000-0000-4000-8000-0000000700a3";
const unassignedA2 = "00000000-0000-4000-8000-0000000500a9";

let db: PGlite;

const count = async (sql: string, params: unknown[] = []) =>
  Number(((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!).n);

async function membershipId(userId: string) {
  return (await db.query<{ id: string }>(`select id from memberships where user_id = $1 and organization_id = $2`, [userId, ids.orgJarbou])).rows[0]!.id;
}

beforeEach(async () => {
  db = await createSeededDb();
  await db.query(
    `insert into depots (id, organization_id, name, street, postal_code, city, lat, lng) values ($1, $2, 'Depot Bremen', 'Logistikring', '28197', 'Bremen', 53.09, 8.72)`,
    [depotA2, ids.orgJarbou],
  );
  await db.query(`insert into drivers (id, organization_id, depot_id, display_name) values ($1, $2, $3, 'Bremen Driver')`, [drvRowA3, ids.orgJarbou, depotA2]);
  await db.query(`insert into tours (id, organization_id, depot_id, driver_id, name, tour_date) values ($1, $2, $3, $4, 'BRE-01', current_date)`, [
    tourA3,
    ids.orgJarbou,
    depotA2,
    drvRowA3,
  ]);
  await db.query(
    `insert into stops (id, organization_id, tour_id, depot_id, sequence, street, postal_code, city, type) values ($1, $2, null, $3, 0, 'Hafenstraße', '28197', 'Bremen', 'pickup')`,
    [unassignedA2, ids.orgJarbou, depotA2],
  );
  // The dispatcher of JARBOU is limited to the original depot (A).
  // This suite's dispatcher works for depot A only (not the harness's company-wide grant).
  await db.query(`update memberships set all_locations = false where organization_id = $1 and user_id = $2`, [ids.orgJarbou, ids.dispatcherA]);
  await db.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1, $2, $3)`, [
    ids.orgJarbou,
    await membershipId(ids.dispatcherA),
    ids.depotA,
  ]);
});

describe("depot-scoped dispatch access", () => {
  it("owners see every depot of their company, including unassigned stops", async () => {
    await asUser(db, ids.ownerA, async () => {
      expect(await count("select * from depots")).toBe(2);
      expect(await count("select * from tours")).toBe(3);
      expect(await count("select * from stops where tour_id is null")).toBe(1);
    });
  });

  it("a scoped dispatcher only sees and changes their depots", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from depots")).toBe(1);
      expect(await count("select * from tours where depot_id = $1", [depotA2])).toBe(0);
      expect(await count("select * from drivers where depot_id = $1", [depotA2])).toBe(0);
      expect(await count("select * from stops where tour_id is null")).toBe(0);
      const upd = await db.query(`update tours set name = 'x' where id = $1`, [tourA3]);
      expect(upd.affectedRows ?? 0).toBe(0);
      await expect(
        db.query(`insert into tours (organization_id, depot_id, name, tour_date) values ($1, $2, 'sneaky', current_date)`, [ids.orgJarbou, depotA2]),
      ).rejects.toThrow(/row-level security/);
      await expect(db.query(`select driver_set_tour_status($1, 'in_progress')`, [tourA3])).rejects.toThrow(/tour not found/);
      // Own depot still works.
      expect(await count("select * from tours where depot_id = $1", [ids.depotA])).toBe(2);
    });
  });

  it("removing a dispatcher's last location removes access – it never widens to the whole company", async () => {
    await db.query(`delete from membership_depots`);
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from tours")).toBe(0);
      expect(await count("select * from stops")).toBe(0);
      expect(await count("select * from drivers")).toBe(0);
      expect(await count("select * from vehicles")).toBe(0);
      expect(await count("select * from depots")).toBe(0);
    });
  });

  it("deleting the dispatcher's only depot (assignment cascades away) also removes access", async () => {
    await db.query(`delete from membership_depots where depot_id <> $1`, [ids.depotA]);
    await db.query(`delete from tours where depot_id = $1`, [ids.depotA]);
    await db.query(`delete from drivers where depot_id = $1`, [ids.depotA]);
    await db.query(`delete from vehicles where depot_id = $1`, [ids.depotA]);
    await db.query(`delete from depots where id = $1`, [ids.depotA]);
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from tours")).toBe(0); // Bremen's BRE-01 stays invisible
      expect(await count("select * from stops")).toBe(0);
    });
  });

  it("company-wide access only with all_locations, which only an admin can grant", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      const own = await db.query(`update memberships set all_locations = true where user_id = $1`, [ids.dispatcherA]);
      expect(own.affectedRows ?? 0).toBe(0);
    });
    await asUser(db, ids.ownerA, async () => {
      await db.query(`update memberships set all_locations = true where user_id = $1 and organization_id = $2`, [ids.dispatcherA, ids.orgJarbou]);
    });
    await db.query(`delete from membership_depots`);
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from tours")).toBe(3);
    });
  });

  it("dispatchers cannot widen their own scope", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from membership_depots")).toBe(1); // can read own scope
      await expect(
        db.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1, $2, $3)`, [
          ids.orgJarbou,
          await (async () => (await db.query<{ id: string }>(`select id from memberships where user_id = $1`, [ids.dispatcherA])).rows[0]!.id)(),
          depotA2,
        ]),
      ).rejects.toThrow(/row-level security/);
      const del = await db.query(`delete from membership_depots`);
      expect(del.affectedRows ?? 0).toBe(0);
    });
  });

  it("depot scope cannot reference another tenant's depot", async () => {
    await expect(
      db.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1, $2, $3)`, [
        ids.orgJarbou,
        await membershipId(ids.dispatcherA),
        ids.depotB,
      ]),
    ).rejects.toThrow(/foreign key/);
  });

  it("company-level access never reaches another tenant", async () => {
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from tours where organization_id = $1", [ids.orgJarbou])).toBe(0);
      expect(await count("select * from stops where tour_id is null")).toBe(0);
    });
  });

  it("drivers still see only their own tour and its depot", async () => {
    await asUser(db, ids.driverA1, async () => {
      expect(await count("select * from tours")).toBe(1);
      expect(await count("select * from depots")).toBe(1);
      expect(await count("select * from stops where tour_id is null")).toBe(0);
    });
  });

  it("unassigned stops must have a depot and stay pending", async () => {
    await expect(
      db.query(`insert into stops (organization_id, tour_id, depot_id, sequence, street, postal_code, city) values ($1, null, null, 0, 'X', '1', 'Y')`, [ids.orgJarbou]),
    ).rejects.toThrow(/stops_tour_or_depot/);
    await expect(db.query(`update stops set status = 'delivered' where id = $1`, [unassignedA2])).rejects.toThrow(/stops_unassigned_pending/);
  });
});
