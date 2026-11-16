import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../../src/seed";
import { PASSWORD, ROOT, adminUrl, postgresAvailable } from "./helpers";

/**
 * Deployment safety for Phase B (20261119000100 enums, 20261119000200 tour lifecycle,
 * 20261119000300 settings): applied the way staging is migrated (one transaction per file +
 * schema_migrations row) on a seeded database with real activity; no pre-existing row may change.
 * Then rolled back with supabase/rollback/…down.sql: the catalog must be exactly as before
 * (the two enum values stay – Postgres cannot drop them – and are unused).
 */
const available = await postgresAvailable();
const FILES = ["20261119000200_tour_lifecycle", "20261119000300_settings_preferences"] as const;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const FINGERPRINT = read("supabase/rollback/fingerprint.sql");
const dbName = `turvio_rblife_${process.pid}`;
let c: pg.Client;

const apply = async (name: string) =>
  c.query(`begin; set local lock_timeout = '5s';\n${read(`supabase/migrations/${name}.sql`)}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${name.slice(0, 14)}', '${name.slice(15)}'); commit;`);
const rollback = async (name: string, confirm: string) =>
  c.query(`begin; set local lock_timeout = '5s'; set local ${confirm} = 'yes';\n${read(`supabase/rollback/${name}.down.sql`)}\n;delete from supabase_migrations.schema_migrations where version = '${name.slice(0, 14)}'; commit;`);
const applyAll = async () => {
  for (const f of FILES) await apply(f);
};
const rollbackAll = async () => {
  await rollback(FILES[1], "turvio.confirm_drop_settings");
  await rollback(FILES[0], "turvio.confirm_drop_tour_lifecycle");
};

async function catalog() {
  const q = async (sql: string) => (await c.query(sql)).rows;
  return {
    functions: await q(`select p.oid::regprocedure::text sig, md5(pg_get_functiondef(p.oid)) def, coalesce(p.proacl::text, '') acl, p.prosecdef, coalesce(p.proconfig::text, '') cfg
                          from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app', 'public') and p.prokind = 'f' order by 1`),
    policies: await q(`select tablename, policyname, permissive, roles::text, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`),
    triggers: await q(`select tgrelid::regclass::text t, tgname, pg_get_triggerdef(oid) def, tgenabled from pg_trigger where not tgisinternal order by 1, 2`),
    columns: await q(`select table_schema, table_name, column_name, data_type, column_default, is_nullable from information_schema.columns where table_schema in ('public', 'app') order by 1, 2, ordinal_position`),
    tables: await q(`select c.oid::regclass::text t, coalesce(c.relacl::text, '') acl, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'app') and c.relkind = 'r' order by 1`),
    indexes: await q(`select indexrelid::regclass::text i, pg_get_indexdef(indexrelid) d from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' order by 1`),
    constraints: await q(`select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`),
  };
}

const NEW_COLS = ["closed_at", "closed_by", "close_reason", "closed_remotely", "archived_at", "archived_by", "cancel_reason", "cancelled_at", "cancelled_by", "returned_from_tour_id", "returned_at",
  "contact_email", "contact_phone", "address_street", "address_postal_code", "address_city", "address_country", "website"];
async function data() {
  const tables = (await c.query<{ t: string }>(`select format('%I.%I', schemaname, tablename) t from pg_tables where schemaname in ('public', 'app', 'auth', 'app_auth', 'geo') order by 1`)).rows;
  const strip = NEW_COLS.map((k) => ` - '${k}'`).join("");
  const out: Record<string, { n: number; h: string }> = {};
  for (const { t } of tables) out[t] = (await c.query(`select count(*)::int n, coalesce(md5(string_agg((to_jsonb(x)${strip})::text, '|' order by (to_jsonb(x)${strip})::text)), '') h from ${t} x`)).rows[0];
  return out;
}

