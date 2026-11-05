import { defineConfig } from "vitest/config";

export default defineConfig({
  // The first test in each file applies all migrations to a fresh in-process Postgres.
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
});
