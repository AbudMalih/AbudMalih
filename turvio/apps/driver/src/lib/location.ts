import * as Location from "expo-location";
import type { GeoPoint } from "@turvio/shared";

/**
 * Foreground device location for the driver's own work: "you are here" on the map, optimizing from
 * the current position and – when the company enabled it – the position on proof of delivery.
 * These helpers send nothing. Live tracking (positions sent to dispatch while a tour is in progress,
 * only when the company enabled it and the driver acknowledged the notice) is separate: lib/tracking.ts.
 */
export type LocationResult = { ok: true; point: GeoPoint; accuracy: number | null } | { ok: false; reason: "denied" | "unavailable" };

export async function locationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  try {
    return (await Location.getForegroundPermissionsAsync()).status as "granted" | "denied" | "undetermined";
  } catch {
    return "denied";
  }
}

export async function currentPosition(ask = true, opts: { precise?: boolean; timeoutMs?: number } = {}): Promise<LocationResult> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted" && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { ok: false, reason: "denied" };
    const fix = Location.getCurrentPositionAsync({ accuracy: opts.precise ? Location.Accuracy.High : Location.Accuracy.Balanced });
    // A first fix indoors or after a cold start can take long: never wait silently forever.
    const pos = opts.timeoutMs ? await Promise.race([fix, new Promise<null>((r) => setTimeout(() => r(null), opts.timeoutMs))]) : await fix;
    if (!pos) return { ok: false, reason: "unavailable" };
    return { ok: true, point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy ?? null };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Asks for foreground permission if it can still be asked. "blocked" = denied for good (Settings). */
export async function requestLocationPermission(): Promise<"granted" | "denied" | "blocked"> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted" && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    return perm.status === "granted" ? "granted" : perm.canAskAgain ? "denied" : "blocked";
  } catch {
    return "denied";
  }
}

/** The device's most recent fix (instant, no GPS wait), if recent and accurate enough. */
export async function lastKnownPosition(maxAgeMs = 5 * 60_000): Promise<LocationResult | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs, requiredAccuracy: 250 });
    return pos ? { ok: true, point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy ?? null } : null;
  } catch {
    return null;
  }
}