describe.runIf(available)("Phase B migrations: staging-style apply and rollback", () => {
  let catalog0: Awaited<ReturnType<typeof catalog>>;
  let data0: Awaited<ReturnType<typeof data>>;
  let fp0: unknown[];

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.query(`create database ${dbName}`);
    await admin.end();
    c = new pg.Client({ connectionString: adminUrl(dbName) });
    await c.connect();
    await c.query(read("supabase/local/00_supabase_stubs.sql"));
    for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql") && x < "20261119000200").sort()) await c.query(read(`supabase/migrations/${f}`));
    await c.query(read("supabase/local/10_local_auth.sql"));
    await c.query(read("supabase/local/20_local_service_role.sql"));
    await c.query(`create schema if not exists supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    await seed(c, { password: PASSWORD, demoDay: true });
    // Real activity before the migration: a completed tour, a delivered stop with an event, a ping.
    const t = (await c.query(`select id from tours where driver_id is not null order by id limit 1`)).rows[0].id;
    await c.query(`update tours set status = 'in_progress', started_at = now() - interval '2 hours', published_at = now() where id = $1`, [t]);
    await c.query(`update stops set status = 'delivered', completed_at = now() - interval '1 hour', status_changed_at = now() - interval '1 hour' where id = (select id from stops where tour_id = $1 order by sequence limit 1)`, [t]);
    await c.query(`insert into stop_events (organization_id, stop_id, status) select organization_id, id, 'delivered' from stops where tour_id = $1 and status = 'delivered'`, [t]);
    await c.query(`update tours set status = 'completed', finished_at = now() where id = $1`, [t]);
    catalog0 = await catalog();
    data0 = await data();
    fp0 = (await c.query(FINGERPRINT)).rows;
  }, 180_000);
  afterAll(async () => {
    await c?.end();
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("applying changes no existing row and invents no history", async () => {
    await applyAll();
    expect((await c.query(FINGERPRINT)).rows).toEqual(fp0);
    const after = await data();
    for (const [t, v] of Object.entries(data0)) expect(after[t], t).toEqual(v);
    // Existing closed tours: no close actor / reason invented (closed_at null → finished_at is used).
    expect((await c.query(`select count(*)::int n from tours where closed_at is not null or closed_by is not null or archived_at is not null or closed_remotely`)).rows[0].n).toBe(0);
    expect((await c.query(`select count(*)::int n from tour_deletions`)).rows[0].n).toBe(0);
  });

  it("each rollback refuses to run without its explicit confirmation", async () => {
    await expect(c.query(`begin; ${read(`supabase/rollback/${FILES[1]}.down.sql`)}`)).rejects.toThrow(/refusing to drop settings/);
    await c.query("rollback");
    await expect(c.query(`begin; ${read(`supabase/rollback/${FILES[0]}.down.sql`)}`)).rejects.toThrow(/refusing to drop the tour lifecycle/);
    await c.query("rollback");
  });

  it("the lifecycle rollback refuses while cancelled tours exist", async () => {
    const t = (await c.query(`select id from tours where status = 'planned' order by id limit 1`)).rows[0].id;
    await c.query(`update tours set status = 'cancelled' where id = $1`, [t]);
    await rollback(FILES[1], "turvio.confirm_drop_settings");
    await expect(rollback(FILES[0], "turvio.confirm_drop_tour_lifecycle")).rejects.toThrow(/cancelled tours or stops exist/);
    await c.query("rollback");
    // Not reversible through the API (closed tours never reopen) – resolved by the operator directly.
    await c.query(`alter table tours disable trigger tours_lifecycle_guard`);
    await c.query(`update tours set status = 'planned', closed_at = null, closed_by = null where id = $1`, [t]);
    await c.query(`alter table tours enable trigger tours_lifecycle_guard`);
    await apply(FILES[1]);
  });

  it("rollback restores the catalog exactly; pre-existing rows keep their content", async () => {
    await rollbackAll();
    expect(await catalog()).toEqual(catalog0);
    const after = await data();
    // tour_events / audit_log / tours (version) carry the operator fix of the previous test; every other table is identical.
    for (const [t, v] of Object.entries(data0)) if (!["public.tours", "public.tour_events", "public.audit_log"].includes(t)) expect(after[t], t).toEqual(v);
    expect((await c.query(`select count(*)::int n from supabase_migrations.schema_migrations where version like '20261119%'`)).rows[0].n).toBe(0);
  });

  it("can be applied again after a rollback (and rolled back again)", async () => {
    await applyAll();
    expect((await c.query(`select count(*)::int n from pg_trigger where tgname = 'tours_lifecycle_guard'`)).rows[0].n).toBe(1);
    await rollbackAll();
    expect(await catalog()).toEqual(catalog0);
  });
});
