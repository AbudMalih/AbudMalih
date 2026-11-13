import pg from "pg";
import { readFileSync } from "node:fs";
import { DevTokenVerifier } from "./auth/tokens";
import { LocalAuthProvider } from "./auth/local";
import type { AuthProvider } from "./auth/provider";
import { SupabaseAuthProvider } from "./auth/supabase";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { Db, type PgSsl, withExactFloats } from "./db";
import { ChangeFeed } from "./events";
import { OutboxMailer, SmtpMailer, type Mailer } from "./mail";
import { PgTenancyRepository, syntheticTenancy } from "./tenancy";
import { NoGeocoder, NominatimGeocoder, PhotonGeocoder, PostgresGeocoder, type Geocoder } from "./geocode";
import { LocalProofStore, SupabaseProofStore, processStorageDeletions, type ProofStore } from "./storage";
import { resolve } from "node:path";
import { OsrmRouting } from "./routing";

const config = loadConfig();
const corsOrigins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

let app;
if (config.AUTH_PROVIDER === "dev") {
  // Legacy synthetic mode without database (development only).
  app = buildApp({ verifier: new DevTokenVerifier(), tenancy: syntheticTenancy(), optimizerUrl: config.OPTIMIZER_URL, corsOrigins, logger: true });
  app.log.warn("AUTH_PROVIDER=dev: synthetic identity, no database. Never use in production.");
} else {
  const ssl: PgSsl = config.DATABASE_SSL !== "true" ? false : config.DATABASE_SSL_CA_FILE ? { ca: readFileSync(config.DATABASE_SSL_CA_FILE, "utf8") } : true;
  const db = new Db(config.DATABASE_URL!, ssl);
  const log = (m: string) => console.log(`[turvio-api] ${m}`);
  const mailer: Mailer = config.MAILER === "smtp" ? new SmtpMailer(config.SMTP_URL!, config.MAIL_FROM) : new OutboxMailer(db, log);
  const auth: AuthProvider =
    config.AUTH_PROVIDER === "supabase"
      ? new SupabaseAuthProvider({ url: config.SUPABASE_URL!, anonKey: config.SUPABASE_ANON_KEY!, serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY!, jwtSecret: config.SUPABASE_JWT_SECRET })
      : new LocalAuthProvider(db, mailer, {
          secret: config.JWT_SECRET!,
          issuer: config.JWT_ISSUER,
          accessTtl: config.ACCESS_TOKEN_TTL_SECONDS,
          refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
        });
  const proofStore: ProofStore =
    config.PROOF_STORAGE === "supabase"
      ? new SupabaseProofStore(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, config.PROOF_BUCKET)
      : new LocalProofStore(resolve(config.PROOF_STORAGE_DIR));
  const geocoder: Geocoder =
    config.GEOCODER === "postgres"
      ? config.GEOCODER_DATABASE_URL
        ? new PostgresGeocoder(((pool) => (sql: string, params: unknown[]) => pool.query(sql, params) as never)(withExactFloats(new pg.Pool({ connectionString: config.GEOCODER_DATABASE_URL, max: 4 }))))
        : new PostgresGeocoder((sql, params) => db.asService((tx) => tx.query(sql, params)) as never)
      : config.GEOCODER === "nominatim"
      ? new NominatimGeocoder(config.GEOCODER_URL!, config.GEOCODER_USER_AGENT)
      : config.GEOCODER === "photon"
        ? new PhotonGeocoder(config.GEOCODER_URL!, config.GEOCODER_USER_AGENT)
        : new NoGeocoder();
  const events = new ChangeFeed(config.DATABASE_URL!, log, ssl);
  await events.start();
  app = buildApp({
    verifier: auth.verifier,
    tenancy: new PgTenancyRepository(db),
    optimizerUrl: config.OPTIMIZER_URL,
    corsOrigins,
    logger: true,
    db,
    auth,
    mailer,
    events,
    urls: { dispatch: config.DISPATCH_URL, admin: config.ADMIN_URL },
    devMailbox: config.DEV_MAILBOX === "true",
    proofStore,
    geocoder,
    rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
    trustProxy: config.TRUST_PROXY === "true" ? true : config.TRUST_PROXY === "false" ? false : Number(config.TRUST_PROXY),
    requireAdminMfa: config.requireAdminMfa,
    routing: config.OSRM_URL ? new OsrmRouting(config.OSRM_URL, { timeoutMs: config.OSRM_TIMEOUT_MS, maxSnapMeters: config.OSRM_MAX_SNAP_METERS }) : undefined,
    locationDataVersions: { road: config.ROUTING_DATA_VERSION ?? null, address: config.ADDRESS_DATA_VERSION ?? null },
    systemInfo: {
      authProvider: config.AUTH_PROVIDER,
      adminMfaRequired: config.requireAdminMfa,
      mailer: config.MAILER,
      proofStorage: config.PROOF_STORAGE,
      geocoder: config.GEOCODER,
      addressDataVersion: config.ADDRESS_DATA_VERSION ?? null,
      roadDataVersion: config.ROUTING_DATA_VERSION ?? null,
      release: process.env.TURVIO_RELEASE ?? null,
    },
  });
  // Background jobs: retention purge (hourly) and deletion of files of removed proofs.
  let jobs: NodeJS.Timeout | undefined;
  if (config.BACKGROUND_JOBS === "true") {
    const run = async () => {
      try {
        await db.asService((tx) => tx.query(`select app.purge_expired_data()`));
        const n = await processStorageDeletions(db, proofStore, log);
        if (n) log(`deleted ${n} proof file(s)`);
      } catch (e) {
        log(`background job failed: ${(e as Error).message}`);
      }
    };
    void run();
    jobs = setInterval(run, 60 * 60 * 1000);
  }
  const shutdown = async () => {
    if (jobs) clearInterval(jobs);
    await app!.close();
    await events.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

await app.listen({ port: config.PORT, host: config.HOST });
