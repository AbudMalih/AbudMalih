import { createDispatchDataset, nowInZone } from "@turvio/shared";
import pg from "pg";
import { hashPassword } from "./auth/password";

/**
 * SYNTHETIC development/test data for a local database (AUTH_PROVIDER=local).
 * Fictional people and customers; `.test` email domains; made-up tracking
 * numbers. Never run against production.
 */

export const SEED_PASSWORD_DEFAULT = "Turvio-Demo-2026";

export const SEED_USERS = {
  platformAdmin: "ops@turvio.test",
  jarbouOwner: "owner@jarbou.test",
  dispatcherHannover: "dispatch.hannover@jarbou.test",
  dispatcherBremen: "dispatch.bremen@jarbou.test",
  driverHannover1: "lena.hoffmann@jarbou.test",
  driverHannover2: "mihai.popescu@jarbou.test",
  driverBremen1: "aylin.demir@jarbou.test",
  musterOwner: "owner@muster.test",
  musterDriver: "driver@muster.test",
} as const;

const DEPOTS = [
  { key: "hannover", name: "Hannover", street: "Logistikring", no: "12", postal: "30179", city: "Hannover", lat: 52.4189, lng: 9.7686 },
  { key: "bremen", name: "Bremen", street: "Logistikring", no: "60", postal: "28197", city: "Bremen", lat: 53.0921, lng: 8.7268 },
  { key: "kassel", name: "Kassel", street: "Logistikring", no: "33", postal: "34123", city: "Kassel", lat: 51.2954, lng: 9.5186 },
  { key: "haiger", name: "Haiger", street: "Logistikring", no: "7", postal: "35708", city: "Haiger", lat: 50.7517, lng: 8.1932 },
];

const DRIVERS: Record<string, string[]> = {
  hannover: ["Lena Hoffmann", "Mihai Popescu", "Samir Haddad", "Jonas Becker"],
  bremen: ["Aylin Demir", "Tobias Krüger", "Andrei Ionescu", "Nadia Benali"],
  kassel: ["Felix Wagner", "Olena Kovalenko", "Marco Rossi", "Sara Lindqvist"],
  haiger: ["Yusuf Aydın", "Katharina Braun", "Daniel Mayer", "Ioana Stan"],
};
const PLATES: Record<string, string> = { hannover: "H-JL", bremen: "HB-JL", kassel: "KS-JL", haiger: "LDK-JL" };

export interface SeedResult {
  orgs: { jarbou: string; muster: string };
  depots: Record<string, string>;
  drivers: Record<string, string[]>;
  vehicles: Record<string, string[]>;
  users: Record<keyof typeof SEED_USERS, string>;
}

async function user(c: pg.ClientBase, email: string, password: string, name: string): Promise<string> {
  const id = (await c.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0]!.id;
  await c.query(`insert into app_auth.credentials (user_id, password_hash, display_name) values ($1, $2, $3)`, [id, await hashPassword(password), name]);
  return id;
}

