import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

/** Migration *_driver_execution.sql: outcomes, idempotent offline sync, scans, personal routes, proofs, double-booking. */
let db: PGlite;
const ev = (n: number) => `00000000-0000-4000-8000-00000000e${String(n).padStart(3, "0")}`;
const status = async (id: string) =>
  (await db.query<{ status: string; failure_reason: string | null; driver_notes: string | null }>(`select status, failure_reason, driver_notes from stops where id = $1`, [id])).rows[0]!;
const setStatus = (stop: string, st: string, reason: string | null = null, eventId: string | null = null, at: string | null = null, notes: string | null = null) =>
  db.query(`select driver_set_stop_status($1, $2::stop_status, $3, $4, $5::uuid, $6::timestamptz)`, [stop, st, notes, reason, eventId, at]);

beforeEach(async () => {
  db = await createSeededDb();
});

describe("stop outcomes", () => {
  it("records arrival, requires a valid failure reason and allows reopening", async () => {
    await asUser(db, ids.driverA1, async () => {
      await setStatus(ids.stopA1, "in_progress");
      expect((await status(ids.stopA1)).status).toBe("in_progress");
      await expect(setStatus(ids.stopA1, "failed")).rejects.toThrow(/failure reason/);
      await expect(setStatus(ids.stopA1, "attempted", "made_up_reason")).rejects.toThrow(/failure reason/);
      await setStatus(ids.stopA1, "attempted", "recipient_absent", null, null, "Neighbour not home either");
      expect(await status(ids.stopA1)).toEqual({ status: "attempted", failure_reason: "recipient_absent", driver_notes: "Neighbour not home either" });
      await expect(setStatus(ids.stopA1, "delivered")).rejects.toThrow(/invalid status transition/);
      await setStatus(ids.stopA1, "pending");
      await setStatus(ids.stopA1, "delivered");
      expect(await status(ids.stopA1)).toMatchObject({ status: "delivered", failure_reason: null });
    });
  });

  it("uses the organization's configured failure reasons", async () => {
    await db.query(`update organizations set driver_settings = '{"failureReasons":[{"code":"gate_locked"}]}' where id = $1`, [ids.orgJarbou]);
    await asUser(db, ids.driverA1, async () => {
      await expect(setStatus(ids.stopA1, "failed", "recipient_absent")).rejects.toThrow(/failure reason/);
      await setStatus(ids.stopA1, "failed", "gate_locked");
    });
  });

  it("is idempotent for retried offline submissions and ignores stale updates", async () => {
    await asUser(db, ids.driverA1, async () => {
      await setStatus(ids.stopA1, "delivered", null, ev(1), new Date(Date.now() - 60_000).toISOString());
      await setStatus(ids.stopA1, "delivered", null, ev(1)); // retry of the same action
      // An older action that was queued on another device arrives late: recorded, not applied.
      await setStatus(ids.stopA1, "failed", "refused", ev(2), new Date(Date.now() - 600_000).toISOString());
    });
    expect((await status(ids.stopA1)).status).toBe("delivered");
    const events = (await db.query<{ status: string; applied: boolean }>(`select status, applied from stop_events where stop_id = $1 order by id`, [ids.stopA1])).rows;
    expect(events).toEqual([
      { status: "delivered", applied: true },
      { status: "failed", applied: false },
    ]);
  });

  it("refuses other drivers, other tenants and unpublished tours", async () => {
    await asUser(db, ids.driverA2, async () => {
      await expect(setStatus(ids.stopA1, "delivered")).rejects.toThrow(/stop not found/);
    });
    await asUser(db, ids.driverB, async () => {
      await expect(setStatus(ids.stopA1, "delivered")).rejects.toThrow(/stop not found/);
      await expect(db.query(`select driver_add_stop_note($1, 'x')`, [ids.stopA1])).rejects.toThrow(/stop not found/);
    });
    await db.query(`update tours set published_at = null where id = $1`, [ids.tourA1]);
    await asUser(db, ids.driverA1, async () => {
      await expect(setStatus(ids.stopA1, "delivered")).rejects.toThrow(/stop not found/);
    });
  });

  it("stores driver notes idempotently", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_add_stop_note($1, ' Gate code 4711 ', $2)`, [ids.stopA1, ev(3)]);
      await db.query(`select driver_add_stop_note($1, ' Gate code 4711 ', $2)`, [ids.stopA1, ev(3)]);
    });
    expect((await status(ids.stopA1)).driver_notes).toBe("Gate code 4711");
    expect(Number((await db.query<{ n: number }>(`select count(*)::int n from stop_events where kind = 'note'`)).rows[0]!.n)).toBe(1);
  });
});

describe("parcel scans", () => {
  it("marks the tour's parcels as loaded and reports unknown codes", async () => {
    const r = await asUser(db, ids.driverA1, async () =>
      (await db.query<{ r: { matched: string[]; unknown: string[] } }>(`select driver_record_scans($1, $2::jsonb) as r`, [ids.tourA1, JSON.stringify([{ code: "tvo4100000de" }, { code: "TVO9900000DE" }, { code: "TVO0000000NEW" }])])).rows[0]!.r,
    );
    expect(r).toEqual({ matched: ["TVO4100000DE"], unknown: ["TVO9900000DE", "TVO0000000NEW"] }); // other tenant's parcel is unknown here
    const loaded = (await db.query<{ loaded_at: string | null; tracking_number: string }>(`select tracking_number, loaded_at from parcels order by tracking_number`)).rows;
    expect(loaded.find((p) => p.tracking_number === "TVO4100000DE")!.loaded_at).not.toBeNull();
    expect(loaded.find((p) => p.tracking_number === "TVO9900000DE")!.loaded_at).toBeNull();
    await asUser(db, ids.driverA2, async () => {
      await expect(db.query(`select driver_record_scans($1, '[]'::jsonb)`, [ids.tourA1])).rejects.toThrow(/tour not found/);
    });
  });
});

describe("personal routes", () => {
  const own = "00000000-0000-4000-8000-0000000700f1";
  it("lets a driver create an own route in their depot, idempotently, visible to the depot's dispatcher", async () => {
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_create_tour($1, 'Extra round', current_date)`, [own]);
      await db.query(`select driver_create_tour($1, 'Extra round', current_date)`, [own]); // retry
      const t = (await db.query<{ origin: string; depot_id: string; published_at: string | null }>(`select origin, depot_id, published_at from tours where id = $1`, [own])).rows[0]!;
      expect(t).toMatchObject({ origin: "driver", depot_id: ids.depotA });
      expect(t.published_at).not.toBeNull();
      // and add stops to it (existing driver insert policy)
      await db.query(`insert into stops (organization_id, tour_id, sequence, street, postal_code, city) values ($1, $2, 0, 'Weg', '99084', 'Erfurt')`, [ids.orgJarbou, own]);
    });
    await asUser(db, ids.dispatcherA, async () => {
      expect((await db.query(`select 1 from tours where id = $1`, [own])).rows).toHaveLength(1);
    });
    await asUser(db, ids.driverA2, async () => {
      await expect(db.query(`select driver_create_tour($1, 'Hijack', current_date)`, [own])).rejects.toThrow(/already in use/);
    });
    await asUser(db, ids.ownerA, async () => {
      await expect(db.query(`select driver_create_tour($1, 'x', current_date)`, ["00000000-0000-4000-8000-0000000700f2"])).rejects.toThrow(/no active driver profile/);
    });
  });
});

