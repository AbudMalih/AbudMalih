import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../supabase/migrations");

let snapshot: Blob | File | null = null;

/** Fresh database with migrations applied and synthetic tenants seeded (snapshot-cached per test file). */
export async function createSeededDb(): Promise<PGlite> {
  if (!snapshot) {
    const db = await createDb();
    await seed(db);
    snapshot = await db.dumpDataDir("none");
    await db.close();
  }
  return PGlite.create({ loadDataDir: snapshot });
}

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(import.meta.dirname, "supabase-stubs.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Run `fn` as an authenticated Supabase user (RLS applies), then reset to the superuser. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

export const ids = {
  // Tenants (synthetic)
  orgJarbou: "00000000-0000-4000-8000-00000000a001",
  orgOther: "00000000-0000-4000-8000-00000000b001",
  // Users
  ownerA: "00000000-0000-4000-8000-0000000000a1",
  dispatcherA: "00000000-0000-4000-8000-0000000000a2",
  driverA1: "00000000-0000-4000-8000-0000000000a3",
  driverA2: "00000000-0000-4000-8000-0000000000a4",
  ownerB: "00000000-0000-4000-8000-0000000000b1",
  driverB: "00000000-0000-4000-8000-0000000000b3",
  platformAdmin: "00000000-0000-4000-8000-0000000000f1",
  outsider: "00000000-0000-4000-8000-0000000000e1",
  // Rows
  depotA: "00000000-0000-4000-8000-0000000d00a1",
  depotB: "00000000-0000-4000-8000-0000000d00b1",
  drvRowA1: "00000000-0000-4000-8000-0000000100a1",
  drvRowA2: "00000000-0000-4000-8000-0000000100a2",
  drvRowB: "00000000-0000-4000-8000-0000000100b1",
  tourA1: "00000000-0000-4000-8000-0000000700a1",
  tourA2: "00000000-0000-4000-8000-0000000700a2",
  tourB: "00000000-0000-4000-8000-0000000700b1",
  stopA1: "00000000-0000-4000-8000-0000000500a1",
  stopA2: "00000000-0000-4000-8000-0000000500a2",
  stopB: "00000000-0000-4000-8000-0000000500b1",
} as const;

/** Two synthetic tenants seeded as superuser (equivalent to the backend's service role). */
export async function seed(db: PGlite) {
  const i = ids;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${i.ownerA}', 'owner@jarbou.example'), ('${i.dispatcherA}', 'dispatch@jarbou.example'),
      ('${i.driverA1}', 'driver1@jarbou.example'), ('${i.driverA2}', 'driver2@jarbou.example'),
      ('${i.ownerB}', 'owner@other.example'), ('${i.driverB}', 'driver@other.example'),
      ('${i.platformAdmin}', 'ops@turvio.example'), ('${i.outsider}', 'nobody@example.com');
    insert into public.platform_admins (user_id) values ('${i.platformAdmin}');
    insert into public.organizations (id, name, slug, status) values
      ('${i.orgJarbou}', 'JARBOU Logistik GmbH (synthetic)', 'jarbou', 'active'),
      ('${i.orgOther}', 'Muster Kurier GmbH (synthetic)', 'muster-kurier', 'trialing');
    insert into public.subscriptions (organization_id, plan_code, status, seats, trial_ends_at) values
      ('${i.orgJarbou}', 'business', 'active', 3, null),
      ('${i.orgOther}', 'team', 'trialing', 2, now() + interval '14 days');
    insert into public.memberships (organization_id, user_id, role) values
      ('${i.orgJarbou}', '${i.ownerA}', 'owner'), ('${i.orgJarbou}', '${i.dispatcherA}', 'dispatcher'),
      ('${i.orgJarbou}', '${i.driverA1}', 'driver'), ('${i.orgJarbou}', '${i.driverA2}', 'driver'),
      ('${i.orgOther}', '${i.ownerB}', 'owner'), ('${i.orgOther}', '${i.driverB}', 'driver');
    insert into public.depots (id, organization_id, name, street, postal_code, city, lat, lng) values
      ('${i.depotA}', '${i.orgJarbou}', 'Depot Erfurt Nord', 'Am Synthetikpark', '99087', 'Erfurt', 51.0095, 11.0405),
      ('${i.depotB}', '${i.orgOther}', 'Depot Leipzig', 'Musterweg', '04109', 'Leipzig', 51.34, 12.37);
    insert into public.drivers (id, organization_id, user_id, depot_id, display_name) values
      ('${i.drvRowA1}', '${i.orgJarbou}', '${i.driverA1}', '${i.depotA}', 'Lena Hoffmann'),
      ('${i.drvRowA2}', '${i.orgJarbou}', '${i.driverA2}', '${i.depotA}', 'Mihai Popescu'),
      ('${i.drvRowB}', '${i.orgOther}', '${i.driverB}', '${i.depotB}', 'Erika Muster');
    insert into public.tours (id, organization_id, depot_id, driver_id, name, tour_date) values
      ('${i.tourA1}', '${i.orgJarbou}', '${i.depotA}', '${i.drvRowA1}', 'Erfurt A', current_date),
      ('${i.tourA2}', '${i.orgJarbou}', '${i.depotA}', '${i.drvRowA2}', 'Erfurt B', current_date),
      ('${i.tourB}', '${i.orgOther}', '${i.depotB}', '${i.drvRowB}', 'Leipzig 1', current_date);
    insert into public.stops (id, organization_id, tour_id, sequence, recipient_name, street, postal_code, city, lat, lng) values
      ('${i.stopA1}', '${i.orgJarbou}', '${i.tourA1}', 0, 'Anna Krüger', 'Anger', '99084', 'Erfurt', 50.9762, 11.0329),
      ('${i.stopA2}', '${i.orgJarbou}', '${i.tourA2}', 0, 'Klaus Richter', 'Nordhäuser Straße', '99089', 'Erfurt', 50.9918, 11.0151),
      ('${i.stopB}', '${i.orgOther}', '${i.tourB}', 0, 'Max Muster', 'Musterstraße', '04109', 'Leipzig', 51.34, 12.37);
    insert into public.parcels (organization_id, stop_id, tracking_number) values
      ('${i.orgJarbou}', '${i.stopA1}', 'TVO4100000DE'), ('${i.orgOther}', '${i.stopB}', 'TVO9900000DE');
  `);
}
