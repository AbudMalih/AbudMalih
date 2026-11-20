import type * as Leaflet from "leaflet";
import { freshnessOf, type Freshness, type FreshnessThresholds, type LiveVehicle } from "./live";

/**
 * Live vehicle markers on the Dispatch map. One Leaflet marker per driver is kept and updated in
 * place (position, icon only when its look changes, tooltip text) – never cleared and rebuilt, so
 * nothing flickers and the 5 s clock tick only restyles. Position changes glide over ~800 ms
 * (requestAnimationFrame); no animation with reduced motion or for jumps over 2 km.
 */

export const ANIMATION_MS = 800;
export const MAX_ANIMATED_JUMP_METERS = 2_000;

type LatLng = { lat: number; lng: number };

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function shouldAnimate(from: LatLng, to: LatLng, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  const d = distanceMeters(from, to);
  return d > 0 && d <= MAX_ANIMATED_JUMP_METERS;
}

/** Which markers to add, update or remove for the next list of vehicles (keyed by driver). */
export function diffMarkers(existing: Iterable<string>, vehicles: readonly Pick<LiveVehicle, "driverId">[]) {
  const have = new Set(existing);
  const next = new Set(vehicles.map((v) => v.driverId));
  return {
    add: [...next].filter((id) => !have.has(id)),
    update: [...next].filter((id) => have.has(id)),
    remove: [...have].filter((id) => !next.has(id)),
  };
}

/** Everything the marker's look depends on (icon is replaced only when this changes). */
export interface VehicleLook {
  state: Freshness;
  selected: boolean;
  heading: number | null;
  size: number;
}

export function vehicleLook(v: LiveVehicle, state: Freshness, selected: boolean): VehicleLook {
  const moving = state === "live" && (v.position.speedMps ?? 0) > 1 && v.position.headingDeg != null;
  return { state, selected, heading: moving ? Math.round(v.position.headingDeg!) : null, size: selected ? 40 : 34 };
}

const lookKey = (l: VehicleLook) => `${l.state}|${l.selected ? 1 : 0}|${l.heading ?? "-"}|${l.size}`;

/** Marker HTML: colours come from CSS (globals.css `.turvio-veh`), following the light/dark theme. */
export function vehicleIconHtml(l: VehicleLook): string {
  const arrow = l.heading != null ? `<div class="turvio-veh__arrow" style="transform:rotate(${l.heading}deg)"><div></div></div>` : "";
  return `<div class="turvio-veh" data-state="${l.state}"${l.selected ? " data-selected" : ""} style="width:${l.size}px;height:${l.size}px">${arrow}<div class="turvio-veh__body"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div></div>`;
}

interface Entry {
  marker: Leaflet.Marker;
  circle: Leaflet.Circle | null;
  key: string;
  vehicle: LiveVehicle;
  /** Where the marker is heading (the latest server position). */
  target: LatLng;
  anim: number | null;
}

export interface LiveLayerOptions {
  serverNow: number;
  thresholds: FreshnessThresholds;
  selectedDriverId: string | null;
  /** Tooltip HTML and title for a vehicle in its current state. */
  tooltip: (v: LiveVehicle, state: Freshness, ageSeconds: number) => string;
  title: (v: LiveVehicle, state: Freshness) => string;
  onSelect: (v: LiveVehicle) => void;
}

export interface LiveLayerEnv {
  reducedMotion: () => boolean;
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
  now: () => number;
}

const browserEnv = (): LiveLayerEnv => ({
  reducedMotion: () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
});

export class LiveMarkerLayer {
  private entries = new Map<string, Entry>();
  private readonly env: LiveLayerEnv;

  constructor(
    private readonly L: typeof Leaflet,
    private readonly group: Leaflet.LayerGroup,
    env?: Partial<LiveLayerEnv>,
  ) {
    this.env = { ...browserEnv(), ...env };
  }

  /** Current marker per driver (tests and focus). */
  markerOf(driverId: string): Leaflet.Marker | undefined {
    return this.entries.get(driverId)?.marker;
  }

  get size() {
    return this.entries.size;
  }

  sync(vehicles: readonly LiveVehicle[], o: LiveLayerOptions) {
    const { add, update, remove } = diffMarkers(this.entries.keys(), vehicles);
    for (const id of remove) this.drop(id);
    const byId = new Map(vehicles.map((v) => [v.driverId, v]));
    for (const id of add) this.create(byId.get(id)!, o);
    for (const id of update) this.update(this.entries.get(id)!, byId.get(id)!, o);
  }

