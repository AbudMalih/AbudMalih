import { Linking, Platform } from "react-native";
import type { GeoPoint } from "@turvio/shared";

/**
 * Hand off turn-by-turn navigation to the device's navigation app.
 * Uses coordinates when available (more precise than the address string).
 */
export function navigationUrl(target: { location: GeoPoint | null; addressText: string }, os = Platform.OS): string {
  const dest = target.location
    ? `${target.location.lat},${target.location.lng}`
    : encodeURIComponent(target.addressText);
  if (os === "ios") {
    return `http://maps.apple.com/?daddr=${dest}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export async function openNavigation(target: { location: GeoPoint | null; addressText: string }) {
  await Linking.openURL(navigationUrl(target));
}
