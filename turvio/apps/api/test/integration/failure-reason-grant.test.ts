import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, postgresAvailable, type TestEnv } from "./helpers";

/** 20261119000400: signed-in users can no longer probe other companies' failure-reason codes. */
const available = await postgresAvailable();

describe.runIf(available)("app.failure_reason_allowed is private", () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await createTestEnv("frgrant");
  });
  afterAll(async () => {
    await env?.close();
  });

  it("authenticated and anon cannot execute it", async () => {
    for (const role of ["authenticated", "anon"]) {
      const r = await env.superuser.query<{ ok: boolean }>("select has_function_privilege($1, 'app.failure_reason_allowed(uuid, text)', 'EXECUTE') as ok", [role]);
      expect(r.rows[0]!.ok).toBe(false);
    }
  });
});