describe("double-booking protection in the database", () => {
  it("allows only one open dispatch tour per driver and vehicle per day", async () => {
    await db.query(`insert into vehicles (id, organization_id, depot_id, label, license_plate) values ('00000000-0000-4000-8000-0000000600a1', $1, $2, 'Van', 'EF-T 1')`, [ids.orgJarbou, ids.depotA]);
    await asUser(db, ids.ownerA, async () => {
      // tourA1 already belongs to driver A1 today
      await expect(db.query(`insert into tours (organization_id, depot_id, driver_id, name, tour_date) values ($1, $2, $3, 'Second', current_date)`, [ids.orgJarbou, ids.depotA, ids.drvRowA1])).rejects.toThrow(
        /tours_driver_day_open_uidx/,
      );
      await db.query(`update tours set vehicle_id = '00000000-0000-4000-8000-0000000600a1' where id = $1`, [ids.tourA1]);
      await expect(db.query(`update tours set vehicle_id = '00000000-0000-4000-8000-0000000600a1' where id = $1`, [ids.tourA2])).rejects.toThrow(/tours_vehicle_day_open_uidx/);
      // once the first tour is completed, the driver can take another one
      await db.query(`update tours set status = 'completed' where id = $1`, [ids.tourA1]);
      await db.query(`insert into tours (organization_id, depot_id, driver_id, name, tour_date) values ($1, $2, $3, 'Second', current_date)`, [ids.orgJarbou, ids.depotA, ids.drvRowA1]);
    });
  });
});

describe("proof of delivery records", () => {
  const proof = (id: string, stop: string, org = ids.orgJarbou) =>
    db.query(`insert into proofs (id, organization_id, stop_id, kind, storage_path, recipient_name) values ($1::uuid, $2::uuid, $3::uuid, 'signature', $2::text || '/' || $3::text || '/' || $1::text || '.svg', 'E. Beispiel')`, [id, org, stop]);
  const p1 = "00000000-0000-4000-8000-00000000c001";

  it("only the assigned driver can add proofs; other tenants cannot see them; admins delete and the file is queued", async () => {
    await asUser(db, ids.driverA1, () => proof(p1, ids.stopA1));
    await asUser(db, ids.driverA2, async () => {
      await expect(proof("00000000-0000-4000-8000-00000000c002", ids.stopA1)).rejects.toThrow(/row-level security/);
      expect((await db.query(`select * from proofs`)).rows).toHaveLength(0);
    });
    await asUser(db, ids.ownerB, async () => {
      expect((await db.query(`select * from proofs`)).rows).toHaveLength(0);
      await expect(proof("00000000-0000-4000-8000-00000000c003", ids.stopA1)).rejects.toThrow(/row-level security/);
    });
    await asUser(db, ids.dispatcherA, async () => {
      expect((await db.query(`select * from proofs`)).rows).toHaveLength(1);
      expect((await db.query(`delete from proofs where id = $1`, [p1])).affectedRows ?? 0).toBe(0); // not an admin
    });
    await asUser(db, ids.ownerA, async () => {
      expect((await db.query(`delete from proofs where id = $1`, [p1])).affectedRows).toBe(1);
    });
    const queued = (await db.query<{ path: string }>(`select path from app.storage_deletions`)).rows;
    expect(queued).toEqual([{ path: `${ids.orgJarbou}/${ids.stopA1}/${p1}.svg` }]);
  });

  it("retention purge removes expired proofs and queues their files", async () => {
    await asUser(db, ids.driverA1, () => proof(p1, ids.stopA1));
    await db.query(`update proofs set created_at = now() - interval '400 days'`);
    await db.query(`select app.purge_expired_data()`);
    expect((await db.query(`select * from proofs`)).rows).toHaveLength(0);
    expect((await db.query(`select * from app.storage_deletions`)).rows).toHaveLength(1);
  });
});
