import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { buildApp } from "../../src/app";
import { LocalAuthProvider } from "../../src/auth/local";
import { Db } from "../../src/db";
import { ChangeFeed } from "../../src/events";
import { OutboxMailer } from "../../src/mail";
import { SEED_PASSWORD_DEFAULT, seed, type SeedResult } from "../../src/seed";
import { PgTenancyRepository } from "../../src/tenancy";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { LocalProofStore } from "../../src/storage";
import type { Geocoder } from "../../src/geocode";
import type { RoutingProvider } from "../../src/routing";

/**
 * Integration harness: a fresh PostgreSQL database with all migrations, the
 * local auth schema and synthetic seed data, plus the real API in-process.
 * Requires the local server from scripts/db.sh (or TEST_PG_* overrides).
 */
const ROOT = join(import.meta.dirname, "../../../..");
const PORT = process.env.TEST_PG_PORT ?? "54329";
const HOST = process.env.TEST_PG_HOST ?? "/tmp";
const SERVICE_PASSWORD = process.env.TURVIO_DB_PASSWORD ?? "turvio-dev-only";
export const JWT_SECRET = "integration-test-secret-integration-test-secret";
export const PASSWORD = SEED_PASSWORD_DEFAULT;

const adminUrl = (db: string) => `postgres://postgres@localhost/${db}?host=${encodeURIComponent(HOST)}&port=${PORT}`;

export async function postgresAvailable(): Promise<boolean> {
  const c = new pg.Client({ connectionString: adminUrl("postgres") });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

/** Deterministic stand-in for the optimizer service: reverses each tour, round-robins across vehicles. */
export const fakeOptimizerFetch: typeof fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { vehicles: { id: string }[]; stops: { id: string }[] };
  const routes = body.vehicles.map((v) => ({ vehicleId: v.id, visits: [] as { stopId: string; arrivalMinute: number }[], distanceMeters: 1000, durationSeconds: 600 }));
  [...body.stops].reverse().forEach((s, i) => routes[i % routes.length]!.visits.push({ stopId: s.id, arrivalMinute: 480 + i }));
  return new Response(JSON.stringify({ routes, unassignedStopIds: [], matrixSource: "haversine_estimate", status: "feasible", engine: "or-tools" }), { status: 200 });
};

export async function createTestEnv(name: string, opts: { geocoder?: Geocoder; routing?: RoutingProvider; proofStore?: import("../../src/storage").ProofStore } = {}) {
  const dbName = `turvio_it_${name}_${process.pid}`;
  const admin = new pg.Client({ connectionString: adminUrl("postgres") });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const c = new pg.Client({ connectionString: adminUrl(dbName) });
  await c.connect();
  await c.query(readFileSync(join(ROOT, "supabase/local/00_supabase_stubs.sql"), "utf8"));
  for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql")).sort()) {
    await c.query(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
  }
  await c.query(readFileSync(join(ROOT, "supabase/local/10_local_auth.sql"), "utf8"));
  await c.query(readFileSync(join(ROOT, "supabase/local/20_local_service_role.sql"), "utf8"));
  await c.query(`alter role turvio_service password '${SERVICE_PASSWORD.replace(/'/g, "''")}'`);
  const data: SeedResult = await seed(c, { password: PASSWORD, demoDay: false });

  const serviceUrl = `postgres://turvio_service:${encodeURIComponent(SERVICE_PASSWORD)}@localhost:${PORT}/${dbName}`;
  const db = new Db(serviceUrl);
  const mailer = new OutboxMailer(db);
  const auth = new LocalAuthProvider(db, mailer, { secret: JWT_SECRET, issuer: "turvio-test", accessTtl: 900, refreshTtlDays: 30 });
  const events = new ChangeFeed(serviceUrl);
  const proofDir = mkdtempSync(join(tmpdir(), "turvio-proofs-"));
  await events.start();
  const app = buildApp({
    verifier: auth.verifier,
    tenancy: new PgTenancyRepository(db),
    optimizerUrl: "http://optimizer.test",
    fetchImpl: fakeOptimizerFetch,
    db,
    auth,
    mailer,
    events,
    urls: { dispatch: "http://dispatch.test", admin: "http://admin.test" },
    devMailbox: true,
    proofStore: opts.proofStore ?? new LocalProofStore(proofDir),
    geocoder: opts.geocoder,
    routing: opts.routing,
  });
  await app.ready();

  const tokens = new Map<string, string>();
  async function login(email: string, password = PASSWORD): Promise<string> {
    if (tokens.has(email)) return tokens.get(email)!;
    const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password } });
    if (res.statusCode !== 200) throw new Error(`login ${email} failed: ${res.statusCode} ${res.body}`);
    const t = res.json().accessToken as string;
    tokens.set(email, t);
    return t;
  }
  async function as(email: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: unknown) {
    const token = await login(email);
    return app.inject({ method, url, payload: payload as never, headers: { authorization: `Bearer ${token}` } });
  }
  async function close() {
    await app.close();
    await events.stop();
    await db.close();
    await c.end();
    const a = new pg.Client({ connectionString: adminUrl("postgres") });
    await a.connect();
    await a.query(`drop database if exists ${dbName} with (force)`);
    await a.end();
  }
  return { app, db, data, login, as, close, superuser: c, events, proofDir };
}

export type TestEnv = Awaited<ReturnType<typeof createTestEnv>>;