/** Seeds an EMPTY database (as a superuser connection). */
export async function seed(c: pg.ClientBase, opts: { password?: string; demoDay?: boolean; now?: Date } = {}): Promise<SeedResult> {
  const pw = opts.password ?? SEED_PASSWORD_DEFAULT;
  const U = SEED_USERS;
  const users = {} as SeedResult["users"];
  const names: Record<keyof typeof SEED_USERS, string> = {
    platformAdmin: "TURVIO Operations",
    jarbouOwner: "Karim Jarbou",
    dispatcherHannover: "Petra Lange",
    dispatcherBremen: "Jan Meyer",
    driverHannover1: "Lena Hoffmann",
    driverHannover2: "Mihai Popescu",
    driverBremen1: "Aylin Demir",
    musterOwner: "Erika Muster",
    musterDriver: "Max Muster",
  };
  for (const k of Object.keys(U) as (keyof typeof SEED_USERS)[]) users[k] = await user(c, U[k], pw, names[k]);
  await c.query(`insert into platform_admins (user_id) values ($1)`, [users.platformAdmin]);

  // Companies + subscriptions
  const jarbou = (await c.query<{ id: string }>(`insert into organizations (name, slug, status, time_zone) values ('JARBOU Logistik GmbH', 'jarbou', 'active', 'Europe/Berlin') returning id`)).rows[0]!.id;
  const muster = (await c.query<{ id: string }>(`insert into organizations (name, slug, status, time_zone) values ('Muster Kurier GmbH', 'muster-kurier', 'trialing', 'Europe/Berlin') returning id`)).rows[0]!.id;
  await c.query(`insert into subscriptions (organization_id, plan_code, status, seats) values ($1, 'business', 'active', 20)`, [jarbou]);
  await c.query(`insert into subscriptions (organization_id, plan_code, status, seats, trial_ends_at) values ($1, 'team', 'trialing', 3, now() + interval '14 days')`, [muster]);

  // JARBOU depots, drivers, vehicles
  const depots: Record<string, string> = {};
  const drivers: Record<string, string[]> = {};
  const vehicles: Record<string, string[]> = {};
  for (const d of DEPOTS) {
    depots[d.key] = (
      await c.query<{ id: string }>(`insert into depots (organization_id, name, street, house_number, postal_code, city, lat, lng) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [
        jarbou,
        d.name,
        d.street,
        d.no,
        d.postal,
        d.city,
        d.lat,
        d.lng,
      ])
    ).rows[0]!.id;
    drivers[d.key] = [];
    for (const [i, n] of DRIVERS[d.key]!.entries()) {
      drivers[d.key]!.push(
        (await c.query<{ id: string }>(`insert into drivers (organization_id, depot_id, display_name, max_shift_minutes) values ($1,$2,$3,$4) returning id`, [jarbou, depots[d.key], n, i === 3 ? 360 : 480])).rows[0]!.id,
      );
    }
    vehicles[d.key] = [];
    for (let i = 0; i < 4; i++) {
      vehicles[d.key]!.push(
        (
          await c.query<{ id: string }>(`insert into vehicles (organization_id, depot_id, label, license_plate, capacity_parcels) values ($1,$2,$3,$4,$5) returning id`, [
            jarbou,
            depots[d.key],
            i === 3 ? "eVan 4" : `Sprinter ${i + 1}`,
            `${PLATES[d.key]} ${i === 3 ? "4" : "1"}${String(DEPOTS.indexOf(d))}${i}${i === 3 ? "E" : ""}`,
            i === 3 ? 110 : 180,
          ])
        ).rows[0]!.id,
      );
    }
  }
  // Driver logins
  await c.query(`update drivers set user_id = $1 where id = $2`, [users.driverHannover1, drivers.hannover![0]]);
  await c.query(`update drivers set user_id = $1 where id = $2`, [users.driverHannover2, drivers.hannover![1]]);
  await c.query(`update drivers set user_id = $1 where id = $2`, [users.driverBremen1, drivers.bremen![0]]);

  // Memberships (+ depot scope for dispatchers)
  const member = async (org: string, uid: string, role: string) =>
    (await c.query<{ id: string }>(`insert into memberships (organization_id, user_id, role) values ($1,$2,$3) returning id`, [org, uid, role])).rows[0]!.id;
  await member(jarbou, users.jarbouOwner, "owner");
  const mh = await member(jarbou, users.dispatcherHannover, "dispatcher");
  const mb = await member(jarbou, users.dispatcherBremen, "dispatcher");
  await c.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1,$2,$3)`, [jarbou, mh, depots.hannover]);
  await c.query(`insert into membership_depots (organization_id, membership_id, depot_id) values ($1,$2,$3)`, [jarbou, mb, depots.bremen]);
  await member(jarbou, users.driverHannover1, "driver");
  await member(jarbou, users.driverHannover2, "driver");
  await member(jarbou, users.driverBremen1, "driver");

  // Second tenant: Muster Kurier (Leipzig) with a published tour.
  await member(muster, users.musterOwner, "owner");
  await member(muster, users.musterDriver, "driver");
  const leipzig = (await c.query<{ id: string }>(`insert into depots (organization_id, name, street, postal_code, city, lat, lng) values ($1,'Leipzig','Musterweg','04109','Leipzig',51.34,12.37) returning id`, [muster])).rows[0]!.id;
  const mdrv = (await c.query<{ id: string }>(`insert into drivers (organization_id, depot_id, display_name, user_id) values ($1,$2,'Max Muster',$3) returning id`, [muster, leipzig, users.musterDriver])).rows[0]!.id;
  const today = nowInZone("Europe/Berlin", opts.now).date;
  const mt = (
    await c.query<{ id: string }>(`insert into tours (organization_id, depot_id, driver_id, name, tour_date, published_at) values ($1,$2,$3,'LEI-01',$4, now()) returning id`, [muster, leipzig, mdrv, today])
  ).rows[0]!.id;
  for (let i = 0; i < 3; i++) {
    await c.query(`insert into stops (organization_id, tour_id, sequence, recipient_name, street, house_number, postal_code, city, lat, lng) values ($1,$2,$3,$4,'Musterstraße',$5,'04109','Leipzig',$6,$7)`, [
      muster,
      mt,
      i,
      `Kunde ${i + 1}`,
      String(10 + i),
      51.34 + i * 0.004,
      12.37 + i * 0.006,
    ]);
  }

  if (opts.demoDay) await seedDemoDay(c, { jarbou, depots, drivers, vehicles, today, now: opts.now });
  return { orgs: { jarbou, muster }, depots, drivers, vehicles, users };
}

/** Local minute of `today` in Europe/Berlin as timestamptz (via Postgres). */
const at = (today: string, minute: number) => `(timestamp '${today} 00:00' + make_interval(mins => ${Math.round(minute)})) at time zone 'Europe/Berlin'`;

/**
 * A realistic operating day for Bremen, Kassel and Haiger (Hannover stays
 * empty for the end-to-end scenario), derived from the synthetic dispatch
 * dataset. Completed stops only up to the current time.
 */
async function seedDemoDay(c: pg.ClientBase, s: { jarbou: string; depots: Record<string, string>; drivers: Record<string, string[]>; vehicles: Record<string, string[]>; today: string; now?: Date }) {
  const ds = createDispatchDataset(s.now);
  const nowMinute = nowInZone("Europe/Berlin", s.now).minute;
  const keyOf = (depotId: string) => depotId.replace(/^dep_/, "");
  for (const t of ds.tours) {
    const key = keyOf(t.depotId);
    if (key === "hannover") continue;
    const dIdx = t.driverId ? ds.drivers.filter((d) => d.depotId === t.depotId).findIndex((d) => d.id === t.driverId) : -1;
    const vIdx = t.vehicleId ? ds.vehicles.filter((v) => v.depotId === t.depotId).findIndex((v) => v.id === t.vehicleId) : -1;
    const shift = nowMinute - ds.asOfMinute; // move the synthetic clock to "now"
    const started = t.startedAt ? Number(t.startedAt.slice(11, 13)) * 60 + Number(t.startedAt.slice(14, 16)) + shift : null;
    const status = started !== null && started > nowMinute ? "planned" : t.status;
    const tour = (
      await c.query<{ id: string }>(
        `insert into tours (organization_id, depot_id, driver_id, vehicle_id, name, tour_date, status, planned_start_minute, started_at, published_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8, ${status !== "planned" && started !== null ? at(s.today, started) : "null"}, case when $3::uuid is null then null else now() end) returning id`,
        [s.jarbou, s.depots[key], dIdx >= 0 ? s.drivers[key]![dIdx] : null, vIdx >= 0 ? s.vehicles[key]![vIdx] : null, t.name, s.today, status, Math.max(0, Math.min(1439, t.plannedStartMinute + shift))],
      )
    ).rows[0]!.id;
    for (const st of ds.stops.filter((x) => x.tourId === t.id)) {
      const doneMinute = st.completedAt ? Number(st.completedAt.slice(11, 13)) * 60 + Number(st.completedAt.slice(14, 16)) + shift : null;
      const done = status !== "planned" && doneMinute !== null && doneMinute <= nowMinute && doneMinute >= 0;
      const tw = st.timeWindow ? { start: Math.max(0, Math.min(1438, st.timeWindow.start + shift)), end: Math.max(1, Math.min(1439, st.timeWindow.end + shift)) } : null;
      const sid = (
        await c.query<{ id: string }>(
          `insert into stops (organization_id, tour_id, type, sequence, recipient_name, street, house_number, postal_code, city, lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes, status, completed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, ${done ? at(s.today, doneMinute!) : "null"}) returning id`,
          [
            s.jarbou,
            tour,
            st.type,
            st.sequence,
            st.recipientName,
            st.address.street,
            st.address.houseNumber,
            st.address.postalCode,
            st.address.city,
            st.location!.lat,
            st.location!.lng,
            tw && tw.end > tw.start ? tw.start : null,
            tw && tw.end > tw.start ? tw.end : null,
            st.serviceSeconds,
            st.priority,
            st.notes ?? null,
            done ? st.status : "pending",
          ],
        )
      ).rows[0]!.id;
      for (const p of st.parcels) await c.query(`insert into parcels (organization_id, stop_id, tracking_number, recipient_name) values ($1,$2,$3,$4)`, [s.jarbou, sid, p.trackingNumber, st.recipientName]);
    }
  }
  for (const u of ds.unassigned) {
    const key = keyOf(u.depotId);
    if (key === "hannover") continue;
    await c.query(
      `insert into stops (organization_id, tour_id, depot_id, type, sequence, recipient_name, street, house_number, postal_code, city, lat, lng, tw_start_minute, tw_end_minute, service_seconds, priority, notes)
       values ($1,null,$2,$3,0,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [s.jarbou, s.depots[key], u.type, u.recipientName, u.address.street, u.address.houseNumber, u.address.postalCode, u.address.city, u.location!.lat, u.location!.lng, u.timeWindow?.start ?? null, u.timeWindow?.end ?? null, u.serviceSeconds, u.priority, u.notes ?? null],
    );
  }
}
