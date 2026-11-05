import { createDispatchDataset } from "@turvio/shared";
import { createAuthClient, type TokenStore } from "../src/lib/auth";
import { applyOutbox, snapshotFrom, type MyTour } from "../src/lib/sync";
import { setAuthClient, useTourStore } from "../src/store/tourStore";

const ds = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const tour = { ...ds.tours.find((t) => t.name === "KAS-01")!, status: "planned" as const };
const stops = ds.stops.filter((s) => s.tourId === tour.id).map((s) => ({ ...s, status: "pending" as const, completedAt: undefined }));
const payload: { tours: MyTour[] } = {
  tours: [
    {
      tour,
      organization: { id: "org_jarbou", name: "JARBOU Logistik GmbH", timeZone: "Europe/Berlin" },
      depot: ds.depots.find((d) => d.id === tour.depotId)!,
      driver: { id: tour.driverId!, displayName: "Felix Wagner", maxShiftMinutes: 480 },
      vehicle: { id: tour.vehicleId!, label: "Sprinter 1", licensePlate: "KS-JL 120" },
      stops,
    },
  ],
};

function memoryStore(): TokenStore {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
}

let online = true;
let calls: { method: string; url: string; body?: unknown; auth?: string }[] = [];
let accessValid = true;
let rejectStatusWith: number | null = null;

const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
  if (!online) throw new TypeError("Network request failed");
  const method = init?.method ?? "GET";
  const auth = (init?.headers as Record<string, string>)?.Authorization;
  calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined, auth });
  const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
  if (url.endsWith("/v1/auth/login")) return json(200, { accessToken: "a1", refreshToken: "r1", expiresIn: 900, user: { id: "u1", email: "felix@jarbou.test", name: "Felix Wagner" } });
  if (url.endsWith("/v1/auth/refresh")) {
    accessValid = true;
    return json(200, { accessToken: "a2", refreshToken: "r2", expiresIn: 900, user: { id: "u1", email: "felix@jarbou.test", name: null } });
  }
  if (!accessValid) return json(401, { error: { code: "unauthenticated" } });
  if (url.endsWith("/v1/me/tours")) return json(200, payload);
  if (url.includes("/status")) return rejectStatusWith ? json(rejectStatusWith, { error: { code: "invalid_operation", message: "Tour was withdrawn" } }) : json(200, {});
  return json(404, {});
}) as unknown as typeof fetch;

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});
beforeEach(() => {
  online = true;
  accessValid = true;
  rejectStatusWith = null;
  calls = [];
  setAuthClient(createAuthClient({ baseUrl: "http://api.test", store: memoryStore(), fetchImpl: fetchMock }));
  useTourStore.setState({ user: null, outbox: [], tours: [], stops: [], syncState: "idle", syncMessage: null });
});

describe("driver server mode", () => {
  it("signs in and loads the published tour", async () => {
    await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
    const s = useTourStore.getState();
    expect(s.user?.email).toBe("felix@jarbou.test");
    expect(s.tours.map((t) => t.name)).toEqual(["KAS-01"]);
    expect(s.stops).toHaveLength(stops.length);
    expect(s.driverId).toBe(tour.driverId);
    expect(calls.find((c) => c.url.endsWith("/v1/me/tours"))!.auth).toBe("Bearer a1");
  });

  it("sends tour start and stop status to the server", async () => {
    await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
    useTourStore.getState().tourAction(tour.id, "start");
    useTourStore.getState().setStopStatus(stops[0]!.id, "delivered");
    await useTourStore.getState().sync();
    const posts = calls.filter((c) => c.method === "POST" && c.url.includes("/status"));
    expect(posts.map((p) => p.url)).toEqual([
      `http://api.test/v1/orgs/${tour.organizationId}/tours/${tour.id}/status`,
      `http://api.test/v1/orgs/${tour.organizationId}/stops/${stops[0]!.id}/status`,
    ]);
    expect(posts[1]!.body).toEqual({ status: "delivered" });
    expect(useTourStore.getState().outbox).toHaveLength(0);
  });

  it("keeps changes while offline and sends them when back online", async () => {
    await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
    online = false;
    useTourStore.getState().setStopStatus(stops[1]!.id, "failed", "Niemand da");
    await useTourStore.getState().sync();
    let s = useTourStore.getState();
    expect(s.syncState).toBe("offline");
    expect(s.outbox).toHaveLength(1);
    expect(s.stops.find((x) => x.id === stops[1]!.id)!.status).toBe("failed"); // shown immediately
    online = true;
    await useTourStore.getState().sync();
    s = useTourStore.getState();
    expect(s.outbox).toHaveLength(0);
    expect(calls.find((c) => c.url.endsWith(`/stops/${stops[1]!.id}/status`))!.body).toEqual({ status: "failed", notes: "Niemand da" });
  });

  it("refreshes an expired access token once and retries", async () => {
    await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
    accessValid = false;
    await useTourStore.getState().sync();
    expect(calls.some((c) => c.url.endsWith("/v1/auth/refresh"))).toBe(true);
    expect(calls.filter((c) => c.url.endsWith("/v1/me/tours")).at(-1)!.auth).toBe("Bearer a2");
    expect(useTourStore.getState().syncState).toBe("idle");
  });

  it("drops changes the server rejects and explains why", async () => {
    await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
    rejectStatusWith = 422;
    useTourStore.getState().setStopStatus(stops[2]!.id, "delivered");
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(0);
    expect(useTourStore.getState().syncMessage).toBe("Tour was withdrawn");
  });

  it("re-applies queued changes on top of fresh server data", () => {
    const snap = snapshotFrom(payload, "x");
    const merged = applyOutbox(snap, [{ id: "1", kind: "stop_status", orgId: "o", stopId: stops[0]!.id, status: "delivered", at: "2026-11-05T09:00:00.000Z" }]);
    expect(merged.stops.find((s) => s.id === stops[0]!.id)!.status).toBe("delivered");
    expect(snap.stops.find((s) => s.id === stops[0]!.id)!.status).toBe("pending");
  });
});
