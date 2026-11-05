import { defineConfig } from "vitest/config";

export default defineConfig({
  // Integration tests create a database and hash passwords (scrypt) – allow time.
  test: { hookTimeout: 120_000, testTimeout: 30_000, fileParallelism: false },
});
