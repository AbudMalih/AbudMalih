import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./harness";

/** Table/function privileges for the Supabase API roles, with hosted default privileges emulated by the stubs. */
describe("privileges of anon and authenticated", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it("anon has no privilege on any TURVIO table", async () => {
    const r = await db.query<{ t: string; p: string }>(
      `select c.relname as t, string_agg(p.privilege_type, ',') as p
         from pg_class c join pg_namespace n on n.oid = c.relnamespace,
         lateral (select unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as privilege_type) p
        where n.nspname in ('public','app','geo') and c.relkind = 'r' and has_table_privilege('anon', c.oid, p.privilege_type)
        group by c.relname`,
    );
    expect(r.rows).toEqual([]);
  });

  it("authenticated cannot TRUNCATE, add triggers or reference tables (RLS does not cover TRUNCATE)", async () => {
    const r = await db.query<{ t: string }>(
      `select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and (has_table_privilege('authenticated', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRIGGER') or has_table_privilege('authenticated', c.oid, 'REFERENCES'))`,
    );
    expect(r.rows).toEqual([]);
  });

  it("every public table has row level security", async () => {
    const r = await db.query<{ t: string }>(`select relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows).toEqual([]);
  });

  it("anon cannot reach any TURVIO function (no schema usage on app/geo, no execute in public)", async () => {
    const r = await db.query<{ f: string }>(
      `select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','app','geo') and has_schema_privilege('anon', n.oid, 'USAGE') and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    );
    expect(r.rows).toEqual([]);
  });
});
