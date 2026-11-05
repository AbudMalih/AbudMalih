import * as Location from "expo-location";
import type { GeoPoint } from "@turvio/shared";

/**
 * Device location is used only on request and only for the driver's own work:
 * showing "you are here" on the map, optimizing from the current position and –
 * when the company enabled it – attaching the position to proof of delivery.
 * Nothing is tracked in the background.
 */
export type LocationResult = { ok: true; point: GeoPoint; accuracy: number | null } | { ok: false; reason: "denied" | "unavailable" };

export async function locationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  try {
    return (await Location.getForegroundPermissionsAsync()).status as "granted" | "denied" | "undetermined";
  } catch {
    return "denied";
  }
}

export async function currentPosition(ask = true): Promise<LocationResult> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted" && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { ok: false, reason: "denied" };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy ?? null };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
