import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDispatchDataset } from "@turvio/shared";
import { createAuthClient, type TokenStore } from "../src/lib/auth";
import { applyOutbox, snapshotFrom, type MyTour } from "../src/lib/sync";
import { fileDeps, setAuthClient, useTourStore } from "../src/store/tourStore";

const ds = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const tour = { ...ds.tours.find((t) => t.name === "KAS-01")!, status: "planned" as const };
const stops = ds.stops.filter((s) => s.tourId === tour.id && s.type === "delivery").map((s) => ({ ...s, status: "pending" as const, completedAt: undefined }));
const payload = (): { tours: MyTour[] } => ({
  tours: [
    {
      tour,
      organization: { id: tour.organizationId, name: "JARBOU Logistik GmbH", timeZone: "Europe/Berlin" },
      depot: ds.depots.find((d) => d.id === tour.depotId)!,
      driver: { id: tour.driverId!, displayName: "Felix Wagner", maxShiftMinutes: 480 },
      vehicle: { id: tour.vehicleId!, label: "Sprinter 1", licensePlate: "KS-JL 120" },
      stops,
    },
  ],
});

function memoryStore(): TokenStore {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
}

let online = true;
let calls: { method: string; url: string; body?: Record<string, unknown>; auth?: string }[] = [];
let accessValid = true;
let rejectWith: number | null = null;
/** Simulates "server committed, response lost": the request reaches the server, the client sees a network error. */
let dropResponseOnce = false;
const serverSeen = new Map<string, number>();

const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
  if (!online) throw new TypeError("Network request failed");
  const method = init?.method ?? "GET";
  const auth = (init?.headers as Record<string, string>)?.Authorization;
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body, auth });
  const json = (status: number, b: unknown) => ({ ok: status < 400, status, json: async () => b }) as Response;
  if (url.endsWith("/v1/auth/login")) return json(200, { accessToken: "a1", refreshToken: "r1", expiresIn: 900, user: { id: "u1", email: "felix@jarbou.test", name: "Felix Wagner" } });
  if (url.endsWith("/v1/auth/refresh")) {
    accessValid = true;
    return json(200, { accessToken: "a2", refreshToken: "r2", expiresIn: 900, user: { id: "u1", email: "felix@jarbou.test", name: null } });
  }
  if (url.endsWith("/v1/auth/logout")) return json(204, {});
  if (!accessValid) return json(401, { error: { code: "unauthenticated" } });
  if (url.endsWith("/v1/me/tours") && method === "GET") return json(200, payload());
  if (method === "POST") {
    const key = String(body?.clientEventId ?? body?.id ?? url);
    serverSeen.set(key, (serverSeen.get(key) ?? 0) + 1);
    if (rejectWith) return json(rejectWith, { error: { code: "invalid_operation", message: "Tour was withdrawn" } });
    if (dropResponseOnce) {
      dropResponseOnce = false;
      throw new TypeError("Network request failed"); // after the server processed it
    }
    return json(url.includes("/proofs") ? 201 : 200, {});
  }
  return json(404, {});
}) as unknown as typeof fetch;

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});
beforeEach(async () => {
  online = true;
  accessValid = true;
  rejectWith = null;
  dropResponseOnce = false;
  calls = [];
  serverSeen.clear();
  setAuthClient(createAuthClient({ baseUrl: "http://api.test", store: memoryStore(), fetchImpl: fetchMock }));
  useTourStore.setState({ user: null, outbox: [], failed: [], tours: [], stops: [], scans: {}, syncState: "idle", syncMessage: null, settingsByOrg: {} });
  await useTourStore.getState().signIn("felix@jarbou.test", "secret-123456");
  calls = [];
});

const posts = () => calls.filter((c) => c.method === "POST");

