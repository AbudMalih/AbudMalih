import { createDispatchDataset } from "@turvio/shared";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../lib/i18n/client";
import { POLL_MS, RESYNC_MS, freshnessOf, useLiveFleet, type FleetLiveResponse, type LiveVehicle } from "../lib/live";
import { DispatchProvider, useDispatch, type SessionInfo } from "../lib/store";

/**
 * useLiveFleet: day + depot in the request, single-tour refetch + merge on position events,
 * full refetch without a tour, polling only while the shared stream is not open (error / 429).
 */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), usePathname: () => "/map", useRouter: () => ({ push: vi.fn() }) }));

const base = createDispatchDataset(new Date("2026-11-05T10:00:00Z"));
const session: SessionInfo = {
  userName: "Test",
  email: "t@example.test",
  role: "dispatcher",
  organizationId: "org_x",
  organizationName: "X",
  companyWide: true,
  workspaces: [{ id: "org_x", name: "X", role: "dispatcher" }],
  environment: null,
};

/** One shared stream per tab: the store's EventSource, driven by the test. */
class FakeEventSource {
  static all: FakeEventSource[] = [];
  readyState = 0;
  onerror: ((e: Event) => void) | null = null;
  private l = new Map<string, ((e: MessageEvent) => void)[]>();
  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.l.set(type, [...(this.l.get(type) ?? []), fn]);
  }
  emit(type: string, data: unknown = {}) {
    if (type === "ready") this.readyState = 1;
    for (const fn of this.l.get(type) ?? []) fn({ data: JSON.stringify(data) } as MessageEvent);
  }
  fail(closed: boolean) {
    this.readyState = closed ? 2 : 0;
    this.onerror?.(new Event("error"));
  }
  close() {
    this.readyState = 2;
  }
}

const SERVER_SKEW_MS = 3 * 3600_000; // the dispatcher's PC clock is 3 h behind the server
const veh = (driverId: string, tourId: string, depotId: string, positionAt: string): LiveVehicle => ({
  driverId,
  driverName: driverId,
  tourId,
  tourName: tourId,
  tourStatus: "in_progress",
  depotId,
  vehicle: null,
  position: { lat: 52.37, lng: 9.73, accuracyMeters: 8, speedMps: 0, headingDeg: null },
  recordedAt: positionAt,
  receivedAt: positionAt,
  positionAt,
  progress: { done: 1, remaining: 2 },
  nextStop: null,
});

let fleetCalls: URL[] = [];
let respond: (u: URL) => FleetLiveResponse | Response = () => ({ serverTime: "", date: "", staleAfterSeconds: 120, offlineAfterSeconds: 300, vehicles: [] });
const serverIso = (offsetMs = 0) => new Date(Date.now() + SERVER_SKEW_MS + offsetMs).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date("2026-11-05T07:00:00Z"));
  FakeEventSource.all = [];
  fleetCalls = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes("/fleet/live")) {
        const u = new URL(url, "http://x");
        fleetCalls.push(u);
        const r = respond(u);
        return r instanceof Response ? r : json(r);
      }
      if (url.includes("/dispatch?")) return json(base);
      if (url.includes("/location-checks")) return json({ checks: [], pending: false });
      if (url.endsWith("/v1/me/preferences")) return json({ language: null, orgDefaults: {} });
      return json({});
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

let hook: ReturnType<typeof useLiveFleet>;
let store: ReturnType<typeof useDispatch>;
function Probe() {
  hook = useLiveFleet();
  store = useDispatch();
  return null;
}
async function mount() {
  render(
    <I18nProvider initial="en">
      <DispatchProvider base={base} session={session}>
        <Probe />
      </DispatchProvider>
    </I18nProvider>,
  );
  await flush();
}
const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const es = () => FakeEventSource.all.at(-1)!;

