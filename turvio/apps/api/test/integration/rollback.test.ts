import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../../src/seed";
import { PASSWORD, ROOT, adminUrl, postgresAvailable } from "./helpers";

/**
 * Deployment safety for 20261117000100_strict_location_scope: apply it the way staging is migrated
 * (one transaction + schema_migrations row) on a seeded pre-migration database, then roll it back
 * with supabase/rollback/…down.sql. The catalog (functions, grants, policies, triggers, columns,
 * table privileges) must be exactly as before, and no row of any table may change.
 */
const available = await postgresAvailable();
const VERSION = "20261117000100";
const MIGRATION = readFileSync(join(ROOT, `supabase/migrations/${VERSION}_strict_location_scope.sql`), "utf8");
const ROLLBACK = readFileSync(join(ROOT, `supabase/rollback/${VERSION}_strict_location_scope.down.sql`), "utf8");
const FINGERPRINT = readFileSync(join(ROOT, "supabase/rollback/fingerprint.sql"), "utf8");
const dbName = `turvio_rb_${process.pid}`;
let c: pg.Client;

async function applyLikeStaging() {
  await c.query(`begin; set local lock_timeout = '5s';\n${MIGRATION}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}', 'strict_location_scope'); commit;`);
}

/** Everything the migration or the rollback could touch, as comparable text. */
async function catalog() {
  const q = async (sql: string) => (await c.query(sql)).rows;
  return {
    functions: await q(`select p.oid::regprocedure::text sig, md5(pg_get_functiondef(p.oid)) def, coalesce(p.proacl::text, '') acl, p.prosecdef, coalesce(p.proconfig::text, '') cfg, pg_get_userbyid(p.proowner) owner
                          from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app', 'public') and p.prokind = 'f' order by 1`),
    policies: await q(`select schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 2, 3`),
    triggers: await q(`select tgrelid::regclass::text t, tgname, pg_get_triggerdef(oid) def, tgenabled from pg_trigger where not tgisinternal order by 1, 2`),
    columns: await q(`select table_schema, table_name, column_name, data_type, column_default, is_nullable from information_schema.columns where table_schema in ('public', 'app') order by 1, 2, ordinal_position`),
    tables: await q(`select c.oid::regclass::text t, coalesce(c.relacl::text, '') acl, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'app') and c.relkind = 'r' order by 1`),
  };
}

/** Per table: row count and a hash of all rows (ignoring the migration's all_locations column). */
async function data() {
  const tables = (await c.query<{ t: string }>(`select format('%I.%I', schemaname, tablename) t from pg_tables where schemaname in ('public', 'app', 'auth', 'app_auth', 'geo', 'supabase_migrations') order by 1`)).rows;
  const out: Record<string, { n: number; h: string }> = {};
  for (const { t } of tables) {
    const r = (await c.query(`select count(*)::int n, coalesce(md5(string_agg((to_jsonb(x) - 'all_locations')::text, '|' order by (to_jsonb(x) - 'all_locations')::text)), '') h from ${t} x`)).rows[0];
    out[t] = r;
  }
  return out;
}

const SENSITIVE = ["depots", "drivers", "vehicles", "tours", "stops", "parcels", "driver_positions", "location_pings", "invitations", "tracking_notice_acks", "memberships", "membership_depots", "organizations"];

/** For every user: visible rows per sensitive table and can_access_depot per location, under RLS. */
async function visibility() {
  const users = (await c.query<{ id: string; email: string }>(`select id, email from auth.users order by email`)).rows;
  const depots = (await c.query<{ id: string; organization_id: string }>(`select id, organization_id from depots order by id`)).rows;
  const out: Record<string, Record<string, number | boolean>> = {};
  for (const u of users) {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: u.id, email: u.email, role: "authenticated" }), u.id]);
    const row: Record<string, number | boolean> = {};
    for (const t of SENSITIVE) row[t] = (await c.query(`select count(*)::int n from public.${t}`)).rows[0].n;
    for (const d of depots) row[`depot:${d.id}`] = (await c.query(`select app.can_access_depot($1, $2) ok`, [d.organization_id, d.id])).rows[0].ok;
    await c.query("rollback");
    out[u.email] = row;
  }
  return out;
}

