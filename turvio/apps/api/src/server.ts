import { createVerifier } from "./auth";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { SupabaseTenancyRepository, syntheticTenancy } from "./tenancy";

const config = loadConfig();

const tenancy =
  config.AUTH_MODE === "dev"
    ? syntheticTenancy()
    : new SupabaseTenancyRepository(
        config.SUPABASE_URL!,
        config.SUPABASE_SERVICE_ROLE_KEY ??
          (() => {
            throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when AUTH_MODE=supabase");
          })(),
      );

const app = buildApp({
  verifier: createVerifier(config),
  tenancy,
  optimizerUrl: config.OPTIMIZER_URL,
  corsOrigins: config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  logger: true,
});

if (config.AUTH_MODE === "dev") {
  app.log.warn("AUTH_MODE=dev: all requests run as the synthetic driver of org_jarbou. Never use in production.");
}

await app.listen({ port: config.PORT, host: config.HOST });
