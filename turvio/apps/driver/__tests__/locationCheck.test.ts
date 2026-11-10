import { NewStopInput, type Stop } from "@turvio/shared";
import { currentCheck, locationNotices, locationPill, navigationPoint, type DriverLocationCheck } from "../src/lib/locationCheck";
import { navigationUrls } from "../src/lib/navigation";
import { drainOutbox, type OutboxItem } from "../src/lib/outbox";
import { applyOutbox } from "../src/lib/sync";

/** P0-3.5: what the driver sees about stop locations, where navigation goes, and stale-edit protection. */
const stop = (extra: Partial<Stop> = {}): Stop =>
  ({
    id: "s1",
    organizationId: "o",
    tourId: "t",
    type: "delivery",
    sequence: 0,
    status: "pending",
    address: { street: "Klusriede", houseNumber: "1", postalCode: "30419", city: "Hannover", countryCode: "DE" },
    location: { lat: 52.4274, lng: 9.7419 },
    serviceSeconds: 120,
    priority: false,
    parcels: [],
    addressVersion: 3,
    locationVersion: 5,
    ...extra,
  }) as Stop;
const check = (extra: Partial<DriverLocationCheck> = {}): DriverLocationCheck => ({
  stopId: "s1",
  status: "checked",
  severity: "warning",
  issues: [{ code: "motorway", severity: "warning", message: "The location is on a motorway (A 2)." }],
  acknowledged: false,
  forLat: 52.4274,
  forLng: 9.7419,
  ...extra,
});
const APPROACH = { lat: 52.4277, lng: 9.7423, roadName: "Klusriede" };

describe("navigation target", () => {
  it("goes to the accepted approach point when there is one, else to the pin", () => {
    expect(navigationPoint(stop())).toEqual({ lat: 52.4274, lng: 9.7419 });
    expect(navigationPoint(stop({ approach: APPROACH }))).toEqual({ lat: 52.4277, lng: 9.7423 });
    expect(navigationPoint(stop({ location: null, approach: APPROACH }))).toBeNull();
    // A certainly wrong coordinate is never handed to the navigation app (address text instead).
    expect(navigationPoint(stop({ location: { lat: 9.7462, lng: 52.3826 } }))).toBeNull();
    expect(navigationPoint(stop({ location: { lat: 0, lng: 0 } }))).toBeNull();
    expect(navigationUrls("google", { location: navigationPoint(stop({ location: { lat: 0, lng: 0 } })), addressText: "Klusriede 1, 30419 Hannover" }, "android").native).toBe(
      `google.navigation:q=${encodeURIComponent("Klusriede 1, 30419 Hannover")}&mode=d`,
    );
    const urls = navigationUrls("google", { location: navigationPoint(stop({ approach: APPROACH })), addressText: "Klusriede 1" }, "android");
    expect(urls.native).toBe("google.navigation:q=52.4277,9.7423&mode=d");
  });
});

describe("location notices for the driver", () => {
  it("unconfirmed warning: pill + notice; confirmed by dispatch: no pill, an info notice", () => {
    expect(locationPill(stop(), check())).toEqual({ tone: "warning", key: "location.pillWarning" });
    expect(locationNotices(stop(), check())[0]).toMatchObject({ key: "location.warning", issues: [{ code: "motorway" }] });
    expect(locationPill(stop(), check({ acknowledged: true }))).toBeNull();
    expect(locationNotices(stop(), check({ acknowledged: true }))[0]!.key).toBe("location.confirmed");
  });
  it("errors are shown as such; information never bothers the driver", () => {
    const err = check({ severity: "error", issues: [{ code: "out_of_coverage", severity: "error", message: "No road within 1.0 km." }] });
    expect(locationPill(stop(), err)).toEqual({ tone: "danger", key: "location.pillError" });
    const info = check({ severity: "info", issues: [{ code: "restricted_access", severity: "info", message: "Residents only." }] });
    expect(locationPill(stop(), info)).toBeNull();
    expect(locationNotices(stop(), info)).toEqual([]);
  });
  it("a pending check or one made for another coordinate is never shown", () => {
    expect(locationPill(stop(), check({ status: "pending" }))).toBeNull();
    expect(locationNotices(stop(), check({ status: "pending" }))).toEqual([]);
    const moved = stop({ location: { lat: 52.43, lng: 9.75 } });
    expect(currentCheck(moved, check())).toBeUndefined();
    expect(locationPill(moved, check())).toBeNull();
  });
  it("names the approach point navigation goes to", () => {
    expect(locationNotices(stop({ approach: APPROACH }), undefined)).toEqual([{ tone: "info", key: "location.approach", issues: [], road: "Klusriede" }]);
  });
});