describe("driver server mode", () => {
  it("signs in and loads the published tour with the company's driver settings", () => {
    const s = useTourStore.getState();
    expect(s.user?.email).toBe("felix@jarbou.test");
    expect(s.tours.map((t) => t.name)).toEqual(["KAS-01"]);
    expect(s.stops).toHaveLength(stops.length);
    expect(s.settingsByOrg[tour.organizationId]!.failureReasons.length).toBeGreaterThan(3);
  });

  it("sends tour start, arrival and delivery with client event ids, in order", async () => {
    useTourStore.getState().tourAction(tour.id, "start");
    useTourStore.getState().setStopStatus(stops[0]!.id, "in_progress");
    useTourStore.getState().setStopStatus(stops[0]!.id, "delivered");
    await useTourStore.getState().sync();
    expect(posts().map((p) => p.url.replace("http://api.test", ""))).toEqual([
      `/v1/orgs/${tour.organizationId}/tours/${tour.id}/status`,
      `/v1/orgs/${tour.organizationId}/stops/${stops[0]!.id}/status`,
      `/v1/orgs/${tour.organizationId}/stops/${stops[0]!.id}/status`,
    ]);
    expect(posts()[2]!.body).toMatchObject({ status: "delivered", clientEventId: expect.any(String), occurredAt: expect.any(String) });
    expect(useTourStore.getState().outbox).toHaveLength(0);
  });

  it("keeps changes offline, survives an app restart and sends them when back online", async () => {
    online = false;
    useTourStore.getState().setStopStatus(stops[1]!.id, "failed", { failureReason: "recipient_absent", notes: "Niemand da" });
    useTourStore.getState().addNote(stops[2]!.id, "Hinterhof");
    await useTourStore.getState().sync();
    expect(useTourStore.getState().syncState).toBe("offline");
    expect(useTourStore.getState().outbox).toHaveLength(2);
    // "Restart": the persisted state is read back from storage.
    await new Promise((r) => setTimeout(r, 10));
    const saved = (await AsyncStorage.getItem("turvio-driver-v4"))!;
    expect(JSON.parse(saved).state.outbox.map((o: { kind: string }) => o.kind)).toEqual(["stop_status", "stop_note"]);
    useTourStore.setState({ outbox: [], stops: [] }); // process killed: memory gone…
    await AsyncStorage.setItem("turvio-driver-v4", saved); // …storage still has the last persisted state
    await useTourStore.persist.rehydrate();
    expect(useTourStore.getState().outbox).toHaveLength(2);
    expect(useTourStore.getState().stops.find((x) => x.id === stops[1]!.id)!.status).toBe("failed");
    online = true;
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(0);
    expect(posts()[0]!.body).toMatchObject({ status: "failed", failureReason: "recipient_absent", notes: "Niemand da" });
    expect(posts()[1]!.url).toContain(`/stops/${stops[2]!.id}/note`);
  });

  it("retries an interrupted upload with the same client id (no duplicate on the server)", async () => {
    dropResponseOnce = true;
    useTourStore.getState().setStopStatus(stops[3]!.id, "delivered");
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(1);
    const id = (useTourStore.getState().outbox[0] as { id: string }).id;
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(0);
    // The server received the same clientEventId twice – the API treats it as one event (see API tests).
    expect(serverSeen.get(id)).toBe(2);
  });

  it("uploads proof of delivery from a private file and deletes the file afterwards", async () => {
    const files = (globalThis as { __files?: Map<string, string> }).__files!;
    files.set("file:///doc/turvio-pod/p1.jpg", "/9j/AAAA");
    const deleted: string[] = [];
    const orig = fileDeps.deleteFile;
    fileDeps.deleteFile = async (u) => {
      deleted.push(u);
      files.delete(u);
    };
    await useTourStore.getState().captureProof(stops[4]!.id, { photo: { uri: "file:///doc/turvio-pod/p1.jpg" }, signatureSvg: "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1 1 L2 2\"/></svg>", recipientName: "E. Beispiel" });
    expect(useTourStore.getState().stops.find((s) => s.id === stops[4]!.id)!.proofs).toHaveLength(2); // visible at once, before upload
    useTourStore.getState().setStopStatus(stops[4]!.id, "delivered");
    await useTourStore.getState().sync();
    fileDeps.deleteFile = orig;
    const proofPosts = posts().filter((p) => p.url.includes("/proofs"));
    expect(proofPosts.map((p) => p.body!.kind)).toEqual(["photo", "signature"]);
    expect(proofPosts[0]!.body).toMatchObject({ contentType: "image/jpeg", dataBase64: "/9j/AAAA", recipientName: "E. Beispiel" });
    expect(proofPosts[0]!.body!.location).toBeUndefined(); // company has not enabled PoD location
    expect(deleted).toEqual(["file:///doc/turvio-pod/p1.jpg"]);
    expect(useTourStore.getState().outbox).toHaveLength(0);
  });

  it("refreshes an expired access token once and retries", async () => {
    accessValid = false;
    await useTourStore.getState().sync();
    expect(calls.some((c) => c.url.endsWith("/v1/auth/refresh"))).toBe(true);
    expect(calls.filter((c) => c.url.endsWith("/v1/me/tours")).at(-1)!.auth).toBe("Bearer a2");
    expect(useTourStore.getState().syncState).toBe("idle");
  });

  it("moves changes the server rejects to a visible failed list (retry or discard)", async () => {
    rejectWith = 422;
    useTourStore.getState().setStopStatus(stops[5]!.id, "delivered");
    await useTourStore.getState().sync();
    const s = useTourStore.getState();
    expect(s.outbox).toHaveLength(0);
    expect(s.failed).toHaveLength(1);
    expect(s.syncMessage).toBe("Tour was withdrawn");
    rejectWith = null;
    s.retryFailed(s.failed[0]!.item.id);
    await useTourStore.getState().sync();
    expect(useTourStore.getState().failed).toHaveLength(0);
  });

  it("creates a personal route and its stops before sending their statuses", async () => {
    online = false;
    const own = useTourStore.getState().createRoute("Meine Runde", "2026-11-05");
    const { stop } = useTourStore.getState().addStop(own.id, { address: { street: "Lister Meile", houseNumber: "4", postalCode: "30161", city: "Hannover" }, trackingNumbers: ["TVOOWN00001"] });
    useTourStore.getState().addStop(own.id, { address: { street: "Lister Meile", houseNumber: "4", postalCode: "30161", city: "Hannover" }, trackingNumbers: ["TVOOWN00002"] });
    useTourStore.getState().setStopStatus(stop.id, "delivered");
    online = true;
    await useTourStore.getState().sync();
    const order = posts().map((p) => p.url.replace("http://api.test", "").replace(tour.organizationId, "ORG"));
    expect(order).toEqual(["/v1/me/tours", "/v1/orgs/ORG/stops", "/v1/orgs/ORG/stops", `/v1/orgs/ORG/stops/${stop.id}/status`]);
    expect(posts()[1]!.body!.stops).toEqual([expect.objectContaining({ id: stop.id, trackingNumbers: ["TVOOWN00001"] })]);
    expect(posts()[2]!.body!.stops).toEqual([expect.objectContaining({ id: stop.id, trackingNumbers: ["TVOOWN00001", "TVOOWN00002"] })]);
  });

  it("re-applies queued changes on top of fresh server data", () => {
    const snap = snapshotFrom(payload(), "x");
    const merged = applyOutbox(snap, [
      { id: "1", kind: "stop_status", orgId: "o", stopId: stops[0]!.id, status: "attempted", failureReason: "refused", at: "2026-11-05T09:00:00.000Z" },
      { id: "2", kind: "stop_update", orgId: "o", stopId: stops[1]!.id, locked: true, at: "2026-11-05T09:00:00.000Z" },
      { id: "3", kind: "scans", orgId: "o", tourId: tour.id, scans: [{ code: stops[2]!.parcels[0]!.trackingNumber.toUpperCase(), at: "2026-11-05T09:00:00.000Z" }], at: "2026-11-05T09:00:00.000Z" },
    ]);
    expect(merged.stops.find((s) => s.id === stops[0]!.id)).toMatchObject({ status: "attempted", failureReason: "refused" });
    expect(merged.stops.find((s) => s.id === stops[1]!.id)!.locked).toBe(true);
    expect(merged.stops.find((s) => s.id === stops[2]!.id)!.parcels[0]!.loadedAt).toBeDefined();
    expect(snap.stops.find((s) => s.id === stops[0]!.id)!.status).toBe("pending");
  });
});
