import { hasUsableLocation, isOpen, isSuccess, tourEndPoint, tourStartPoint, type Depot, type GeoPoint, type Stop, type Tour } from "@turvio/shared";
import type { ViewStyle } from "react-native";
import type { Palette } from "../theme";

export interface TourMapProps {
  depot: Depot | undefined;
  /** The tour's own start/end (custom start address, end address or "at the last stop"); default: the depot. */
  tour?: Pick<Tour, "startLocation" | "endLocation" | "endMode">;
  stops: Stop[];
  currentStopId?: string | null;
  /** Show the device's own position (only after the driver allowed location). */
  showUserLocation?: boolean;
  /** Road geometry ([lat, lng]) from OSRM; without it the order is drawn as straight dashed lines. */
  roadGeometry?: [number, number][] | null;
  /** Extra pin, e.g. the position being chosen for a stop. */
  pendingPin?: GeoPoint | null;
  onMapPress?: (point: GeoPoint) => void;
  onStopPress?: (stop: Stop) => void;
  /** Change `n` to animate the camera to this point at street level (My location). */
  focus?: { lat: number; lng: number; n: number } | null;
  /** The driver panned or zoomed the map by hand. */
  onUserGesture?: () => void;
  style?: ViewStyle;
}

export function markerTone(stop: Stop, current: boolean, c: Palette) {
  if (!isOpen(stop.status)) return isSuccess(stop.status) ? c.textSubtle : c.danger;
  if (current) return c.primary;
  if (stop.type === "pickup") return c.warning;
  return c.cyan;
}


const same = (a: GeoPoint, b: GeoPoint) => a.lat === b.lat && a.lng === b.lng;

/**
 * Where the tour starts and ends on the map: its own start (else the depot) and – for an own end
 * address only – that end. `undefined` end = the tour ends at its last stop or back at its start.
 */
export function tourMapEnds(depot: Depot | undefined, tour?: TourMapProps["tour"]): { start?: GeoPoint; end?: GeoPoint } {
  if (!depot) return { start: tour?.startLocation, end: tour?.endMode === "address" ? tour.endLocation : undefined };
  const start = tour ? tourStartPoint(tour, depot.location) : depot.location;
  const end = tour ? tourEndPoint(tour, depot.location) : undefined;
  return { start, end: end && !same(end, depot.location) && !same(end, start) ? end : undefined };
}

/** Points the map must show at first: start, own end address, stops and a pin being placed. */
export function initialMapPoints(props: Pick<TourMapProps, "depot" | "tour" | "stops" | "pendingPin">): GeoPoint[] {
  const { start, end } = tourMapEnds(props.depot, props.tour);
  return [...(start ? [start] : []), ...(end ? [end] : []), ...props.stops.filter((s) => hasUsableLocation(s)).map((s) => s.location!), ...(props.pendingPin ? [props.pendingPin] : [])];
}

/** Straight-line fallback (no road geometry): from the last completed stop – or the tour's start – through the open stops. */
export function fallbackPath(props: Pick<TourMapProps, "depot" | "tour" | "stops">): GeoPoint[] {
  // Certainly wrong coordinates (0,0, swapped) are not drawn and do not stretch the map.
  const located = props.stops.filter((s): s is Stop & { location: GeoPoint } => s.location !== null && hasUsableLocation(s));
  const { start, end } = tourMapEnds(props.depot, props.tour);
  const from = located.filter((s) => !isOpen(s.status)).at(-1)?.location ?? start;
  const open = located.filter((s) => isOpen(s.status)).map((s) => s.location);
  return [...(from ? [from] : []), ...open, ...(end && open.length ? [end] : [])];
}
