import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

/** Migration *_dispatch_persistence.sql: publishing, versions, sequencing, events, invitations, platform stats. */
let db: PGlite;
const draftTour = "00000000-0000-4000-8000-0000000700d1";
const s1 = "00000000-0000-4000-8000-0000000500d1";
const s2 = "00000000-0000-4000-8000-0000000500d2";
const s3 = "00000000-0000-4000-8000-0000000500d3";

const count = async (sql: string, params: unknown[] = []) =>
  Number(((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!).n);
const version = async (id: string) => (await db.query<{ version: number }>(`select version from tours where id = $1`, [id])).rows[0]!.version;

beforeEach(async () => {
  db = await createSeededDb();
  // An unpublished tour for driver A1 with three stops.
  await db.query(`insert into tours (id, organization_id, depot_id, driver_id, name, tour_date) values ($1, $2, $3, $4, 'Draft', current_date)`, [
    draftTour,
    ids.orgJarbou,
    ids.depotA,
    ids.drvRowA1,
  ]);
  for (const [i, id] of [s1, s2, s3].entries()) {
    await db.query(`insert into stops (id, organization_id, tour_id, sequence, street, postal_code, city, lat, lng) values ($1, $2, $3, $4, 'Weg', '30159', 'Hannover', 52.37, 9.73)`, [
      id,
      ids.orgJarbou,
      draftTour,
      i,
    ]);
  }
});

describe("publishing", () => {
  it("drivers do not see unpublished tours until dispatch publishes them", async () => {
    await asUser(db, ids.driverA1, async () => {
      expect(await count("select * from tours where id = $1", [draftTour])).toBe(0);
      expect(await count("select * from stops where tour_id = $1", [draftTour])).toBe(0);
    });
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`select publish_tour($1, $2)`, [draftTour, await version(draftTour)]);
    });
    await asUser(db, ids.driverA1, async () => {
      expect(await count("select * from tours where id = $1", [draftTour])).toBe(1);
      expect(await count("select * from stops where tour_id = $1", [draftTour])).toBe(3);
    });
  });

  it("rejects stale versions, tours without driver, and other tenants", async () => {
    const v = await version(draftTour);
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`select publish_tour($1, $2)`, [draftTour, v + 5])).rejects.toThrow(/version conflict/);
    });
    await db.query(`update tours set driver_id = null where id = $1`, [draftTour]);
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`select publish_tour($1, $2)`, [draftTour, await version(draftTour)])).rejects.toThrow(/assign a driver/);
    });
    await asUser(db, ids.ownerB, async () => {
      await expect(db.query(`select publish_tour($1, 1)`, [draftTour])).rejects.toThrow(/tour not found/);
    });
    const current = await version(draftTour);
    await asUser(db, ids.driverA1, async () => {
      await expect(db.query(`select publish_tour($1, $2)`, [draftTour, current])).rejects.toThrow(/tour not found/);
    });
  });

  it("bumps the version on every update and records events", async () => {
    const v = await version(draftTour);
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`update tours set vehicle_id = null, name = 'Renamed' where id = $1`, [draftTour]);
    });
    expect(await version(draftTour)).toBe(v + 1);
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`select publish_tour($1, $2)`, [draftTour, v + 1]);
    });
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [draftTour]);
    });
    const kinds = (await db.query<{ kind: string }>(`select kind from tour_events where tour_id = $1 order by id`, [draftTour])).rows.map((r) => r.kind);
    expect(kinds).toEqual(["created", "published", "started"]);
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from tour_events where tour_id = $1", [draftTour])).toBe(0);
    });
  });
});

