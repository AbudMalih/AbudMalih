import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import type { ChangeEvent } from "../src/events";
import { RateLimiter } from "../src/geocode";
import { liveEventFor } from "../src/routes/events";
import { syntheticTenancy } from "../src/tenancy";
import { AuthError, type TokenVerifier } from "../src/auth/tokens";

const ORG = "org-a";
const ev = (e: Partial<ChangeEvent>): ChangeEvent => ({ org: ORG, depot: "dep-h", tour: "t1", table: "tours", op: "update", ...e });
const m = (role: "owner" | "admin" | "dispatcher" | "driver", depotIds: string[] | null = null, allLocations = false) => ({ organizationId: ORG, role, depotIds, allLocations });

describe("live feed (SSE) isolation", () => {
  it("other companies' events never reach a subscriber", () => {
    for (const r of ["owner", "admin", "dispatcher"] as const) expect(liveEventFor(m(r, ["dep-h"], true), ev({ org: "org-b" }))).toBeNull();
  });
  it("a dispatcher gets only assigned locations; positions too", () => {
    const d = m("dispatcher", ["dep-h"]);
    expect(liveEventFor(d, ev({}))).toBe("change");
    expect(liveEventFor(d, ev({ table: "driver_positions" }))).toBe("position");
    expect(liveEventFor(d, ev({ depot: "dep-b" }))).toBeNull();
    expect(liveEventFor(d, ev({ depot: "dep-b", table: "driver_positions" }))).toBeNull();
    expect(liveEventFor(d, ev({ depot: null }))).toBeNull();
  });
  it("a dispatcher without locations gets nothing (fail-closed), all-locations gets everything", () => {
    for (const none of [m("dispatcher", null), m("dispatcher", [])]) {
      expect(liveEventFor(none, ev({}))).toBeNull();
      expect(liveEventFor(none, ev({ table: "driver_positions" }))).toBeNull();
    }
    expect(liveEventFor(m("dispatcher", null, true), ev({ depot: "dep-b", table: "driver_positions" }))).toBe("position");
  });
  it("owners and admins are company-wide; drivers never get positions", () => {
    expect(liveEventFor(m("owner"), ev({ depot: "dep-x", table: "driver_positions" }))).toBe("position");
    expect(liveEventFor(m("admin"), ev({ depot: "dep-x" }))).toBe("change");
    expect(liveEventFor(m("driver", ["dep-h"]), ev({ table: "driver_positions" }))).toBeNull();
  });
});

describe("rate limiting", () => {
  it("flooding with new keys does not reset an existing bucket (LRU eviction, not clear)", () => {
    let now = 0;
    const l = new RateLimiter(1 / 60, 2, () => now);
    expect(l.take("victim")).toBe(true);
    expect(l.take("victim")).toBe(true);
    expect(l.take("victim")).toBe(false);
    for (let i = 0; i < 9_000; i++) l.take(`k${i}`);
    expect(l.take("victim")).toBe(false); // still limited, the flood did not refill it
    now += 60_000;
    expect(l.take("victim")).toBe(true);
  });

  /** Verifier that accepts "user-<id>" tokens – no crypto, the limiter is under test. */
  const verifier: TokenVerifier = {
    async verify(token: string) {
      if (!token.startsWith("user-")) throw new AuthError("bad token");
      return { userId: token.slice(5), email: `${token}@test` } as never;
    },
  } as TokenVerifier;
  const makeApp = () => buildApp({ verifier, tenancy: syntheticTenancy(), optimizerUrl: "http://optimizer.test", rateLimitPerMinute: 8, trustProxy: false });
  const me = (app: ReturnType<typeof makeApp>, token?: string) =>
    app.inject({ method: "GET", url: "/v1/me", remoteAddress: "10.0.0.1", headers: token ? { authorization: `Bearer ${token}` } : {} });

  it("signed-in users are limited per user: one busy user does not block colleagues behind the same address", async () => {
    const app = makeApp();
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await me(app, "user-a")).statusCode); // burst = 8/4 = 2
    expect(codes.slice(0, 2).every((c) => c !== 429)).toBe(true);
    expect(codes.slice(2)).toEqual([429, 429]);
    // Same IP, another user: not affected.
    expect((await me(app, "user-b")).statusCode).not.toBe(429);
    await app.close();
  });

  it("requests without a token keep the per-IP limit", async () => {
    const app = makeApp();
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await me(app)).statusCode);
    expect(codes.slice(0, 2)).toEqual([401, 401]);
    expect(codes.slice(2)).toEqual([429, 429]);
    await app.close();
  });

  it("a user cannot escape the per-user limit by changing address", async () => {
    const app = makeApp();
    for (let i = 0; i < 2; i++) await me(app, "user-c");
    const other = await app.inject({ method: "GET", url: "/v1/me", remoteAddress: "10.9.9.9", headers: { authorization: "Bearer user-c" } });
    expect(other.statusCode).toBe(429);
    await app.close();
  });
});