describe.runIf(available)("migration 20261117000100: staging-style apply and rollback", () => {
  let catalog0: Awaited<ReturnType<typeof catalog>>;
  let data0: Awaited<ReturnType<typeof data>>;
  let vis0: Awaited<ReturnType<typeof visibility>>;
  let fp0: unknown[];

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.query(`create database ${dbName}`);
    await admin.end();
    c = new pg.Client({ connectionString: adminUrl(dbName) });
    await c.connect();
    await c.query(readFileSync(join(ROOT, "supabase/local/00_supabase_stubs.sql"), "utf8"));
    for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql") && x < VERSION).sort()) {
      await c.query(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
    }
    await c.query(readFileSync(join(ROOT, "supabase/local/10_local_auth.sql"), "utf8"));
    await c.query(readFileSync(join(ROOT, "supabase/local/20_local_service_role.sql"), "utf8"));
    await c.query(`create schema if not exists supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    await seed(c, { password: PASSWORD, demoDay: true });
    // Pre-migration state like staging: accepted invitations, a tracking confirmation, GPS.
    await c.query(`insert into invitations (organization_id, email, role, token_hash, accepted_at) select organization_id, 'accepted@example.test', 'driver', 'h-accepted', now() from depots limit 1`);
    // Tracking data so GPS isolation is part of the comparison.
    await c.query(`insert into tracking_notice_acks (organization_id, driver_id, notice_version) select d.organization_id, d.id, 1 from drivers d where d.user_id is not null`);
    const gps = await c.query<{ n: number }>(`select (select count(*) from driver_positions) + (select count(*) from location_pings) n`);
    if (Number(gps.rows[0]!.n) === 0) {
      // A recorded position and track point per started tour, so GPS isolation is compared too.
      await c.query(`insert into driver_positions (organization_id, driver_id, tour_id, lat, lng, recorded_at)
                     select t.organization_id, t.driver_id, t.id, 52.37, 9.73, now() from tours t where t.driver_id is not null`);
      await c.query(`insert into location_pings (organization_id, driver_id, tour_id, lat, lng, recorded_at, client_id)
                     select t.organization_id, t.driver_id, t.id, 52.37, 9.73, now(), gen_random_uuid() from tours t where t.driver_id is not null`);
    }
    catalog0 = await catalog();
    data0 = await data();
    vis0 = await visibility();
    fp0 = (await c.query(FINGERPRINT)).rows;
  }, 180_000);
  afterAll(async () => {
    await c?.end();
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("the rollback refuses to run where the migration is not applied", async () => {
    await expect(c.query(ROLLBACK)).rejects.toThrow(/not applied/);
    await c.query("rollback").catch(() => {});
    expect(await catalog()).toEqual(catalog0);
  });

  it("the migration changes no existing row", async () => {
    await applyLikeStaging();
    // The staging runbook's fingerprint (counts + hashes) is identical before and after.
    expect((await c.query(FINGERPRINT)).rows).toEqual(fp0);
    expect(await data()).toEqual({ ...data0, "supabase_migrations.schema_migrations": expect.anything() });
    const cat = await catalog();
    expect(cat).not.toEqual(catalog0);
    expect((await c.query(`select count(*)::int n from memberships where all_locations`)).rows[0].n).toBe(0); // nobody widened
  });

  it("no existing user sees more after the migration; owners, admins, drivers and located dispatchers see exactly the same", async () => {
    const vis1 = await visibility();
    console.log("visibility totals:", JSON.stringify(Object.fromEntries(SENSITIVE.map((t) => [t, Object.values(vis1).reduce((a, r) => a + (r[t] as number), 0)]))));
    console.log("users x locations checked:", Object.values(vis1).reduce((a, r) => a + Object.keys(r).filter((k) => k.startsWith("depot:")).length, 0));
    expect(Object.keys(vis1)).toEqual(Object.keys(vis0));
    const roles = new Map((await c.query<{ email: string; roles: string }>(`select u.email, string_agg(m.role::text, ',') roles from auth.users u left join memberships m on m.user_id = u.id group by 1`)).rows.map((r) => [r.email, r.roles ?? ""]));
    const narrowed: string[] = [];
    for (const [email, row] of Object.entries(vis1)) {
      for (const [k, v] of Object.entries(row)) {
        const was = vis0[email]![k]!;
        if (typeof v === "number") expect(v, `${email} ${k}`).toBeLessThanOrEqual(was as number);
        else expect(v && !was, `${email} ${k} widened`).toBe(false);
        if (v !== was) narrowed.push(`${roles.get(email)}:${k}`);
      }
    }
    // The only narrowing: dispatchers no longer see driver invitations / confirmations outside their locations.
    expect(narrowed.every((n) => n.startsWith("dispatcher:") && /invitations|tracking_notice_acks/.test(n)), narrowed.join("; ")).toBe(true);
    // Sanity: the matrix is not trivially empty.
    const owner = Object.entries(vis1).find(([e]) => roles.get(e) === "owner")![1];
    expect(owner.tours as number).toBeGreaterThan(0);
    expect(owner.stops as number).toBeGreaterThan(0);
  });

  it("rollback restores functions, grants, policies, triggers and columns exactly – and keeps every row", async () => {
    // Activity while migrated: an explicit grant and a new invitation.
    await c.query(`update memberships set all_locations = true where role = 'dispatcher' and id = (select min(id::text)::uuid from memberships where role = 'dispatcher')`);
    const before = await data();
    const auditMaxBefore = (await c.query(`select max(id) m from audit_log`)).rows[0].m;
    await c.query(`insert into invitations (organization_id, email, role, token_hash, depot_ids) select organization_id, 'after@example.test', 'dispatcher', 'h-after', array[id] from depots limit 1`);
    await c.query(ROLLBACK);
    expect(await catalog()).toEqual(catalog0);
    const after = await data();
    const { "public.invitations": invAfter, "public.audit_log": auditAfter, ...restAfter } = after;
    const { "public.invitations": invBefore, "public.audit_log": auditBefore, ...restBefore } = before;
    expect(auditAfter!.n).toBe(auditBefore!.n + 1); // the audit entry of that invitation, nothing else
    const oldAudit = (await c.query(`select count(*)::int n from audit_log where id <= $1`, [auditMaxBefore])).rows[0].n;
    expect(oldAudit).toBe(auditBefore!.n); // no earlier audit row lost
    expect(restAfter).toEqual({ ...restBefore, "supabase_migrations.schema_migrations": restAfter["supabase_migrations.schema_migrations"] });
    expect(invAfter!.n).toBe(invBefore!.n + 1); // the invitation created while migrated is kept
    expect((await c.query(`select count(*)::int n from supabase_migrations.schema_migrations where version = $1`, [VERSION])).rows[0].n).toBe(0);
    // Every pre-migration table is byte-identical to the start.
    for (const [t, v] of Object.entries(data0)) if (!["public.invitations", "public.audit_log", "supabase_migrations.schema_migrations"].includes(t)) expect(after[t], t).toEqual(v);
  });

  it("the migration can be applied again after a rollback (and rolled back again)", async () => {
    await applyLikeStaging();
    expect((await c.query(`select count(*)::int n from pg_trigger where tgname in ('invitations_guard', 'drivers_link_guard')`)).rows[0].n).toBe(2);
    await c.query(ROLLBACK);
    expect(await catalog()).toEqual(catalog0);
  });
});