describe("useLiveFleet", () => {
  it("asks for the selected day and depot and refetches when they change; filters by depot", async () => {
    respond = (u) => ({
      serverTime: serverIso(),
      date: u.searchParams.get("date")!,
      staleAfterSeconds: 120,
      offlineAfterSeconds: 300,
      // A misbehaving response with another depot's vehicle: never shown for a selected depot.
      vehicles: [veh("d1", "tour_han_01", "dep_hannover", serverIso()), veh("d2", "tour_bre_01", "dep_bremen", serverIso())],
      unavailable: [],
    });
    await mount();
    expect(fleetCalls).toHaveLength(1);
    expect(fleetCalls[0]!.searchParams.get("date")).toBe(base.date);
    expect(fleetCalls[0]!.searchParams.has("depotId")).toBe(false);
    expect(hook.vehicles).toHaveLength(2);

    await act(async () => store.setDepotId("dep_hannover"));
    await flush();
    expect(fleetCalls).toHaveLength(2);
    expect(fleetCalls[1]!.searchParams.get("depotId")).toBe("dep_hannover");
    expect(hook.vehicles.map((v) => v.driverId)).toEqual(["d1"]);

    await act(async () => store.setDate("2026-11-06"));
    await flush();
    const last = fleetCalls.at(-1)!;
    expect(last.searchParams.get("date")).toBe("2026-11-06");
    expect(last.searchParams.get("depotId")).toBe("dep_hannover");
  });

  it("a position event with a tour fetches only that tour (merged, throttled per tour); without a tour everything", async () => {
    let lat = 52.37;
    respond = (u) => {
      const tour = u.searchParams.get("tourId");
      const all = [veh("d1", "tour_han_01", "dep_hannover", serverIso()), veh("d2", "tour_han_02", "dep_hannover", serverIso())];
      const rows = tour ? all.filter((v) => v.tourId === tour) : all;
      return { serverTime: serverIso(), date: base.date, staleAfterSeconds: 120, offlineAfterSeconds: 300, vehicles: rows.map((v) => (v.driverId === "d1" ? { ...v, position: { ...v.position, lat } } : v)), unavailable: [] };
    };
    await mount();
    await act(async () => es().emit("ready"));
    expect(fleetCalls).toHaveLength(1);

    lat = 52.4;
    await act(async () => es().emit("position", { tour: "tour_han_01" }));
    await flush();
    expect(fleetCalls).toHaveLength(2);
    expect(fleetCalls[1]!.searchParams.get("tourId")).toBe("tour_han_01");
    expect(fleetCalls[1]!.searchParams.get("date")).toBe(base.date);
    expect(hook.vehicles.find((v) => v.driverId === "d1")!.position.lat).toBe(52.4);
    expect(hook.vehicles).toHaveLength(2); // the other tour stays

    // Burst for the same tour within 2 s: one more fetch at most, after the throttle.
    await act(async () => {
      es().emit("position", { tour: "tour_han_01" });
      es().emit("position", { tour: "tour_han_01" });
      es().emit("position", { tour: "tour_han_01" });
    });
    await flush(100);
    expect(fleetCalls).toHaveLength(2);
    await flush(2_000);
    expect(fleetCalls).toHaveLength(3);
    // Another tour is not held back by the first one's throttle.
    await act(async () => es().emit("position", { tour: "tour_han_02" }));
    await flush();
    expect(fleetCalls.at(-1)!.searchParams.get("tourId")).toBe("tour_han_02");

    // No tour (e.g. a driver withdrew): full refetch.
    const n = fleetCalls.length;
    await act(async () => es().emit("position", {}));
    await flush(2_000);
    expect(fleetCalls).toHaveLength(n + 1);
    expect(fleetCalls.at(-1)!.searchParams.has("tourId")).toBe(false);

    // Stream open: no 30 s polling (only the 5 min resync).
    const m = fleetCalls.length;
    await flush(POLL_MS * 3);
    expect(fleetCalls).toHaveLength(m);
    await flush(RESYNC_MS);
    expect(fleetCalls.length).toBeGreaterThan(m);
  });

  it("a tour status change (e.g. paused) refreshes that tour on the live map: the marker leaves, the driver is listed as paused", async () => {
    let paused = false;
    respond = (u) => {
      const tour = u.searchParams.get("tourId");
      const v = veh("d1", "tour_han_01", "dep_hannover", serverIso());
      const { position: _p, recordedAt: _r, receivedAt: _x, positionAt: _a, state: _s, ...rest } = v as typeof v & Record<string, unknown>;
      const rows = paused ? { vehicles: [], unavailable: [{ ...rest, tourStatus: "paused", reason: "paused" as const }] } : { vehicles: [v], unavailable: [] };
      return { serverTime: serverIso(), date: base.date, staleAfterSeconds: 120, offlineAfterSeconds: 300, ...(tour && tour !== "tour_han_01" ? { vehicles: [], unavailable: [] } : rows) };
    };
    await mount();
    await act(async () => es().emit("ready"));
    expect(hook.vehicles).toHaveLength(1);
    paused = true;
    await act(async () => es().emit("change", { table: "tours", tour: "tour_han_01", op: "update" }));
    await flush(2_000);
    expect(fleetCalls.some((u) => u.searchParams.get("tourId") === "tour_han_01")).toBe(true);
    expect(hook.vehicles).toHaveLength(0);
    expect(hook.unavailable.map((x) => x.reason)).toEqual(["paused"]);
  });

  it("stream refused (429) or broken: polls every 30 s instead of spinning; one EventSource per tab", async () => {
    respond = () => ({ serverTime: serverIso(), date: base.date, staleAfterSeconds: 120, offlineAfterSeconds: 300, vehicles: [], unavailable: [] });
    await mount();
    expect(FakeEventSource.all).toHaveLength(1);
    await act(async () => es().fail(true)); // 429 → the browser closes the stream for good
    const n = fleetCalls.length;
    await flush(POLL_MS);
    expect(fleetCalls).toHaveLength(n + 1);
    // Not reconnected in a loop: one new attempt after 1 min, then after a growing pause.
    expect(FakeEventSource.all).toHaveLength(1);
    await flush(POLL_MS);
    expect(fleetCalls).toHaveLength(n + 2);
    expect(FakeEventSource.all).toHaveLength(2);
    await act(async () => es().fail(true)); // still refused
    await flush(60_000);
    expect(FakeEventSource.all).toHaveLength(2);
    await flush(60_000);
    expect(FakeEventSource.all).toHaveLength(3);
    // Back online: full refetch, then polling stops.
    const before = fleetCalls.length;
    await act(async () => es().emit("ready"));
    await flush();
    expect(fleetCalls).toHaveLength(before + 1);
    const m = fleetCalls.length;
    await flush(POLL_MS * 2);
    expect(fleetCalls).toHaveLength(m);
  });

  it("freshness ages positionAt on the server clock with the response's thresholds (device clock irrelevant)", async () => {
    const at = serverIso(-10_000); // 10 s old on the server clock, 3 h "in the future" for this PC
    respond = () => ({ serverTime: serverIso(), date: base.date, staleAfterSeconds: 150, offlineAfterSeconds: 400, vehicles: [veh("d1", "tour_han_01", "dep_hannover", at)], unavailable: [] });
    await mount();
    await act(async () => es().emit("ready"));
    const state = () => freshnessOf(hook.vehicles[0]!.positionAt, hook.serverNow, hook.thresholds);
    expect(hook.thresholds).toEqual({ staleAfterSeconds: 150, offlineAfterSeconds: 400 });
    expect(state()).toEqual({ state: "live", ageSeconds: 10 });
    await flush(145_000); // age 155 s > 150
    expect(state().state).toBe("delayed");
    await flush(250_000); // age 405 s > 400
    expect(state().state).toBe("offline");
  });
});
