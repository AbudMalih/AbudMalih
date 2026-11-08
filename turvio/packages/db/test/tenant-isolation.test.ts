import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

let db: PGlite;

beforeEach(async () => {
  db = await createSeededDb();
});

const count = async (sql: string, params: unknown[] = []) =>
  Number(((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)).rows[0]!).n);

describe("tenant isolation (RLS)", () => {
  it("owners only see their own organization and its data", async () => {
    await asUser(db, ids.ownerA, async () => {
      expect(await count("select * from organizations")).toBe(1);
      expect(await count("select * from tours")).toBe(2);
      expect(await count("select * from stops")).toBe(2);
      expect(await count("select * from parcels")).toBe(1);
      expect(await count("select * from drivers")).toBe(2);
      expect(await count("select * from tours where organization_id = $1", [ids.orgOther])).toBe(0);
    });
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from tours")).toBe(1);
      expect(await count("select * from parcels where tracking_number = 'TVO4100000DE'")).toBe(0);
    });
  });

  it("users without membership see nothing", async () => {
    await asUser(db, ids.outsider, async () => {
      for (const table of ["organizations", "depots", "drivers", "tours", "stops", "parcels", "subscriptions", "audit_log"]) {
        expect(await count(`select * from ${table}`), table).toBe(0);
      }
    });
  });

  it("anon role has no table access at all", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from tours")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("cannot write rows into another tenant", async () => {
    await asUser(db, ids.ownerA, async () => {
      await expect(
        db.query(`insert into tours (organization_id, depot_id, name, tour_date) values ($1, $2, 'evil', current_date)`, [
          ids.orgOther,
          ids.depotB,
        ]),
      ).rejects.toThrow(/row-level security/);
      // Updates/deletes on foreign rows silently affect 0 rows.
      const upd = await db.query(`update tours set name = 'hijacked' where id = $1`, [ids.tourB]);
      expect(upd.affectedRows ?? 0).toBe(0);
      const del = await db.query(`delete from stops where id = $1`, [ids.stopB]);
      expect(del.affectedRows ?? 0).toBe(0);
    });
    const { rows } = await db.query<{ name: string }>(`select name from tours where id = $1`, [ids.tourB]);
    expect(rows[0]!.name).toBe("Leipzig 1");
  });

  it("composite foreign keys prevent referencing another tenant's driver or depot", async () => {
    await asUser(db, ids.ownerA, async () => {
      await expect(
        db.query(`insert into tours (organization_id, depot_id, driver_id, name, tour_date) values ($1, $2, $3, 'x', current_date + 1)`, [
          ids.orgJarbou,
          ids.depotA,
          ids.drvRowB,
        ]),
      ).rejects.toThrow(/foreign key/);
    });
  });

  it("drivers only see their own tours, stops and parcels", async () => {
    await asUser(db, ids.driverA1, async () => {
      expect(await count("select * from tours")).toBe(1);
      expect((await db.query<{ id: string }>("select id from stops")).rows.map((r) => r.id)).toEqual([ids.stopA1]);
      expect(await count("select * from parcels")).toBe(1);
      expect(await count("select * from drivers")).toBe(1);
      expect(await count("select * from audit_log")).toBe(0);
      expect(await count("select * from subscriptions")).toBe(0);
    });
  });

  it("drivers cannot update tours or stops directly", async () => {
    await asUser(db, ids.driverA1, async () => {
      const res = await db.query(`update stops set status = 'delivered' where id = $1`, [ids.stopA1]);
      expect(res.affectedRows ?? 0).toBe(0);
    });
  });

  it("drivers change stop status through the RPC, only for their own stops", async () => {
    await asUser(db, ids.driverA1, async () => {
      const { rows } = await db.query<{ status: string }>(`select (driver_set_stop_status($1, 'delivered', 'Briefkasten')).status`, [ids.stopA1]);
      expect(rows[0]!.status).toBe("delivered");
      await expect(db.query(`select driver_set_stop_status($1, 'failed')`, [ids.stopA1])).rejects.toThrow(/invalid status transition/);
      await expect(db.query(`select driver_set_stop_status($1, 'delivered')`, [ids.stopA2])).rejects.toThrow(/stop not found/);
      await expect(db.query(`select driver_set_stop_status($1, 'delivered')`, [ids.stopB])).rejects.toThrow(/stop not found/);
      expect(await count("select * from stop_events")).toBe(1);
    });
  });

  it("drivers can add stops to their own active tour but not to others", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(
        `insert into stops (organization_id, tour_id, sequence, street, postal_code, city) values ($1, $2, 1, 'Domplatz', '99084', 'Erfurt')`,
        [ids.orgJarbou, ids.tourA1],
      );
      await expect(
        db.query(`insert into stops (organization_id, tour_id, sequence, street, postal_code, city) values ($1, $2, 1, 'Domplatz', '99084', 'Erfurt')`, [
          ids.orgJarbou,
          ids.tourA2,
        ]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("tour status RPC enforces the state machine", async () => {
    await asUser(db, ids.driverA1, async () => {
      await expect(db.query(`select driver_set_tour_status($1, 'completed')`, [ids.tourA1])).rejects.toThrow(/invalid tour transition/);
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourA1]);
      await expect(db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourB])).rejects.toThrow(/tour not found/);
    });
  });

  it("location pings are only accepted for the driver's in-progress tour", async () => {
    // The direct insert path is closed: positions go through driver_record_locations only.
    await asUser(db, ids.driverA1, async () => {
      await expect(
        db.query(`insert into location_pings (organization_id, driver_id, tour_id, lat, lng) values ($1, $2, $3, 50.97, 11.03)`, [ids.orgJarbou, ids.drvRowA1, ids.tourA1]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("live tracking", () => {
  const at = (offsetSeconds: number) => new Date(Date.now() + offsetSeconds * 1000).toISOString();
  let n = 0;
  const point = (offsetSeconds: number, extra: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`,
    lat: 50.97,
    lng: 11.03,
    accuracy: 8,
    speed: 9.5,
    heading: 90,
    recordedAt: at(offsetSeconds),
    ...extra,
  });
  const record = (tour: string, points: unknown[]) =>
    db.query<{ r: { accepted: number; duplicates: number; rejected: { id: string; reason: string }[] } }>(`select driver_record_locations($1, $2::jsonb) as r`, [tour, JSON.stringify(points)]).then((x) => x.rows[0]!.r);

  it("is off by default and requires the driver's acknowledgement of the notice", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourA1]);
      await expect(record(ids.tourA1, [point(0)])).rejects.toThrow(/tracking_disabled/);
    });
    await db.query(`update organizations set tracking_mode = 'active_tours' where id = $1`, [ids.orgJarbou]);
    await asUser(db, ids.driverA1, async () => {
      await expect(record(ids.tourA1, [point(0)])).rejects.toThrow(/tracking_notice_required/);
      expect((await db.query<{ v: number }>(`select driver_ack_tracking_notice($1) as v`, [ids.orgJarbou])).rows[0]!.v).toBe(1);
      expect((await record(ids.tourA1, [point(0)])).accepted).toBe(1);
    });
    // A new notice version needs a new acknowledgement.
    await db.query(`update organizations set tracking_notice_version = 2 where id = $1`, [ids.orgJarbou]);
    await asUser(db, ids.driverA1, async () => {
      await expect(record(ids.tourA1, [point(1)])).rejects.toThrow(/tracking_notice_required/);
    });
  });

  it("accepts only valid points inside driving periods, idempotently, and isolates tenants", async () => {
    await db.query(`update organizations set tracking_mode = 'active_tours' where id in ($1, $2)`, [ids.orgJarbou, ids.orgOther]);
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_ack_tracking_notice($1)`, [ids.orgJarbou]);
      // Planned tour: nothing is recorded.
      expect((await record(ids.tourA1, [point(0)])).rejected[0]!.reason).toBe("outside_active_tour");
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourA1]);
    });
    // Pretend the tour started 10 minutes ago.
    await db.query(`update tour_events set created_at = now() - interval '10 minutes' where tour_id = $1 and kind = 'started'`, [ids.tourA1]);
    await asUser(db, ids.driverA1, async () => {
      const first = point(-60);
      const r = await record(ids.tourA1, [
        first,
        point(-30),
        point(-20 * 60), // before the start
        point(600), // 10 minutes in the future
        point(0, { lat: 123 }), // invalid
        point(0, { recordedAt: "not a date" }),
      ]);
      expect(r.accepted).toBe(2);
      expect(r.rejected.map((x) => x.reason).sort()).toEqual(["future_timestamp", "invalid", "malformed", "outside_active_tour"]);
      // Retried upload of the same point: no duplicate.
      expect(await record(ids.tourA1, [first])).toMatchObject({ accepted: 0, duplicates: 1 });
      // The driver sees the own live position but not the history.
      expect(await count("select * from driver_positions")).toBe(1);
      expect(await count("select * from location_pings")).toBe(0);
    });
    await asUser(db, ids.driverA2, async () => {
      await expect(record(ids.tourA1, [point(0)])).rejects.toThrow(/tour not found/);
      expect(await count("select * from driver_positions")).toBe(0);
    });
    await asUser(db, ids.dispatcherA, async () => {
      expect(await count("select * from location_pings")).toBe(2);
      expect(await count("select * from driver_positions")).toBe(1);
    });
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from location_pings")).toBe(0);
      expect(await count("select * from driver_positions")).toBe(0);
    });
    // Nobody can write the tables directly.
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`delete from driver_positions`)).rejects.toThrow(/permission denied/);
    });
  });

  it("keeps buffered points from before a pause, rejects points after it, clears the live position on completion", async () => {
    await db.query(`update organizations set tracking_mode = 'active_tours' where id = $1`, [ids.orgJarbou]);
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_ack_tracking_notice($1)`, [ids.orgJarbou]);
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourA1]);
    });
    await db.query(`update tour_events set created_at = now() - interval '10 minutes' where tour_id = $1 and kind = 'started'`, [ids.tourA1]);
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_set_tour_status($1, 'paused')`, [ids.tourA1]);
      // Uploaded after the pause, recorded before it (offline buffer): kept. Recorded after it: refused.
      const r = await record(ids.tourA1, [point(-5 * 60), point(90)]);
      expect(r.accepted).toBe(1);
      expect(r.rejected.map((x) => x.reason)).toEqual(["outside_active_tour"]);
      // Paused tour: the live position does not move.
      expect(await count("select * from driver_positions")).toBe(0);
      await db.query(`select driver_set_tour_status($1, 'in_progress')`, [ids.tourA1]);
      expect((await record(ids.tourA1, [point(1)])).accepted).toBe(1);
      expect(await count("select * from driver_positions")).toBe(1);
      await db.query(`select driver_set_tour_status($1, 'completed')`, [ids.tourA1]);
      expect(await count("select * from driver_positions")).toBe(0);
    });
  });
});

