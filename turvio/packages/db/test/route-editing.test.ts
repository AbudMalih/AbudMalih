import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

let db: PGlite;
const extra = "00000000-0000-4000-8000-0000000500e1";
beforeEach(async () => {
  db = await createSeededDb();
  await db.query(`insert into stops (id, organization_id, tour_id, sequence, street, postal_code, city, lat, lng) values ($1, $2, $3, 1, 'Anger', '99084', 'Erfurt', 50.9762, 11.0329)`, [extra, ids.orgJarbou, ids.tourA1]);
  await db.query(`insert into parcels (organization_id, stop_id, tracking_number) values ($1, $2, 'TVO-EXTRA-1'), ($1, $2, 'TVO-EXTRA-2')`, [ids.orgJarbou, extra]);
});
const stop = async (id: string) => (await db.query<{ street: string; lat: number | null; location_source: string | null }>(`select street, lat, location_source from stops where id = $1`, [id])).rows[0];

describe("route editing", () => {
  it("an address correction clears the old coordinates unless new ones are given", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_edit_stop($1, 'Anna K.', 'Domplatz', '3', '99084', 'Erfurt')`, [ids.stopA1]);
    });
    expect(await stop(ids.stopA1)).toEqual({ street: "Domplatz", lat: null, location_source: null });
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_edit_stop($1, null, 'Domplatz', '3', '99084', 'Erfurt', 50.977, 11.023, 'geocoder')`, [ids.stopA1]);
    });
    expect(await stop(ids.stopA1)).toEqual({ street: "Domplatz", lat: 50.977, location_source: "geocoder" });
    // staff edits through the table are guarded by the same trigger; on a published tour they
    // need a reason (P0-3.2, D4)
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`update stops set street = 'Fischmarkt' where id = $1`, [ids.stopA1])).rejects.toThrow(/reason is required/);
    });
    await asUser(db, ids.dispatcherA, async () => {
      // (the harness runs without a transaction: session-level setting, reset afterwards)
      await db.query(`select set_config('turvio.change_reason', 'Customer called: shop moved', false)`);
      await db.query(`update stops set street = 'Fischmarkt' where id = $1`, [ids.stopA1]);
      await db.query(`select set_config('turvio.change_reason', '', false)`);
    });
    expect((await stop(ids.stopA1))!.lat).toBeNull();
  });

  it("merging keeps every parcel and refuses foreign or closed stops", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select merge_stops($1, $2)`, [extra, ids.stopA1]);
    });
    const parcels = (await db.query<{ tracking_number: string }>(`select tracking_number from parcels where stop_id = $1 order by 1`, [ids.stopA1])).rows.map((r) => r.tracking_number);
    expect(parcels).toEqual(["TVO-EXTRA-1", "TVO-EXTRA-2", "TVO4100000DE"]);
    expect(await stop(extra)).toBeUndefined();
    await asUser(db, ids.driverA1, async () => {
      await expect(db.query(`select merge_stops($1, $2)`, [ids.stopA1, ids.stopA2])).rejects.toThrow(/stop not found/); // other driver's tour
    });
  });

  it("drivers remove stops only from personal routes; other tenants cannot touch anything", async () => {
    await asUser(db, ids.driverA1, async () => {
      await expect(db.query(`select driver_delete_stop($1)`, [extra])).rejects.toThrow(/removed by dispatch/);
    });
    await asUser(db, ids.driverB, async () => {
      await expect(db.query(`select driver_edit_stop($1, null, 'x', '1', '99084', 'Erfurt')`, [ids.stopA1])).rejects.toThrow(/stop not found/);
    });
    await db.query(`update tours set origin = 'driver' where id = $1`, [ids.tourA1]);
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_delete_stop($1)`, [extra]);
    });
    expect(await stop(extra)).toBeUndefined();
  });
});
