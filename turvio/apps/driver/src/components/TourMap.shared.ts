import { isOpen, isSuccess, type Depot, type GeoPoint, type Stop } from "@turvio/shared";
import type { ViewStyle } from "react-native";
import type { Palette } from "../theme";

export interface TourMapProps {
  depot: Depot | undefined;
  stops: Stop[];
  currentStopId?: string | null;
  /** Show the device's own position (only after the driver allowed location). */
  showUserLocation?: boolean;
  /** Extra pin, e.g. the position being chosen for a stop. */
  pendingPin?: GeoPoint | null;
  onMapPress?: (point: GeoPoint) => void;
  onStopPress?: (stop: Stop) => void;
  style?: ViewStyle;
}

export function markerTone(stop: Stop, current: boolean, c: Palette) {
  if (!isOpen(stop.status)) return isSuccess(stop.status) ? c.textSubtle : c.danger;
  if (current) return c.primary;
  if (stop.type === "pickup") return c.warning;
  return "#1E3A8A";
}