describe("stop sequencing", () => {
  it("reorders pending stops, keeps completed ones first and stores optimization metadata", async () => {
    await db.query(`update stops set status = 'delivered' where id = $1`, [s2]);
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`select set_tour_sequence($1, $2::uuid[], $3::jsonb)`, [draftTour, [s3, s1], JSON.stringify({ engine: "test" })]);
    });
    const order = (await db.query<{ id: string }>(`select id from stops where tour_id = $1 order by sequence`, [draftTour])).rows.map((r) => r.id);
    expect(order).toEqual([s2, s3, s1]);
    expect((await db.query<{ optimization: { engine: string } }>(`select optimization from tours where id = $1`, [draftTour])).rows[0]!.optimization.engine).toBe("test");
  });

  it("refuses foreign or completed stops and unauthorized callers", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`select set_tour_sequence($1, $2::uuid[])`, [draftTour, [ids.stopB]])).rejects.toThrow(/not pending stops of this tour/);
    });
    await asUser(db, ids.driverA2, async () => {
      await expect(db.query(`select set_tour_sequence($1, $2::uuid[])`, [draftTour, [s1]])).rejects.toThrow(/tour not found/);
    });
    // Unpublished: even the assigned driver cannot reorder yet.
    await asUser(db, ids.driverA1, async () => {
      await expect(db.query(`select set_tour_sequence($1, $2::uuid[])`, [draftTour, [s1]])).rejects.toThrow(/tour not found/);
    });
  });
});

describe("cross-company assignment", () => {
  it("cannot assign another company's driver or vehicle to a tour", async () => {
    await asUser(db, ids.ownerA, async () => {
      await expect(db.query(`update tours set driver_id = $1 where id = $2`, [ids.drvRowB, draftTour])).rejects.toThrow(/foreign key/);
    });
  });
});

describe("invitations", () => {
  it("lets admins invite, dispatchers invite only drivers, and the service accept", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      await expect(
        db.query(`insert into invitations (organization_id, email, role, token_hash) values ($1, 'x@example.test', 'admin', 'h1')`, [ids.orgJarbou]),
      ).rejects.toThrow(/row-level security/);
      await db.query(`insert into invitations (organization_id, email, role, token_hash, driver_id) values ($1, 'driver.new@example.test', 'driver', 'h2', $2)`, [
        ids.orgJarbou,
        ids.drvRowA2,
      ]);
    });
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from invitations")).toBe(0);
    });
    // Accept as the service (superuser in tests), for a user with the invited email.
    const user = "00000000-0000-4000-8000-0000000000a9";
    await db.query(`insert into auth.users (id, email) values ($1, 'Driver.New@example.test')`, [user]);
    await db.query(`select app.accept_invitation('h2', $1)`, [user]);
    expect(await count(`select * from memberships where user_id = $1 and role = 'driver'`, [user])).toBe(1);
    expect((await db.query<{ user_id: string }>(`select user_id from drivers where id = $1`, [ids.drvRowA2])).rows[0]!.user_id).toBe(user);
    await expect(db.query(`select app.accept_invitation('h2', $1)`, [user])).rejects.toThrow(/invalid or expired/);
  });

  it("refuses acceptance by a different email and blocks end users from calling it", async () => {
    await db.query(`insert into invitations (organization_id, email, role, token_hash) values ($1, 'a@example.test', 'dispatcher', 'h3')`, [ids.orgJarbou]);
    await expect(db.query(`select app.accept_invitation('h3', $1)`, [ids.outsider])).rejects.toThrow(/different email/);
    await asUser(db, ids.outsider, async () => {
      await expect(db.query(`select app.accept_invitation('h3', $1)`, [ids.outsider])).rejects.toThrow(/permission denied/);
    });
  });
});

describe("platform statistics", () => {
  it("returns aggregates to platform admins only, without delivery rows", async () => {
    await asUser(db, ids.platformAdmin, async () => {
      const rows = (await db.query<{ organization_id: string; active_drivers: number }>(`select * from platform_tenant_stats()`)).rows;
      expect(rows.find((r) => r.organization_id === ids.orgJarbou)!.active_drivers).toBe(2);
      expect(await count("select * from stops")).toBe(0);
    });
    await asUser(db, ids.ownerA, async () => {
      await expect(db.query(`select * from platform_tenant_stats()`)).rejects.toThrow(/platform admins only/);
    });
  });
});