describe("roles", () => {
  it("dispatchers manage tours but cannot manage depots, memberships or read the audit log", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`update tours set name = 'Erfurt A (neu)' where id = $1`, [ids.tourA1]);
      await expect(
        db.query(`insert into depots (organization_id, name, street, postal_code, city, lat, lng) values ($1, 'X', 'Y', '99084', 'Erfurt', 50.9, 11)`, [
          ids.orgJarbou,
        ]),
      ).rejects.toThrow(/row-level security/);
      await expect(
        db.query(`insert into memberships (organization_id, user_id, role) values ($1, $2, 'admin')`, [ids.orgJarbou, ids.outsider]),
      ).rejects.toThrow(/row-level security/);
      expect(await count("select * from audit_log")).toBe(0);
    });
  });

  it("admins cannot grant the owner role; owners can", async () => {
    await db.query(`update memberships set role = 'admin' where user_id = $1`, [ids.dispatcherA]);
    await asUser(db, ids.dispatcherA, async () => {
      await expect(
        db.query(`insert into memberships (organization_id, user_id, role) values ($1, $2, 'owner')`, [ids.orgJarbou, ids.outsider]),
      ).rejects.toThrow(/row-level security/);
      await db.query(`insert into memberships (organization_id, user_id, role) values ($1, $2, 'dispatcher')`, [ids.orgJarbou, ids.outsider]);
    });
    await asUser(db, ids.ownerA, async () => {
      await db.query(`update memberships set role = 'owner' where user_id = $1 and organization_id = $2`, [ids.outsider, ids.orgJarbou]);
    });
  });

  it("platform admins see all tenants and subscriptions", async () => {
    await asUser(db, ids.platformAdmin, async () => {
      expect(await count("select * from organizations")).toBe(2);
      expect(await count("select * from subscriptions")).toBe(2);
      // ...but not operational data (no tenant membership).
      expect(await count("select * from stops")).toBe(0);
    });
  });

  it("suspended organizations lose access", async () => {
    await db.query(`update organizations set status = 'suspended' where id = $1`, [ids.orgJarbou]);
    await asUser(db, ids.ownerA, async () => {
      expect(await count("select * from tours")).toBe(0);
    });
  });

  it("tenants cannot change their own subscription", async () => {
    await asUser(db, ids.ownerA, async () => {
      expect(await count("select * from subscriptions")).toBe(1);
      const res = await db.query(`update subscriptions set seats = 500 where organization_id = $1`, [ids.orgJarbou]);
      expect(res.affectedRows ?? 0).toBe(0);
    });
  });
});

