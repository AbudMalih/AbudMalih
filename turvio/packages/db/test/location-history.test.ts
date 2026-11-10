import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createSeededDb, ids } from "./harness";

/**
 * P0-3.2 on PostgreSQL 18 (PGlite): catalog safety of the location-history objects, the
 * append-only rules, and the migration's rollback round trip (the PG 17 server test covers data).
 */
const ROOT = join(import.meta.dirname, "../../..");
const VERSION = "20261118000100";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const TABLES = ["stop_location_origins", "stop_location_checks", "stop_location_decisions", "stop_location_events"];

describe("stop location history – catalog safety", () => {
  it("every SECURITY DEFINER function has an empty search_path; none is executable by anon", async () => {
    const db = await createSeededDb();
    const unsafe = await db.query<{ f: string }>(
      `select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('app', 'public') and p.prosecdef and not coalesce(p.proconfig, '{}') @> array['search_path=""']`,
    );
    expect(unsafe.rows).toEqual([]);
    const anon = await db.query<{ f: string }>(
      `select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('app', 'public') and has_function_privilege('anon', p.oid, 'EXECUTE')
          and p.proname in ('confirm_stop_location', 'accept_stop_approach', 'clear_stop_approach', 'driver_update_stop', 'driver_edit_stop', 'store_location_check', 'purge_expired_data')`,
    );
    expect(anon.rows).toEqual([]);
    await db.close();
  });

  it("users can only read the four tables (RLS on); system functions are not executable by users", async () => {
    const db = await createSeededDb();
    for (const t of TABLES) {
      const r = await db.query<{ sel: boolean; ins: boolean; upd: boolean; del: boolean; trunc: boolean; rls: boolean }>(
        `select has_table_privilege('authenticated', $1, 'SELECT') sel, has_table_privilege('authenticated', $1, 'INSERT') ins, has_table_privilege('authenticated', $1, 'UPDATE') upd,
                has_table_privilege('authenticated', $1, 'DELETE') del, has_table_privilege('authenticated', $1, 'TRUNCATE') trunc,
                (select relrowsecurity from pg_class where oid = $1::regclass) rls`,
        [`public.${t}`],
      );
      expect(r.rows[0], t).toEqual({ sel: true, ins: false, upd: false, del: false, trunc: false, rls: true });
      expect((await db.query<{ a: boolean }>(`select has_table_privilege('anon', $1, 'SELECT') a`, [`public.${t}`])).rows[0]!.a, t).toBe(false);
    }
    const exec = async (sig: string) => (await db.query<{ x: boolean }>(`select has_function_privilege('authenticated', $1, 'EXECUTE') x`, [sig])).rows[0]!.x;
    expect(await exec("app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)")).toBe(false);
    expect(await exec("app.purge_expired_data()")).toBe(false);
    expect(await exec("app.lock_stop_for_decision(uuid, double precision, double precision, int)")).toBe(false);
    expect(await exec("public.confirm_stop_location(uuid, double precision, double precision, int, text[], text)")).toBe(true);
    await db.close();
  });

  it("append-only and immutable on PostgreSQL 18 as well; originals survive every edit path", async () => {
    const db = await createSeededDb();
    const before = (await db.query<{ street: string; lat: number }>(`select street, lat from stop_location_origins where stop_id = $1`, [ids.stopA1])).rows[0]!;
    expect(before).toBeDefined();
    await asUser(db, ids.driverA1, async () => {
      await db.query(`select driver_edit_stop($1, 'X', 'Neue Straße', '9', '99084', 'Erfurt', 50.98, 11.03, 'manual_pin', 'Moved by customer')`, [ids.stopA1]);
    });
    expect((await db.query(`select street, lat from stop_location_origins where stop_id = $1`, [ids.stopA1])).rows[0]).toEqual(before);
    const ev = (await db.query<{ action: string; actor_role: string; reason: string }>(`select action, actor_role, reason from stop_location_events where stop_id = $1 order by id`, [ids.stopA1])).rows;
    expect(ev.at(-1)).toEqual({ action: "address_changed", actor_role: "driver", reason: "Moved by customer" });
    await expect(db.query(`update stop_location_origins set lat = 1 where stop_id = $1`, [ids.stopA1])).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from stop_location_events where stop_id = $1`, [ids.stopA1])).rejects.toThrow(/cannot be deleted/);
    await asUser(db, ids.dispatcherA, async () => {
      await expect(db.query(`update stop_location_origins set lat = 1`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`delete from stop_location_events`)).rejects.toThrow(/permission denied/);
    });
    await db.close();
  });
});

const snapshot = (db: PGlite) =>
  db
    .query<{ s: string }>(
      `select json_build_object(
         'f', (select json_agg(x order by x) from (select p.oid::regprocedure::text || md5(pg_get_functiondef(p.oid)) || coalesce(p.proacl::text, '') x from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app','public') and p.prokind = 'f') q),
         'p', (select json_agg(x order by x) from (select tablename || policyname || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, '') x from pg_policies) q),
         't', (select json_agg(x order by x) from (select pg_get_triggerdef(oid) x from pg_trigger where not tgisinternal) q),
         'c', (select json_agg(x order by x) from (select table_name || '.' || column_name || data_type x from information_schema.columns where table_schema = 'public') q))::text s`,
    )
    .then((r) => r.rows[0]!.s);

describe(`migration ${VERSION} on PostgreSQL 18 (PGlite)`, () => {
  it("applies in one transaction; the rollback refuses without confirmation and then restores the exact catalog", async () => {
    const db = new PGlite();
    await db.exec(read("supabase/local/00_supabase_stubs.sql"));
    for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql") && x < VERSION).sort()) await db.exec(read(`supabase/migrations/${f}`));
    await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    const before = await snapshot(db);
    await db.exec(`begin; set local lock_timeout = '5s';\n${read(`supabase/migrations/${VERSION}_stop_location_history.sql`)}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}', 'stop_location_history'); commit;`);
    expect(await snapshot(db)).not.toBe(before);
    await expect(db.exec(read(`supabase/rollback/${VERSION}_stop_location_history.down.sql`))).rejects.toThrow(/refusing to drop the location history/);
    await db.exec(`begin; set local turvio.confirm_drop_location_history = 'yes';\n${read(`supabase/rollback/${VERSION}_stop_location_history.down.sql`)}\n; commit;`);
    expect(await snapshot(db)).toBe(before);
    await db.close();
  }, 120_000);
});
