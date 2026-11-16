import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every HTTP method the Dispatch API client sends must be exported by the session proxy route –
 * otherwise Next.js answers 405 before the request reaches TURVIO (Settings → preferences and
 * driver rules use PUT).
 */
describe("session proxy route", () => {
  it("exports every method used by lib/api.ts callers", () => {
    const route = readFileSync(join(__dirname, "../app/api/turvio/[...path]/route.ts"), "utf8");
    const exported = new Set([...route.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) =/g)].map((m) => m[1]));
    const used = new Set<string>();
    for (const dir of ["lib", "components"]) {
      for (const f of require("node:fs").readdirSync(join(__dirname, "..", dir)) as string[]) {
        if (!/\.tsx?$/.test(f)) continue;
        for (const m of readFileSync(join(__dirname, "..", dir, f), "utf8").matchAll(/api(?:<[^>]*>)?\("(GET|POST|PUT|PATCH|DELETE)"/g)) used.add(m[1]!);
      }
    }
    expect(used.has("PUT")).toBe(true);
    expect([...used].filter((m) => !exported.has(m))).toEqual([]);
  });
});