describe("subscription limits", () => {
  const addDriver = (org: string, name: string) =>
    db.query(`insert into drivers (organization_id, display_name) values ($1, $2)`, [org, name]);

  it("per-driver seats limit active drivers", async () => {
    await addDriver(ids.orgJarbou, "Third"); // 3 seats
    await expect(addDriver(ids.orgJarbou, "Fourth")).rejects.toThrow(/plan limit max_drivers reached/);
    // Inactive drivers do not count.
    await db.query(`insert into drivers (organization_id, display_name, active) values ($1, 'Inactive', false)`, [ids.orgJarbou]);
  });

  it("limit overrides take precedence", async () => {
    await db.query(`update subscriptions set limit_overrides = '{"max_drivers": 5}' where organization_id = $1`, [ids.orgJarbou]);
    await addDriver(ids.orgJarbou, "Third");
    await addDriver(ids.orgJarbou, "Fourth");
    await addDriver(ids.orgJarbou, "Fifth");
    await expect(addDriver(ids.orgJarbou, "Sixth")).rejects.toThrow(/plan limit/);
  });

  it("expired trials block new resources", async () => {
    await db.query(`update subscriptions set trial_ends_at = now() - interval '1 day' where organization_id = $1`, [ids.orgOther]);
    await expect(addDriver(ids.orgOther, "Late")).rejects.toThrow(/subscription inactive/);
  });

  it("import duplicate check (find_planned_tracking): own organization only, case-insensitive, members only", async () => {
    const q = `select tracking_number, blocking, visible from public.find_planned_tracking($1, $2::text[])`;
    // Owner of JARBOU: finds its own parcel (any case), not the other company's.
    await asUser(db, ids.ownerA, async () => {
      const r = await db.query(q, [ids.orgJarbou, ["tvo4100000de", "TVO9900000DE", "NOPE"]]);
      expect(r.rows).toEqual([{ tracking_number: "TVO4100000DE", blocking: true, visible: true }]);
    });
    // A driver of JARBOU may check (driver import), the parcel is reported, the tour stays hidden if not theirs.
    await asUser(db, ids.driverA2, async () => {
      const r = await db.query<{ tracking_number: string; blocking: boolean }>(`select tracking_number, blocking from public.find_planned_tracking($1, $2::text[])`, [ids.orgJarbou, ["TVO4100000DE"]]);
      expect(r.rows).toEqual([{ tracking_number: "TVO4100000DE", blocking: true }]);
    });
    // The other company asking about JARBOU: refused. An outsider: refused.
    for (const u of [ids.ownerB, ids.outsider]) {
      await asUser(db, u, async () => {
        await expect(db.query(q, [ids.orgJarbou, ["TVO4100000DE"]])).rejects.toThrow(/not a member/);
      });
    }
    // Parcels have a company column under the same row-level security.
    await asUser(db, ids.ownerB, async () => {
      expect(await count(`select company from public.parcels where tracking_number = 'TVO4100000DE'`)).toBe(0);
    });
  });

  it("team plan limits depots", async () => {
    const addDepot = () =>
      db.query(`insert into depots (organization_id, name, street, postal_code, city, lat, lng) values ($1, 'D', 'S', '04109', 'Leipzig', 51.3, 12.3)`, [
        ids.orgOther,
      ]);
    await addDepot(); // 2nd depot allowed
    await expect(addDepot()).rejects.toThrow(/max_depots/);
  });
});

