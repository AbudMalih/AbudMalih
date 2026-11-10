import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOT, adminUrl, postgresAvailable } from "./helpers";

/**
 * Staging prerequisite for 20261118000100 (P0-3.6): in the hosted order – service role created by
 * supabase/hosted/10_turvio_service.sql BEFORE this migration – the API role lacks the grant on
 * app.store_location_check until the hosted script is re-run. Re-running it must be safe.
 */
const available = await postgresAvailable();
const VERSION = "20261118000100";
const HOSTED = readFileSync(join(ROOT, "supabase/hosted/10_turvio_service.sql"), "utf8");
const dbName = `turvio_hosted_${process.pid}`;
let c: pg.Client;
const SIG = "app.store_location_check(uuid, text, text, jsonb, jsonb, double precision, double precision, text, int, double precision, double precision, int, text, text, int)";
const can = async (fn: string) => (await c.query<{ ok: boolean }>(`select has_function_privilege('turvio_service', $1, 'EXECUTE') ok`, [fn])).rows[0]!.ok;

describe.runIf(available)("hosted service role and the location-history migration", () => {
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
    await c.query(HOSTED); // staging today: service role set up before the new migration
  }, 120_000);
  afterAll(async () => {
    await c?.end();
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("before the migration the conditional grant is skipped (script applies cleanly)", async () => {
    expect((await c.query(`select to_regprocedure($1) is null missing`, [SIG])).rows[0].missing).toBe(true);
    expect(await can("app.purge_expired_data()")).toBe(true);
  });

  it("after the migration the API role cannot store check results until the hosted script is re-run", async () => {
    await c.query(`begin; set local lock_timeout = '5s';\n${readFileSync(join(ROOT, `supabase/migrations/${VERSION}_stop_location_history.sql`), "utf8")}\ncommit;`);
    expect(await can(SIG)).toBe(false);
    await c.query(HOSTED);
    expect(await can(SIG)).toBe(true);
    await c.query(HOSTED); // idempotent
    expect(await can(SIG)).toBe(true);
  });

  it("the API role still has no direct write access to the history tables and can run the retention purge", async () => {
    for (const t of ["stop_location_origins", "stop_location_events", "stop_location_checks", "stop_location_decisions"]) {
      const r = (await c.query<{ ins: boolean; upd: boolean; del: boolean }>(`select has_table_privilege('turvio_service', $1, 'INSERT') ins, has_table_privilege('turvio_service', $1, 'UPDATE') upd, has_table_privilege('turvio_service', $1, 'DELETE') del`, [`public.${t}`])).rows[0]!;
      expect(r, t).toEqual({ ins: false, upd: false, del: false });
    }
    expect(await can("app.purge_expired_data()")).toBe(true);
  });
});
