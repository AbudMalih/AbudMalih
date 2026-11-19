import pg from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings (no time-zone shifting).
pg.types.setTypeParser(1082, (v) => v);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Extra fields for the error body (e.g. which stops are outside the routing area). */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface Claims {
  sub: string;
  email?: string;
}

export type Tx = pg.PoolClient;

/**
 * Database access. `asUser` runs work inside a transaction as the Postgres
 * role `authenticated` with the caller's JWT claims – exactly how Supabase's
 * PostgREST evaluates Row Level Security. Tenant isolation is therefore
 * enforced by the database for every request, not only by API code.
 * `asService` runs as the API's own role (local auth tables, invitation
 * acceptance); it does not bypass RLS on tenant tables.
 */
/**
 * Every pooled connection prints floats exactly (shortest round-trip form). Hosted servers may be
 * configured with `extra_float_digits = 0` (Supabase is), which prints 15 significant digits: a GPS
 * coordinate read that way differs from the stored one, so exact location-change checks
 * (`store_location_check`, confirm, approach) would fail. A session setting, so it also holds
 * behind the session pooler; queued before the first query of each new connection.
 */
/**
 * Pool limits: a request never waits forever. Getting a connection gives up after
 * DB_CONNECT_TIMEOUT_MS (pool or pooler saturated) and a statement after DB_STATEMENT_TIMEOUT_MS;
 * both answer 503 (database_busy / database_timeout) instead of a hanging request.
 */
export const DB_CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000);
export const DB_STATEMENT_TIMEOUT_MS = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000);

export function withExactFloats(pool: pg.Pool, statementTimeoutMs = DB_STATEMENT_TIMEOUT_MS): pg.Pool {
  // An idle pooled connection can be closed by the server (database restart, pooler failover,
  // idle timeout). pg reports that as an 'error' event on the pool; without a listener Node treats
  // it as unhandled and the whole API process exits. The broken client is already discarded by the
  // pool, so logging is all that is needed – the next request opens a fresh connection.
  pool.on("error", (err: Error & { code?: string }) => {
    console.error(JSON.stringify({ level: "error", msg: "idle database connection lost", code: err.code ?? null, error: err.message }));
  });
  pool.on("connect", (client) => {
    // Never continue silently with rounded floats: a failure closes this connection (the request errors).
    // Session settings (also valid behind the session pooler): exact floats and a statement timeout.
    const timeout = Number.isFinite(statementTimeoutMs) && statementTimeoutMs > 0 ? Math.round(statementTimeoutMs) : 30_000;
    client.query(`set extra_float_digits = 1; set statement_timeout = ${timeout}`).catch(() => client.end().catch(() => undefined));
  });
  return pool;
}

export class Db {
  readonly pool: pg.Pool;

  constructor(connectionString: string, ssl: PgSsl = false) {
    this.pool = withExactFloats(new pg.Pool({ connectionString, max: 10, ssl: pgSslOptions(ssl), connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS, idleTimeoutMillis: 30_000 }));
  }

  /** A pooled connection, or 503 database_busy when none frees up in time. */
  private async connect(): Promise<pg.PoolClient> {
    try {
      return await this.pool.connect();
    } catch {
      throw new ApiError(503, "database_busy", "The database is busy – try again in a moment");
    }
  }

  async asUser<T>(claims: Claims, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [
        JSON.stringify({ sub: claims.sub, email: claims.email, role: "authenticated" }),
        claims.sub,
      ]);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback").catch(() => undefined);
      throw mapPgError(e);
    } finally {
      client.release();
    }
  }

  async asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback").catch(() => undefined);
      throw mapPgError(e);
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

/** Translate Postgres errors into API errors without leaking internals. */
export function mapPgError(e: unknown): unknown {
  if (e instanceof ApiError || !(e && typeof e === "object" && "code" in e)) return e;
  const err = e as { code?: string; message?: string };
  const msg = err.message ?? "Database error";
  switch (err.code) {
    case "P0002":
      return new ApiError(404, "not_found", msg);
    case "40001":
      return new ApiError(409, "version_conflict", "The record was changed by someone else. Reload and try again.");
    case "22023":
      return new ApiError(422, "invalid_operation", msg);
    case "42501":
      // Live tracking refusals carry their own codes (the app reacts to each).
      if (msg === "tracking_disabled") return new ApiError(409, "tracking_disabled", "Live tracking is switched off for this company");
      if (msg === "tracking_notice_required") return new ApiError(409, "tracking_notice_required", "The driver has not acknowledged the current tracking notice");
      return new ApiError(403, "forbidden", /row-level security/.test(msg) ? "You are not allowed to change this record" : msg);
    case "23503":
      return new ApiError(422, "invalid_reference", "A referenced record does not exist or belongs to another company");
    case "23505": {
      const constraint = (e as { constraint?: string }).constraint ?? "";
      if (constraint === "tours_driver_day_open_uidx" || /tours_driver_day_open_uidx/.test(msg)) return new ApiError(409, "driver_busy", "This driver already has an open tour on that day");
      if (constraint === "tours_vehicle_day_open_uidx" || /tours_vehicle_day_open_uidx/.test(msg)) return new ApiError(409, "vehicle_busy", "This vehicle is already used by an open tour on that day");
      // Raised by our own functions (no constraint): their message says what conflicts.
      if (!constraint && !/duplicate key/.test(msg)) return new ApiError(409, "conflict", msg);
      return new ApiError(409, "duplicate", "A record with these values already exists");
    }
    case "23514":
      return new ApiError(422, "constraint_violation", "The data violates a validation rule");
    case "P0001":
      return new ApiError(422, /plan limit/.test(msg) ? "plan_limit_reached" : /subscription inactive/.test(msg) ? "subscription_inactive" : "rejected", msg);
    case "22P02":
      return new ApiError(400, "invalid_input", "Invalid identifier or value");
    case "57014":
      return new ApiError(503, "database_timeout", "The request took too long – try again in a moment");
    case "55000": {
      // Lifecycle refusals raised by the database (20261119000200_tour_lifecycle): stable codes.
      const LIFECYCLE: Record<string, string> = {
        tour_closed: "The tour is closed (completed or cancelled) and accepts no further changes",
        tour_archived: "The tour is archived – restore it first",
        tour_protected: "The tour has protected history (deliveries, proofs, scans, tracking or execution) and cannot be deleted – archive it instead",
        stop_protected: "The stop has history (outcome, events, proofs or scans) and cannot be deleted – cancel it instead",
        stop_cancelled: "Dispatch cancelled this stop",
      };
      if (LIFECYCLE[msg]) {
        let detail: unknown;
        try {
          const raw = (e as unknown as { detail?: string }).detail;
          detail = raw ? JSON.parse(raw) : undefined;
        } catch {
          detail = undefined;
        }
        return new ApiError(409, msg, LIFECYCLE[msg]!, detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {});
      }
      return e;
    }
    default:
      return e;
  }
}

/** TLS for Postgres: false, true (system CAs) or { ca } (e.g. the Supabase root CA). Always verified. */
export type PgSsl = boolean | { ca: string };
export function pgSslOptions(ssl: PgSsl): { rejectUnauthorized: true; ca?: string } | undefined {
  if (!ssl) return undefined;
  return typeof ssl === "object" ? { rejectUnauthorized: true, ca: ssl.ca } : { rejectUnauthorized: true };
}
