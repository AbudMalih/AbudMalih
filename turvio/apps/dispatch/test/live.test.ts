import type * as Leaflet from "leaflet";
import { describe, expect, it, vi } from "vitest";
import { ageLabel, freshnessOf, mergeTour, type LiveVehicle, type UnavailableDriver } from "../lib/live";
import { LiveMarkerLayer, diffMarkers, distanceMeters, shouldAnimate, vehicleIconHtml, vehicleLook } from "../lib/live-layer";

const TH = { staleAfterSeconds: 120, offlineAfterSeconds: 300 };

describe("live position freshness (server thresholds, server clock)", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

  it("uses the thresholds from the response, not fixed 90 s / 5 min", () => {
    expect(freshnessOf(at(5), now, TH)).toEqual({ state: "live", ageSeconds: 5 });
    expect(freshnessOf(at(120), now, TH).state).toBe("live");
    expect(freshnessOf(at(121), now, TH).state).toBe("delayed");
    expect(freshnessOf(at(300), now, TH).state).toBe("delayed");
    expect(freshnessOf(at(301), now, TH).state).toBe("offline");
    // A company with a 60 s interval: stale after 180 s, offline after 600 s.
    const slow = { staleAfterSeconds: 180, offlineAfterSeconds: 600 };
    expect(freshnessOf(at(170), now, slow).state).toBe("live");
    expect(freshnessOf(at(500), now, slow).state).toBe("delayed");
    expect(freshnessOf(at(601), now, slow).state).toBe("offline");
  });

  it("never reports negative ages and labels ages plainly", () => {
    expect(freshnessOf(new Date(now + 4000).toISOString(), now, TH).ageSeconds).toBe(0);
    expect(ageLabel(12)).toBe("12 s ago");
    expect(ageLabel(185)).toBe("3 min ago");
    expect(ageLabel(3 * 3600 + 120)).toBe("3 h 2 min ago");
  });
});

const veh = (over: Partial<LiveVehicle> & { driverId: string }): LiveVehicle => ({
  driverName: over.driverId,
  tourId: `t_${over.driverId}`,
  tourName: "T",
  tourStatus: "in_progress",
  depotId: "dep_a",
  vehicle: null,
  position: { lat: 52.37, lng: 9.73, accuracyMeters: 8, speedMps: 0, headingDeg: null },
  recordedAt: "2026-11-07T09:59:50.000Z",
  receivedAt: "2026-11-07T09:59:51.000Z",
  positionAt: "2026-11-07T09:59:51.000Z",
  progress: { done: 1, remaining: 2 },
  nextStop: null,
  ...over,
});
const unav = (over: Partial<UnavailableDriver> & { driverId: string }): UnavailableDriver => ({
  driverName: over.driverId,
  tourId: `t_${over.driverId}`,
  tourName: "T",
  tourStatus: "paused",
  depotId: "dep_a",
  vehicle: null,
  progress: { done: 0, remaining: 3 },
  nextStop: null,
  reason: "paused",
  ...over,
});

describe("single-tour merge", () => {
  const cur = { vehicles: [veh({ driverId: "a" }), veh({ driverId: "b" })], unavailable: [unav({ driverId: "c" })] };

  it("replaces the tour's row in place and keeps the others", () => {
    const moved = veh({ driverId: "a", position: { lat: 52.4, lng: 9.8, accuracyMeters: 5, speedMps: 3, headingDeg: 90 } });
    const r = mergeTour(cur, "t_a", { vehicles: [moved], unavailable: [] });
    expect(r.vehicles.map((v) => v.driverId)).toEqual(["a", "b"]);
    expect(r.vehicles[0]!.position.lat).toBe(52.4);
    expect(r.unavailable).toHaveLength(1);
  });

  it("moves a driver between vehicles and unavailable (paused) and removes vanished tours", () => {
    const paused = mergeTour(cur, "t_b", { vehicles: [], unavailable: [unav({ driverId: "b", tourId: "t_b" })] });
    expect(paused.vehicles.map((v) => v.driverId)).toEqual(["a"]);
    expect(paused.unavailable.map((v) => v.driverId)).toEqual(["b", "c"]);
    const resumed = mergeTour(paused, "t_c", { vehicles: [veh({ driverId: "c" })], unavailable: [] });
    expect(resumed.unavailable.map((v) => v.driverId)).toEqual(["b"]);
    expect(resumed.vehicles.map((v) => v.driverId)).toEqual(["a", "c"]);
    // Withdrawn / finished: the server returns nothing for the tour.
    const gone = mergeTour(resumed, "t_a", { vehicles: [], unavailable: [] });
    expect(gone.vehicles.map((v) => v.driverId)).toEqual(["c"]);
  });
});