describe("audit and retention", () => {
  it("records who changed which columns without copying personal data", async () => {
    await asUser(db, ids.dispatcherA, async () => {
      await db.query(`update stops set recipient_name = 'Neu' where id = $1`, [ids.stopA1]);
    });
    const { rows } = await db.query<{ actor_user_id: string; changed_columns: string[]; organization_id: string }>(
      `select actor_user_id, changed_columns, organization_id from audit_log where table_name = 'stops' and action = 'update'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_user_id).toBe(ids.dispatcherA);
    expect(rows[0]!.organization_id).toBe(ids.orgJarbou);
    expect(rows[0]!.changed_columns).toEqual(["recipient_name"]);
    await asUser(db, ids.ownerB, async () => {
      expect(await count("select * from audit_log")).toBeGreaterThan(0); // own tenant's entries
      expect(await count("select * from audit_log where organization_id = $1", [ids.orgJarbou])).toBe(0);
    });
  });

  it("purges location pings older than the tenant's retention period", async () => {
    await db.query(`update tours set status = 'in_progress' where id = $1`, [ids.tourA1]);
    await db.query(
      `insert into location_pings (organization_id, driver_id, tour_id, lat, lng, recorded_at) values
        ($1, $2, $3, 50.9, 11.0, now() - interval '40 days'), ($1, $2, $3, 50.9, 11.0, now())`,
      [ids.orgJarbou, ids.drvRowA1, ids.tourA1],
    );
    await db.query(`select app.purge_expired_data()`);
    expect(await count("select * from location_pings")).toBe(1);
  });
});
