import { describe, expect, it } from "vitest";
import pg from "pg";
import { Db } from "../../src/db";
import { adminUrl, postgresAvailable } from "./helpers";

/**
 * A database restart or pooler failover closes idle pooled connections. pg reports that as an
 * 'error' event on the pool; without a listener Node treats it as unhandled and the API process
 * exits (seen in local testing: a database reset took the running API down). The API must log it,
 * drop the broken connection and serve the next request on a fresh one.
 */
const available = await postgresAvailable();

describe.runIf(available)("database pool survives a server-side disconnect", () => {
  it("keeps the process alive and recovers on the next query", async () => {
    const db = new Db(adminUrl("postgres"));
    const admin = new pg.Client({ connectionString: adminUrl("postgres") });
    await admin.connect();
    const unhandled: unknown[] = [];
    const onUncaught = (e: unknown) => unhandled.push(e);
    process.on("uncaughtException", onUncaught);
    const errorLog: string[] = [];
    const origError = console.error;
    console.error = (...a: unknown[]) => void errorLog.push(a.map(String).join(" "));
    try {
      // One idle connection in the pool.
      const pid = (await db.pool.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
      expect(db.pool.idleCount).toBe(1);
      // The server closes it (like a restart or pooler failover would).
      await admin.query("select pg_terminate_backend($1)", [pid]);
      await new Promise((r) => setTimeout(r, 300));
      expect(unhandled).toEqual([]);
      expect(errorLog.some((l) => l.includes("idle database connection lost"))).toBe(true);
      // The next query gets a fresh connection.
      const after = (await db.pool.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
      expect(after).not.toBe(pid);
    } finally {
      console.error = origError;
      process.off("uncaughtException", onUncaught);
      await admin.end();
      await db.pool.end();
    }
  });
});