describe("local edits follow the database rules", () => {
  const snap = (s: Stop) => ({ driverId: "d", stops: [s], tours: [], depots: [], drivers: [], settingsByOrg: {} }) as never;
  it("a moved pin gets the next location version and loses its approach point", () => {
    const item: OutboxItem = { id: "1", orgId: "o", at: "", kind: "stop_update", stopId: "s1", location: { lat: 52.43, lng: 9.75 }, locationSource: "manual_pin", expectedLocationVersion: 5 };
    const s = applyOutbox(snap(stop({ approach: APPROACH })), [item]).stops[0]!;
    expect(s).toMatchObject({ location: { lat: 52.43, lng: 9.75 }, locationVersion: 6, addressVersion: 3 });
    expect(s.approach).toBeUndefined();
    // Locking only: nothing about the location changes.
    const lock = applyOutbox(snap(stop({ approach: APPROACH })), [{ id: "2", orgId: "o", at: "", kind: "stop_update", stopId: "s1", locked: true }]).stops[0]!;
    expect(lock).toMatchObject({ locked: true, locationVersion: 5, approach: APPROACH });
  });
  it("a changed address: next address version, pin removed (next location version), approach gone", () => {
    const item: OutboxItem = { id: "1", orgId: "o", at: "", kind: "stop_edit", stopId: "s1", address: { street: "Klusriede", houseNumber: "3", postalCode: "30419", city: "Hannover" }, expectedAddressVersion: 3 };
    const s = applyOutbox(snap(stop({ approach: APPROACH })), [item]).stops[0]!;
    expect(s).toMatchObject({ location: null, addressVersion: 4, locationVersion: 6 });
    expect(s.approach).toBeUndefined();
  });
});

describe("outbox sends the version the change was made against", () => {
  it("driver-update and edit carry expectedLocationVersion / expectedAddressVersion and the reason", async () => {
    const sent: { path: string; body: Record<string, unknown> }[] = [];
    const queue: OutboxItem[] = [
      { id: "1", orgId: "o", at: "", kind: "stop_update", stopId: "s1", location: { lat: 52.43, lng: 9.75 }, locationSource: "manual_pin", expectedLocationVersion: 5, reason: "Gate on side street" },
      { id: "2", orgId: "o", at: "", kind: "stop_edit", stopId: "s1", address: { street: "Klusriede", houseNumber: "3", postalCode: "30419", city: "Hannover" }, expectedAddressVersion: 3 },
    ];
    await drainOutbox(
      () => queue[0],
      (id) => queue.splice(queue.findIndex((q) => q.id === id), 1),
      () => undefined,
      { client: { request: async (_m: string, path: string, body?: unknown) => void sent.push({ path, body: body as Record<string, unknown> }) as never }, readFileBase64: async () => "", deleteFile: async () => undefined },
    );
    expect(sent[0]!.body).toMatchObject({ location: { lat: 52.43, lng: 9.75 }, expectedLocationVersion: 5, reason: "Gate on side street" });
    expect(sent[1]!.body).toMatchObject({ address: { houseNumber: "3" }, expectedAddressVersion: 3 });
  });
});

describe("outbox sends device positions to 7 decimals (exact on every server)", () => {
  it("create_stops, stop_update and stop_edit round raw GPS / map positions; other fields untouched", async () => {
    const raw = { lat: 52.38123456789012, lng: 9.741234567890123 };
    const want = { lat: 52.3812346, lng: 9.7412346 };
    const sent: { path: string; body: Record<string, unknown> }[] = [];
    const queue: OutboxItem[] = [
      {
        id: "1",
        orgId: "o",
        at: "",
        kind: "create_stops",
        tourId: "t1",
        stops: [
          { ...NewStopInput.parse({ address: { street: "A", postalCode: "30159", city: "Hannover" }, location: raw }), id: "a" },
          { ...NewStopInput.parse({ address: { street: "B", postalCode: "30159", city: "Hannover" } }), id: "b" },
        ],
      },
      { id: "2", orgId: "o", at: "", kind: "stop_update", stopId: "s1", location: raw, locationSource: "manual_pin", expectedLocationVersion: 2 },
      { id: "3", orgId: "o", at: "", kind: "stop_edit", stopId: "s1", address: { street: "C", postalCode: "30159", city: "Hannover" }, location: raw, locationSource: "manual_pin" },
      { id: "4", orgId: "o", at: "", kind: "stop_update", stopId: "s2", locked: true },
    ];
    await drainOutbox(
      () => queue[0],
      (id) => queue.splice(queue.findIndex((q) => q.id === id), 1),
      () => undefined,
      { client: { request: async (_m: string, path: string, body?: unknown) => void sent.push({ path, body: body as Record<string, unknown> }) as never }, readFileBase64: async () => "", deleteFile: async () => undefined },
    );
    const stops = sent[0]!.body.stops as { location?: unknown; address: { street: string } }[];
    expect(stops[0]!.location).toEqual(want);
    expect(stops[1]!.location).toBeNull();
    expect(sent[1]!.body).toMatchObject({ location: want, expectedLocationVersion: 2 });
    expect(sent[2]!.body).toMatchObject({ location: want, address: { street: "C" } });
    expect(sent[3]!.body).toMatchObject({ locked: true, location: undefined });
  });
});
