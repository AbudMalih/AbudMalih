import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:8081"),
  OPTIMIZER_URL: z.url().default("http://localhost:8000"),
  /**
   * "supabase": verify Supabase access tokens (production).
   * "dev": accept the synthetic development identity without a token. Refused when NODE_ENV=production.
   */
  AUTH_MODE: z.enum(["supabase", "dev"]).default("supabase"),
  SUPABASE_URL: z.url().optional(),
  /** Legacy symmetric JWT secret. If unset, tokens are verified against SUPABASE_URL's JWKS. */
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  /** Server-side key used only to read memberships/subscriptions. Never sent to clients. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = Env.parse(env);
  if (config.AUTH_MODE === "dev" && config.NODE_ENV === "production") {
    throw new Error("AUTH_MODE=dev is not allowed in production");
  }
  if (config.AUTH_MODE === "supabase" && !config.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required when AUTH_MODE=supabase");
  }
  return config;
}
