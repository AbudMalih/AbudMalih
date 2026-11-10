import type { GeoPoint, Stop } from "@turvio/shared";

/**
 * Location checks as the driver sees them (P0-3.5). Dispatch decides; the driver is told what
 * matters on the road. A pending or partial check is never presented as "checked". A result only
 * applies while the stop is still at the coordinate it was made for (`forLat`/`forLng`).
 */
export interface DriverLocationCheck {
  stopId: string;
  status: "checked" | "partial" | "pending" | "no_location";
  severity: "error" | "warning" | "info" | null;
  issues: { code: string; severity: "error" | "warning" | "info"; message: string }[];
  acknowledged: boolean;
  forLat?: number;
  forLng?: number;
}

export type LocationNotice = { tone: "danger" | "warning" | "info"; key: "location.error" | "location.warning" | "location.confirmed" | "location.approach"; text: string };

/** The check result for the stop as it is now – undefined if it was made for another coordinate. */
export function currentCheck(stop: Stop, check: DriverLocationCheck | undefined): DriverLocationCheck | undefined {
  if (!check || !stop.location) return undefined;
  if (check.forLat !== undefined && (check.forLat !== stop.location.lat || check.forLng !== stop.location.lng)) return undefined;
  return check;
}

/** Short pill for lists; null when there is nothing to say. */
export function locationPill(stop: Stop, check: DriverLocationCheck | undefined): { tone: "danger" | "warning"; key: "location.pillError" | "location.pillWarning" } | null {
  const c = currentCheck(stop, check);
  if (!c || c.status === "pending") return null;
  if (c.severity === "error") return { tone: "danger", key: "location.pillError" };
  if (c.severity === "warning" && !c.acknowledged) return { tone: "warning", key: "location.pillWarning" };
  return null;
}

/** Notices for the stop screen: problems first, then where navigation goes. */
export function locationNotices(stop: Stop, check: DriverLocationCheck | undefined): LocationNotice[] {
  const out: LocationNotice[] = [];
  const c = currentCheck(stop, check);
  if (c && c.status !== "pending") {
    const relevant = c.issues.filter((i) => i.severity !== "info");
    if (c.severity === "error") out.push({ tone: "danger", key: "location.error", text: relevant.map((i) => i.message).join(" ") });
    else if (c.severity === "warning" && !c.acknowledged) out.push({ tone: "warning", key: "location.warning", text: relevant.map((i) => i.message).join(" ") });
    else if (c.severity === "warning" && c.acknowledged) out.push({ tone: "info", key: "location.confirmed", text: "" });
  }
  if (stop.approach) out.push({ tone: "info", key: "location.approach", text: stop.approach.roadName ?? "" });
  return out;
}

/** Where navigation goes: the accepted approach point (set by dispatch, valid for this pin), else the pin. */
export function navigationPoint(stop: Pick<Stop, "location" | "approach">): GeoPoint | null {
  if (!stop.location) return null;
  return stop.approach ? { lat: stop.approach.lat, lng: stop.approach.lng } : stop.location;
}