describe("marker diff and animation rules", () => {
  it("diffs by driver id", () => {
    expect(diffMarkers(["a", "b"], [{ driverId: "b" }, { driverId: "c" }])).toEqual({ add: ["c"], update: ["b"], remove: ["a"] });
  });

  it("animates small moves, not big jumps, not with reduced motion", () => {
    const a = { lat: 52.37, lng: 9.73 };
    const b = { lat: 52.375, lng: 9.735 }; // ~650 m
    const far = { lat: 52.4, lng: 9.73 }; // ~3.3 km
    expect(distanceMeters(a, b)).toBeGreaterThan(500);
    expect(distanceMeters(a, b)).toBeLessThan(800);
    expect(shouldAnimate(a, b, false)).toBe(true);
    expect(shouldAnimate(a, far, false)).toBe(false);
    expect(shouldAnimate(a, b, true)).toBe(false);
    expect(shouldAnimate(a, a, false)).toBe(false);
  });

  it("marker colours come from CSS classes (theme tokens), not hard-coded hex", () => {
    for (const s of ["live", "delayed", "offline"] as const) {
      const html = vehicleIconHtml(vehicleLook(veh({ driverId: "a" }), s, s === "live"));
      expect(html).toContain(`data-state="${s}"`);
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });
});

/** Minimal Leaflet stand-in: records what the layer does to its markers. */
function fakeLeaflet() {
  const created: FakeMarker[] = [];
  class FakeMarker {
    latlng: { lat: number; lng: number };
    icon: unknown;
    setIcon = vi.fn((i: unknown) => (this.icon = i, this));
    setZIndexOffset = vi.fn(() => this);
    setTooltipContent = vi.fn(() => this);
    removed = false;
    constructor(p: [number, number], o: { icon: unknown }) {
      this.latlng = { lat: p[0], lng: p[1] };
      this.icon = o.icon;
      created.push(this);
    }
    setLatLng = vi.fn((p: [number, number]) => ((this.latlng = { lat: p[0], lng: p[1] }), this));
    getLatLng = () => this.latlng;
    getElement = () => undefined;
    on = () => this;
    bindTooltip = () => this;
    addTo = () => this;
  }
  const L = {
    marker: (p: [number, number], o: { icon: unknown }) => new FakeMarker(p, o),
    circle: () => ({ addTo() { return this; }, setRadius() {}, setLatLng() {} }),
    divIcon: (o: { html: string }) => ({ html: o.html }),
    DomEvent: { stopPropagation() {} },
  } as unknown as typeof Leaflet;
  const group = { removeLayer: vi.fn((m: FakeMarker) => (m.removed = true)) } as unknown as Leaflet.LayerGroup;
  return { L, group, created };
}

describe("RouteMap live layer: markers are reused, not rebuilt", () => {
  const opts = (serverNow: number) => ({
    serverNow,
    thresholds: TH,
    selectedDriverId: null,
    tooltip: (v: LiveVehicle, s: string) => `${v.driverName} ${s}`,
    title: (v: LiveVehicle) => v.driverName,
    onSelect: () => {},
  });
  const now = Date.parse("2026-11-07T10:00:00Z");

  it("keeps the same marker instance across position updates and clock ticks; removes vanished ones", () => {
    const { L, group, created } = fakeLeaflet();
    const frames: ((t: number) => void)[] = [];
    let clock = 0;
    const layer = new LiveMarkerLayer(L, group, { reducedMotion: () => false, raf: (cb) => frames.push(cb), caf: () => {}, now: () => clock });
    layer.sync([veh({ driverId: "a" }), veh({ driverId: "b" })], opts(now));
    const a = layer.markerOf("a");
    expect(created).toHaveLength(2);

    // Small move: same marker, animated over ~800 ms via requestAnimationFrame.
    layer.sync([veh({ driverId: "a", position: { lat: 52.372, lng: 9.732, accuracyMeters: 8, speedMps: 0, headingDeg: null } }), veh({ driverId: "b" })], opts(now + 5000));
    expect(layer.markerOf("a")).toBe(a);
    expect(created).toHaveLength(2);
    expect(frames.length).toBe(1);
    clock = 400;
    frames.shift()!(clock);
    const mid = a!.getLatLng();
    expect(mid.lat).toBeGreaterThan(52.37);
    expect(mid.lat).toBeLessThan(52.372);
    clock = 800;
    frames.shift()!(clock);
    expect(a!.getLatLng()).toEqual({ lat: 52.372, lng: 9.732 });
    expect(frames.length).toBe(0);

    // Clock tick only: no new marker, icon untouched while the state is unchanged.
    const icons = (a as unknown as { setIcon: ReturnType<typeof vi.fn> }).setIcon.mock.calls.length;
    layer.sync([veh({ driverId: "a", position: { lat: 52.372, lng: 9.732, accuracyMeters: 8, speedMps: 0, headingDeg: null } }), veh({ driverId: "b" })], opts(now + 10_000));
    expect((a as unknown as { setIcon: ReturnType<typeof vi.fn> }).setIcon.mock.calls.length).toBe(icons);
    // The state changes (live → offline as the server clock advances): restyled in place.
    layer.sync([veh({ driverId: "a", position: { lat: 52.372, lng: 9.732, accuracyMeters: 8, speedMps: 0, headingDeg: null } }), veh({ driverId: "b" })], opts(now + 400_000));
    expect(layer.markerOf("a")).toBe(a);
    expect(String((a as unknown as { icon: { html: string } }).icon.html)).toContain('data-state="offline"');

    // b disappears → its marker is removed; a stays.
    const b = layer.markerOf("b") as unknown as { removed: boolean };
    layer.sync([veh({ driverId: "a" })], opts(now + 400_000));
    expect(b.removed).toBe(true);
    expect(layer.size).toBe(1);
    expect(layer.markerOf("a")).toBe(a);
    expect(created).toHaveLength(2);
  });

  it("reduced motion or a jump over 2 km: the marker is set directly, no animation", () => {
    const { L, group } = fakeLeaflet();
    const raf = vi.fn(() => 1);
    const layer = new LiveMarkerLayer(L, group, { reducedMotion: () => true, raf, caf: () => {}, now: () => 0 });
    layer.sync([veh({ driverId: "a" })], opts(now));
    layer.sync([veh({ driverId: "a", position: { lat: 52.371, lng: 9.731, accuracyMeters: 8, speedMps: 0, headingDeg: null } })], opts(now));
    expect(raf).not.toHaveBeenCalled();
    expect(layer.markerOf("a")!.getLatLng()).toEqual({ lat: 52.371, lng: 9.731 });

    const layer2 = new LiveMarkerLayer(L, group, { reducedMotion: () => false, raf, caf: () => {}, now: () => 0 });
    layer2.sync([veh({ driverId: "x" })], opts(now));
    layer2.sync([veh({ driverId: "x", position: { lat: 52.5, lng: 9.73, accuracyMeters: 8, speedMps: 0, headingDeg: null } })], opts(now));
    expect(raf).not.toHaveBeenCalled();
    expect(layer2.markerOf("x")!.getLatLng()).toEqual({ lat: 52.5, lng: 9.73 });
  });
});
