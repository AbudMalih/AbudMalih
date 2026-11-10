import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../../src/seed";
import { PASSWORD, ROOT, adminUrl, postgresAvailable } from "./helpers";

/**
 * Deployment safety for 20261118000100_stop_location_history (P0-3.2): applied the way staging is
 * migrated (one transaction + schema_migrations row) on a seeded pre-migration database, then rolled
 * back with supabase/rollback/…down.sql. The catalog must be exactly as before, no pre-existing row
 * may change, and the rollback must refuse to run without the explicit confirmation setting.
 */
const available = await postgresAvailable();
const VERSION = "20261118000100";
const MIGRATION = readFileSync(join(ROOT, `supabase/migrations/${VERSION}_stop_location_history.sql`), "utf8");
const ROLLBACK = readFileSync(join(ROOT, `supabase/rollback/${VERSION}_stop_location_history.down.sql`), "utf8");
const FINGERPRINT = readFileSync(join(ROOT, "supabase/rollback/fingerprint.sql"), "utf8");
const dbName = `turvio_rbloc_${process.pid}`;
let c: pg.Client;

async function applyLikeStaging() {
  await c.query(`begin; set local lock_timeout = '5s';\n${MIGRATION}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}', 'stop_location_history'); commit;`);
}
async function rollback() {
  await c.query(`begin; set local lock_timeout = '5s'; set local turvio.confirm_drop_location_history = 'yes';\n${ROLLBACK}\n;delete from supabase_migrations.schema_migrations where version = '${VERSION}'; commit;`);
}

async function catalog() {
  const q = async (sql: string) => (await c.query(sql)).rows;
  return {
    functions: await q(`select p.oid::regprocedure::text sig, md5(pg_get_functiondef(p.oid)) def, coalesce(p.proacl::text, '') acl, p.prosecdef, coalesce(p.proconfig::text, '') cfg, pg_get_userbyid(p.proowner) owner
                          from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app', 'public') and p.prokind = 'f' order by 1`),
    policies: await q(`select schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 2, 3`),
    triggers: await q(`select tgrelid::regclass::text t, tgname, pg_get_triggerdef(oid) def, tgenabled from pg_trigger where not tgisinternal order by 1, 2`),
    columns: await q(`select table_schema, table_name, column_name, data_type, column_default, is_nullable from information_schema.columns where table_schema in ('public', 'app') order by 1, 2, ordinal_position`),
    tables: await q(`select c.oid::regclass::text t, coalesce(c.relacl::text, '') acl, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'app') and c.relkind = 'r' order by 1`),
    indexes: await q(`select indexrelid::regclass::text i, pg_get_indexdef(indexrelid) d from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' order by 1`),
  };
}

const NEW_COLS = ["address_version", "location_version", "location_precision", "location_audit_retention_days", "location_check_retention_days"];
async function data() {
  const tables = (await c.query<{ t: string }>(`select format('%I.%I', schemaname, tablename) t from pg_tables where schemaname in ('public', 'app', 'auth', 'app_auth', 'geo') order by 1`)).rows;
  const strip = NEW_COLS.map((k) => ` - '${k}'`).join("");
  const out: Record<string, { n: number; h: string }> = {};
  for (const { t } of tables) out[t] = (await c.query(`select count(*)::int n, coalesce(md5(string_agg((to_jsonb(x)${strip})::text, '|' order by (to_jsonb(x)${strip})::text)), '') h from ${t} x`)).rows[0];
  return out;
}

describe.runIf(available)("migration 20261118000100: staging-style apply and rollback", () => {
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
    await c.query(readFileSync(join(ROOT, "supabase/local/00_supabase_stubs.sql"), "utf8"));
    for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql") && x < VERSION).sort()) await c.query(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
    await c.query(readFileSync(join(ROOT, "supabase/local/10_local_auth.sql"), "utf8"));
    await c.query(readFileSync(join(ROOT, "supabase/local/20_local_service_role.sql"), "utf8"));
    await c.query(`create schema if not exists supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    await seed(c, { password: PASSWORD, demoDay: true });
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

  it("the migration changes no existing row; existing stops get a labelled baseline, never an 'original'", async () => {
    const stops = (await c.query(`select count(*)::int n from stops`)).rows[0].n as number;
    expect(stops).toBeGreaterThan(0);
    await applyLikeStaging();
    expect((await c.query(FINGERPRINT)).rows).toEqual(fp0);
    const after = await data();
    for (const [t, v] of Object.entries(data0)) expect(after[t], t).toEqual(v);
    const origins = (await c.query(`select kind, provenance, captured_by, count(*)::int n from stop_location_origins group by 1, 2, 3`)).rows;
    expect(origins).toEqual([{ kind: "baseline_at_migration", provenance: "unknown", captured_by: null, n: stops }]);
    // No invented history.
    expect((await c.query(`select count(*)::int n from stop_location_events`)).rows[0].n).toBe(0);
    expect((await c.query(`select count(*)::int n from stops where address_version <> 1 or location_version <> 1 or location_precision <> 'unknown'`)).rows[0].n).toBe(0);
  });

  it("the rollback refuses to run without the explicit confirmation", async () => {
    await expect(c.query(`begin; ${ROLLBACK}`)).rejects.toThrow(/refusing to drop the location history/);
    await c.query("rollback");
    expect((await c.query(`select to_regclass('public.stop_location_events') is not null ok`)).rows[0].ok).toBe(true);
  });

  it("rollback restores the catalog exactly and keeps every pre-existing row (history recorded meanwhile is dropped)", async () => {
    // Activity while migrated: a new stop (history rows) – it stays a stop after the rollback.
    await c.query(`insert into stops (organization_id, tour_id, sequence, street, postal_code, city, lat, lng)
                   select organization_id, id, 999, 'Rollbackstraße', '30159', 'Hannover', 52.37, 9.73 from tours limit 1`);
    expect((await c.query(`select count(*)::int n from stop_location_events where action = 'created'`)).rows[0].n).toBe(1);
    await rollback();
    expect(await catalog()).toEqual(catalog0);
    const after = await data();
    // The new stop (and the general audit log's entry for it) stay; every other table is identical.
    for (const [t, v] of Object.entries(data0)) if (t !== "public.stops" && t !== "public.audit_log") expect(after[t], t).toEqual(v);
    expect(after["public.stops"]!.n).toBe(data0["public.stops"]!.n + 1);
    expect(after["public.audit_log"]!.n).toBe(data0["public.audit_log"]!.n + 1);
    expect((await c.query(`select count(*)::int n from supabase_migrations.schema_migrations where version = $1`, [VERSION])).rows[0].n).toBe(0);
  });

  it("the migration can be applied again after a rollback (and rolled back again)", async () => {
    await applyLikeStaging();
    expect((await c.query(`select count(*)::int n from pg_trigger where tgname like 'stops_location_%'`)).rows[0].n).toBe(5);
    await rollback();
    expect(await catalog()).toEqual(catalog0);
  });
});