  clear() {
    for (const id of [...this.entries.keys()]) this.drop(id);
  }

  private stateOf(v: LiveVehicle, o: LiveLayerOptions) {
    return freshnessOf(v.positionAt ?? v.recordedAt, o.serverNow, o.thresholds);
  }

  private icon(look: VehicleLook) {
    return this.L.divIcon({ className: "turvio-marker", html: vehicleIconHtml(look), iconSize: [look.size, look.size], iconAnchor: [look.size / 2, look.size / 2] });
  }

  private create(v: LiveVehicle, o: LiveLayerOptions) {
    const { state, ageSeconds } = this.stateOf(v, o);
    const look = vehicleLook(v, state, v.driverId === o.selectedDriverId);
    const pos = { lat: v.position.lat, lng: v.position.lng };
    const marker = this.L.marker([pos.lat, pos.lng], { icon: this.icon(look), zIndexOffset: 2000 + (look.selected ? 500 : 0), title: o.title(v, state) });
    const entry: Entry = { marker, circle: null, key: lookKey(look), vehicle: v, target: pos, anim: null };
    marker
      .on("click", (e: Leaflet.LeafletEvent) => {
        this.L.DomEvent.stopPropagation(e as Leaflet.LeafletMouseEvent);
        o.onSelect(entry.vehicle);
      })
      .bindTooltip(o.tooltip(v, state, ageSeconds), { direction: "top", offset: [0, -look.size / 2] })
      .addTo(this.group);
    this.entries.set(v.driverId, entry);
    this.syncCircle(entry, look, state);
  }

  private update(e: Entry, v: LiveVehicle, o: LiveLayerOptions) {
    e.vehicle = v;
    const { state, ageSeconds } = this.stateOf(v, o);
    const look = vehicleLook(v, state, v.driverId === o.selectedDriverId);
    const key = lookKey(look);
    if (key !== e.key) {
      e.key = key;
      e.marker.setIcon(this.icon(look));
      e.marker.setZIndexOffset(2000 + (look.selected ? 500 : 0));
    }
    e.marker.setTooltipContent(o.tooltip(v, state, ageSeconds));
    const el = e.marker.getElement?.();
    if (el) el.title = o.title(v, state);
    const to = { lat: v.position.lat, lng: v.position.lng };
    if (to.lat !== e.target.lat || to.lng !== e.target.lng) this.moveTo(e, to);
    this.syncCircle(e, look, state);
  }

  private moveTo(e: Entry, to: LatLng) {
    if (e.anim !== null) {
      this.env.caf(e.anim);
      e.anim = null;
    }
    const cur = e.marker.getLatLng();
    const from = { lat: cur.lat, lng: cur.lng };
    e.target = to;
    if (!shouldAnimate(from, to, this.env.reducedMotion())) {
      e.marker.setLatLng([to.lat, to.lng]);
      e.circle?.setLatLng([to.lat, to.lng]);
      return;
    }
    const start = this.env.now();
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / ANIMATION_MS));
      // Ease-out: quick start, gentle arrival.
      const f = 1 - (1 - k) ** 3;
      const p: [number, number] = [from.lat + (to.lat - from.lat) * f, from.lng + (to.lng - from.lng) * f];
      e.marker.setLatLng(p);
      e.circle?.setLatLng(p);
      e.anim = k < 1 ? this.env.raf(step) : null;
    };
    e.anim = this.env.raf(step);
  }

  /** Accuracy circle: only for the selected vehicle with a usable fix. */
  private syncCircle(e: Entry, look: VehicleLook, state: Freshness) {
    const acc = e.vehicle.position.accuracyMeters;
    const want = look.selected && !!acc && state !== "offline";
    if (!want) {
      if (e.circle) {
        this.group.removeLayer(e.circle);
        e.circle = null;
      }
      return;
    }
    const cls = `turvio-veh-accuracy turvio-veh-accuracy--${state}`;
    if (!e.circle) {
      const p = e.marker.getLatLng();
      e.circle = this.L.circle([p.lat, p.lng], { radius: acc!, weight: 1, fillOpacity: 0.08, interactive: false, className: cls }).addTo(this.group);
    } else {
      e.circle.setRadius(acc!);
      const path = (e.circle as unknown as { _path?: SVGElement })._path;
      path?.setAttribute("class", cls);
    }
  }

  private drop(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.anim !== null) this.env.caf(e.anim);
    this.group.removeLayer(e.marker);
    if (e.circle) this.group.removeLayer(e.circle);
    this.entries.delete(id);
  }
}
