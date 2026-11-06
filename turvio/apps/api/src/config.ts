import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:8081"),
  OPTIMIZER_URL: z.url().default("http://localhost:8000"),
  /**
   * Postgres connection for tenant data. Locally: `scripts/db.sh url`.
   * Supabase: the project's connection string (role `postgres`, EU region).
   */
  DATABASE_URL: z.string().optional(),
  /** Enable TLS to Postgres (required for Supabase). */
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  /**
   * local    – TURVIO manages credentials in Postgres (dev, CI, self-hosted).
   * supabase – Supabase Auth (GoTrue) manages users, sessions and reset mails.
   * dev      – legacy synthetic identity without database (refused in production).
   */
  AUTH_PROVIDER: z.enum(["local", "supabase", "dev"]).default("local"),
  /** HS256 secret for local tokens (or Supabase legacy JWT secret). */
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().default("turvio-local"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Where links in emails point to. */
  DISPATCH_URL: z.url().default("http://localhost:3000"),
  ADMIN_URL: z.url().default("http://localhost:3001"),
  /** outbox = record mails in app_auth.outbox (development); smtp = send via SMTP_URL. */
  MAILER: z.enum(["outbox", "smtp"]).default("outbox"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("TURVIO <no-reply@turvio.invalid>"),
  /** Exposes GET /v1/dev/outbox for local testing of mails. Never in production. */
  DEV_MAILBOX: z.enum(["true", "false"]).default("false"),
  /** Proof-of-delivery files: local disk (dev/self-hosted) or a private Supabase Storage bucket. */
  PROOF_STORAGE: z.enum(["local", "supabase"]).default("local"),
  PROOF_STORAGE_DIR: z.string().default("./.data/proofs"),
  PROOF_BUCKET: z.string().default("proofs"),
  /** Address search: none (default – addresses are kept and marked "needs location"), nominatim or photon (self-hosted). */
  GEOCODER: z.enum(["none", "postgres", "nominatim", "photon"]).default("none"),
  GEOCODER_URL: z.url().optional(),
  GEOCODER_USER_AGENT: z.string().default("TURVIO (development)"),
  /** Self-hosted OSRM for road distances, times and geometry (same instance the optimizer uses). Empty = straight-line estimates, labelled. */
  OSRM_URL: z.url().optional(),
  /** Requests per minute per client IP (0 disables; put a proxy/WAF in front in production as well). */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(600),
  OSRM_TIMEOUT_MS: z.coerce.number().int().min(500).max(60000).default(8000),
  /** Run the retention purge and proof-file deletion worker inside the API process. */
  BACKGROUND_JOBS: z.enum(["true", "false"]).default("true"),
  /**
   * Two-step verification (aal2) for company administration (settings, members,
   * billing) and the platform admin API. Default: true in production, false otherwise.
   */
  REQUIRE_ADMIN_MFA: z.enum(["true", "false"]).optional(),
  /** Legacy synthetic mode (AUTH_PROVIDER=dev). */
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
});
export type Config = z.infer<typeof Env> & { requireAdminMfa: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.parse(env);
  const prod = parsed.NODE_ENV === "production";
  const config: Config = { ...parsed, requireAdminMfa: parsed.REQUIRE_ADMIN_MFA ? parsed.REQUIRE_ADMIN_MFA === "true" : prod };
  if (config.AUTH_PROVIDER === "dev" && prod) throw new Error("AUTH_PROVIDER=dev is not allowed in production");
  if (config.DEV_MAILBOX === "true" && prod) throw new Error("DEV_MAILBOX is not allowed in production");
  if (config.AUTH_PROVIDER !== "dev" && !config.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (config.AUTH_PROVIDER === "local" && !config.JWT_SECRET) throw new Error("JWT_SECRET (min. 32 characters) is required for AUTH_PROVIDER=local");
  if (config.AUTH_PROVIDER === "supabase" && (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !config.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required for AUTH_PROVIDER=supabase");
  }
  if (config.MAILER === "smtp" && !config.SMTP_URL) throw new Error("SMTP_URL is required for MAILER=smtp");
  if ((config.GEOCODER === "nominatim" || config.GEOCODER === "photon") && !config.GEOCODER_URL) throw new Error("GEOCODER_URL is required when GEOCODER is set");
  if (config.PROOF_STORAGE === "supabase" && (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("PROOF_STORAGE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  return config;
}
