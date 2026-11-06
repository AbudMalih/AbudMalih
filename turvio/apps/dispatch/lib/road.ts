"use client";

import { routeKey } from "@turvio/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

export interface RoadRouteResponse {
  source: "osrm" | "none";
  note?: string;
  waypointStopIds: (string | null)[];
  legs?: { meters: number; seconds: number }[];
  geometry?: [number, number][];
  metrics?: { totalMeters: number; totalDriveSeconds: number; remainingMeters: number; remainingDriveSeconds: number; etas: Record<string, number> };
  unlocatedStopIds: string[];
}

export { routeKey };

/** Road route of a tour from the API (same endpoint as the driver app → same figures). */
export function useRoadRoute(orgId: string, tourId: string | null, key: string): RoadRouteResponse | null {
  const [data, setData] = useState<RoadRouteResponse | null>(null);
  useEffect(() => {
    if (!tourId) return setData(null);
    let cancelled = false;
    api<RoadRouteResponse>("GET", `/v1/orgs/${orgId}/tours/${tourId}/route`)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [orgId, tourId, key]);
  return data;
}
