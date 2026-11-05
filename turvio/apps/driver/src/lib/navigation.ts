import type { GeoPoint } from "@turvio/shared";
import { Linking, Platform } from "react-native";

/**
 * Turn-by-turn navigation is handed off to the driver's navigation app.
 * Each app has a native URL scheme and an https fallback that always opens
 * (in the app if installed, otherwise the browser) – so a missing app never
 * leaves the driver stuck.
 */
export type NavApp = "google" | "apple" | "waze";

export interface NavTarget {
  location: GeoPoint | null;
  addressText: string;
}

export function availableNavApps(os = Platform.OS): NavApp[] {
  return os === "ios" ? ["apple", "google", "waze"] : ["google", "waze"];
}

export function navigationUrls(app: NavApp, target: NavTarget, os = Platform.OS): { native: string | null; web: string } {
  const ll = target.location ? `${target.location.lat},${target.location.lng}` : null;
  const q = encodeURIComponent(target.addressText);
  switch (app) {
    case "apple":
      return { native: os === "ios" ? `maps://?daddr=${ll ?? q}&dirflg=d` : null, web: `https://maps.apple.com/?daddr=${ll ?? q}&dirflg=d` };
    case "waze":
      return { native: ll ? `waze://?ll=${ll}&navigate=yes` : `waze://?q=${q}&navigate=yes`, web: ll ? `https://waze.com/ul?ll=${ll}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes` };
    case "google":
    default:
      return {
        native: os === "android" ? `google.navigation:q=${ll ?? q}&mode=d` : os === "ios" ? `comgooglemaps://?daddr=${ll ?? q}&directionsmode=driving` : null,
        web: `https://www.google.com/maps/dir/?api=1&destination=${ll ?? q}&travelmode=driving`,
      };
  }
}

/** Opens the chosen app; falls back to the https link when the app is not installed. Returns which was used. */
export async function openNavigation(app: NavApp, target: NavTarget, linking: Pick<typeof Linking, "openURL"> = Linking): Promise<"app" | "web"> {
  const { native, web } = navigationUrls(app, target);
  if (native) {
    try {
      await linking.openURL(native);
      return "app";
    } catch {
      // not installed / not allowed – fall through
    }
  }
  await linking.openURL(web);
  return "web";
}
