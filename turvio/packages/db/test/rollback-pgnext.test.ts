import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Same apply/rollback round trip on PGlite (PostgreSQL 18). With the PostgreSQL 16 server test this brackets staging (17).. */
const ROOT = join(import.meta.dirname, "../../..");
const VERSION = "20261117000100";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

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

describe("migration 20261117000100 on PostgreSQL 18 (PGlite; staging is 17, the server tests use 16)", () => {
  it("applies in one transaction and the rollback restores the exact previous catalog", async () => {
    const db = new PGlite();
    expect((await db.query<{ server_version: string }>(`show server_version`)).rows[0]!.server_version).toMatch(/^1[78]\./);
    await db.exec(read("supabase/local/00_supabase_stubs.sql"));
    for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql") && x < VERSION).sort()) await db.exec(read(`supabase/migrations/${f}`));
    await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text); create role turvio_service`);
    const before = await snapshot(db);
    await db.exec(`begin; set local lock_timeout = '5s';\n${read(`supabase/migrations/${VERSION}_strict_location_scope.sql`)}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}', 'strict_location_scope'); commit;`);
    expect(await snapshot(db)).not.toBe(before);
    await db.exec(read(`supabase/rollback/${VERSION}_strict_location_scope.down.sql`));
    // turvio_service did not hold the grant here before (hosted grant script not applied locally): compare without it.
    expect((await snapshot(db)).replace(/,turvio_service=X\/postgres/g, "")).toBe(before);
    await db.close();
  }, 120_000);
});
