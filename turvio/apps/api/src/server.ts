import { DevTokenVerifier } from "./auth/tokens";
import { LocalAuthProvider } from "./auth/local";
import type { AuthProvider } from "./auth/provider";
import { SupabaseAuthProvider } from "./auth/supabase";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { Db } from "./db";
import { ChangeFeed } from "./events";
import { OutboxMailer, SmtpMailer, type Mailer } from "./mail";
import { PgTenancyRepository, syntheticTenancy } from "./tenancy";

const config = loadConfig();
const corsOrigins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

let app;
if (config.AUTH_PROVIDER === "dev") {
  // Legacy synthetic mode without database (development only).
  app = buildApp({ verifier: new DevTokenVerifier(), tenancy: syntheticTenancy(), optimizerUrl: config.OPTIMIZER_URL, corsOrigins, logger: true });
  app.log.warn("AUTH_PROVIDER=dev: synthetic identity, no database. Never use in production.");
} else {
  const ssl = config.DATABASE_SSL === "true";
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
  });
  const shutdown = async () => {
    await app!.close();
    await events.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

await app.listen({ port: config.PORT, host: config.HOST });
