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
export class Db {
  readonly pool: pg.Pool;

  constructor(connectionString: string, ssl: PgSsl = false) {
    this.pool = new pg.Pool({ connectionString, max: 10, ssl: pgSslOptions(ssl) });
  }

  async asUser<T>(claims: Claims, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
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
    const client = await this.pool.connect();
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
      return new ApiError(409, "duplicate", "A record with these values already exists");
    }
    case "23514":
      return new ApiError(422, "constraint_violation", "The data violates a validation rule");
    case "P0001":
      return new ApiError(422, /plan limit/.test(msg) ? "plan_limit_reached" : /subscription inactive/.test(msg) ? "subscription_inactive" : "rejected", msg);
    case "22P02":
      return new ApiError(400, "invalid_input", "Invalid identifier or value");
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
