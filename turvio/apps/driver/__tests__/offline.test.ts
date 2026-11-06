import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDispatchDataset, isOpen, type Stop } from "@turvio/shared";
import { dropIndex, ROW } from "../src/components/ReorderList";
import { createAuthClient, type TokenStore } from "../src/lib/auth";
import type { MyTour } from "../src/lib/sync";
import { fileDeps, setAuthClient, useTourStore } from "../src/store/tourStore";

/**
 * Stateful fake TURVIO server: applies status events once per clientEventId,
 * stores proofs once per id, and lets a "dispatcher" change the tour meanwhile.
 */
const ds = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const baseTour = { ...ds.tours.find((t) => t.name === "KAS-01")!, status: "planned" as const };
let server: { stops: Stop[]; tourStatus: string; events: Map<string, unknown>; proofs: Map<string, unknown>; failProofs: number; requests: number };

function reset() {
  const stops = ds.stops
    .filter((s) => s.tourId === baseTour.id)
    .concat(Array.from({ length: 20 }, (_, i) => ({ ...ds.stops.find((s) => s.tourId === baseTour.id)!, id: `extra-${i}`, sequence: 100 + i, type: "delivery" as const, parcels: [] })))
    .map((s) => ({ ...s, status: "pending" as const, completedAt: undefined, type: "delivery" as const }));
  server = { stops, tourStatus: "planned", events: new Map(), proofs: new Map(), failProofs: 0, requests: 0 };
}

let online = true;
const json = (status: number, b: unknown) => ({ ok: status < 400, status, json: async () => b }) as Response;
const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
  if (!online) throw new TypeError("Network request failed");
  server.requests++;
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (url.endsWith("/v1/auth/login")) return json(200, { accessToken: "a", refreshToken: "r", expiresIn: 900, user: { id: "u", email: "d@x.test", name: "D" } });
  if (url.endsWith("/v1/me/tours") && method === "GET") {
    const payload: { tours: MyTour[] } = {
      tours: [{ tour: { ...baseTour, status: server.tourStatus as never }, organization: { id: baseTour.organizationId, name: "JARBOU", timeZone: "Europe/Berlin" }, depot: ds.depots.find((d) => d.id === baseTour.depotId)!, driver: { id: baseTour.driverId!, displayName: "Felix", maxShiftMinutes: 480 }, vehicle: null, stops: server.stops }],
    };
    return json(200, payload);
  }
  const stopStatus = /\/stops\/([^/]+)\/status$/.exec(url);
  if (stopStatus) {
    const stop = server.stops.find((s) => s.id === stopStatus[1]);
    if (!stop) return json(404, { error: { code: "not_found", message: "Stop not found" } });
    if (!server.events.has(body.clientEventId)) {
      server.events.set(body.clientEventId, body);
      Object.assign(stop, { status: body.status, completedAt: isOpen(body.status) ? undefined : body.occurredAt, failureReason: body.failureReason });
    }
    return json(200, {});
  }
  if (/\/tours\/[^/]+\/status$/.test(url)) {
    server.tourStatus = body.status;
    return json(200, {});
  }
  if (url.includes("/proofs")) {
    if (server.failProofs > 0) {
      server.failProofs--;
      return json(500, { error: { code: "internal_error", message: "storage unavailable" } });
    }
    server.proofs.set(body.id, body);
    return json(201, {});
  }
  return json(200, {});
}) as unknown as typeof fetch;

function memoryStore(): TokenStore {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), remove: async (k) => void m.delete(k) };
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});
beforeEach(async () => {
  reset();
  online = true;
  setAuthClient(createAuthClient({ baseUrl: "http://api.test", store: memoryStore(), fetchImpl: fetchMock }));
  useTourStore.setState({ user: null, outbox: [], failed: [], tours: [], stops: [], scans: {}, roads: {}, syncState: "idle", syncMessage: null, settingsByOrg: {} });
  await useTourStore.getState().signIn("d@x.test", "secret-123456");
  fileDeps.readFileBase64 = async () => "/9j/AAAA";
  fileDeps.deleteFile = async () => undefined;
});

/** Simulates killing the app: memory is lost, storage keeps the last persisted state. */
async function restartApp() {
  await new Promise((r) => setTimeout(r, 5));
  const saved = (await AsyncStorage.getItem("turvio-driver-v4"))!;
  useTourStore.setState({ outbox: [], stops: [], tours: [], failed: [] });
  await AsyncStorage.setItem("turvio-driver-v4", saved);
  await useTourStore.persist.rehydrate();
}

describe("offline reliability", () => {
  it("20 deliveries and proofs offline, app restart, reconnect: nothing lost, nothing duplicated", async () => {
    const s = useTourStore.getState();
    s.tourAction(baseTour.id, "start");
    online = false; // connection lost during the tour
    const open = useTourStore.getState().stops.filter((x) => isOpen(x.status)).slice(0, 20);
    for (const [i, stop] of open.entries()) {
      if (i % 5 === 4) useTourStore.getState().setStopStatus(stop.id, "attempted", { failureReason: "recipient_absent" });
      else {
        await useTourStore.getState().captureProof(stop.id, { signatureSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1 L2 2"/></svg>', recipientName: `R${i}` });
        useTourStore.getState().setStopStatus(stop.id, "delivered");
      }
    }
    await useTourStore.getState().sync();
    expect(useTourStore.getState().syncState).toBe("offline");
    const queued = useTourStore.getState().outbox.length;
    expect(queued).toBe(1 + 20 + 16); // tour start + 20 statuses + 16 signatures
    await restartApp();
    expect(useTourStore.getState().outbox).toHaveLength(queued);
    expect(useTourStore.getState().stops.filter((x) => !isOpen(x.status))).toHaveLength(20);
    online = true;
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(0);
    expect(useTourStore.getState().failed).toHaveLength(0);
    expect(server.events.size).toBe(20);
    expect(server.proofs.size).toBe(16);
    expect(server.stops.filter((x) => !isOpen(x.status))).toHaveLength(20);
    expect(server.tourStatus).toBe("in_progress");
  });

  it("a failed evidence upload is retried and stored exactly once", async () => {
    const stop = useTourStore.getState().stops[0]!;
    server.failProofs = 2;
    await useTourStore.getState().captureProof(stop.id, { photo: { uri: "file:///p.jpg" } });
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(1); // 500 = transient -> kept
    await useTourStore.getState().sync();
    await useTourStore.getState().sync();
    expect(useTourStore.getState().outbox).toHaveLength(0);
    expect(server.proofs.size).toBe(1);
  });

  it("dispatcher moves a stop away while the driver is offline: the queued change is shown as rejected, the rest is applied", async () => {
    const [a, b] = useTourStore.getState().stops.filter((x) => isOpen(x.status));
    online = false;
    useTourStore.getState().setStopStatus(a!.id, "delivered");
    useTourStore.getState().setStopStatus(b!.id, "delivered");
    server.stops = server.stops.filter((x) => x.id !== a!.id); // dispatcher reassigned it to another tour
    online = true;
    await useTourStore.getState().sync();
    const st = useTourStore.getState();
    expect(st.outbox).toHaveLength(0);
    expect(st.failed.map((f) => f.item.kind === "stop_status" && f.item.stopId)).toEqual([a!.id]);
    expect(st.stops.find((x) => x.id === a!.id)).toBeUndefined(); // server state wins for the moved stop
    expect(server.stops.find((x) => x.id === b!.id)!.status).toBe("delivered");
  });

  it("re-sending after a lost response does not duplicate (server-side idempotency)", async () => {
    const stop = useTourStore.getState().stops[0]!;
    useTourStore.getState().setStopStatus(stop.id, "delivered");
    const item = useTourStore.getState().outbox[0]!;
    await useTourStore.getState().sync();
    useTourStore.setState({ outbox: [item] }); // e.g. restored from an older backup / response lost
    await useTourStore.getState().sync();
    expect(server.events.size).toBe(1);
  });
});

describe("route editing in the app", () => {
  it("edit address offline drops the old pin, merge keeps parcels, reorder by drag", () => {
    const st = useTourStore.getState();
    const [a, b, c] = st.stops.filter((x) => isOpen(x.status));
    st.editStop(a!.id, { address: { street: "Neue Straße", houseNumber: "1", postalCode: "34117", city: "Kassel" } });
    expect(useTourStore.getState().stops.find((x) => x.id === a!.id)).toMatchObject({ location: null, address: { street: "Neue Straße" } });
    const parcels = b!.parcels.length + c!.parcels.length;
    useTourStore.getState().mergeStops(b!.id, c!.id);
    expect(useTourStore.getState().stops.find((x) => x.id === c!.id)!.parcels).toHaveLength(parcels);
    expect(() => useTourStore.getState().removeStop(c!.id)).toThrow(/dispatch/);
    expect(dropIndex(2, ROW * 1.6, 10)).toBe(4);
    expect(dropIndex(2, -ROW * 9, 10)).toBe(0);
    const ids = useTourStore.getState().stops.filter((x) => isOpen(x.status)).sort((x, y) => x.sequence - y.sequence).map((x) => x.id);
    useTourStore.getState().setOpenOrder(baseTour.id, [...ids].reverse());
    const after = useTourStore.getState().stops.filter((x) => isOpen(x.status)).sort((x, y) => x.sequence - y.sequence).map((x) => x.id);
    expect(after).toEqual([...ids].reverse());
    expect(useTourStore.getState().outbox.map((o) => o.kind)).toEqual(expect.arrayContaining(["stop_edit", "stop_merge", "sequence"]));
  });
});
