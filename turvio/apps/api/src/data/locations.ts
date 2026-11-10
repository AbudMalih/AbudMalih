import type { GeoPoint, StopApproach } from "@turvio/shared";
import type { Db, Tx } from "../db";
import type { CheckToStore, StoredCheck } from "../location-check";

/**
 * Persistence for stop location checks and decisions (P0-3.2). Reads run as the user (RLS);
 * check results are written through app.store_location_check by the API's own role, which stores
 * nothing if the stop changed meanwhile.
 */

type CheckRow = {
  stop_id: string;
  status: "checked" | "partial";
  severity: StoredCheck["severity"];
  issues: StoredCheck["issues"];
  road: StoredCheck["road"];
  checked_lat: number;
  checked_lng: number;
  checked_address_version: number;
  road_data_version: string;
  address_data_version: string;
  rules_version: number;
  checked_at: Date;
};

export async function loadStoredChecks(tx: Tx, stopIds: string[]): Promise<Map<string, StoredCheck>> {
  if (!stopIds.length) return new Map();
  const { rows } = await tx.query<CheckRow>(`select * from public.stop_location_checks where stop_id = any($1::uuid[])`, [stopIds]);
  return new Map(
    rows.map((r) => [
      r.stop_id,
      {
        stopId: r.stop_id,
        status: r.status,
        severity: r.severity,
        issues: r.issues,
        road: r.road,
        checkedLat: r.checked_lat,
        checkedLng: r.checked_lng,
        checkedAddressVersion: r.checked_address_version,
        roadDataVersion: r.road_data_version,
        addressDataVersion: r.address_data_version,
        rulesVersion: r.rules_version,
        checkedAt: new Date(r.checked_at),
      },
    ]),
  );
}

/** Store finished results (never "pending"). Returns how many were stored (stale ones are skipped by the database). */
export async function saveChecks(db: Db, items: CheckToStore[]): Promise<number> {
  if (!items.length) return 0;
  return db.asService(async (tx) => {
    let n = 0;
    for (const c of items) {
      const r = await tx.query<{ ok: boolean }>(
        `select app.store_location_check($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) as ok`,
        [
          c.stopId,
          c.status,
          c.severity,
          JSON.stringify(c.issues),
          c.road ? JSON.stringify(c.road) : null,
          c.suggestion?.lat ?? null,
          c.suggestion?.lng ?? null,
          c.suggestion?.roadName ?? null,
          c.suggestion ? Math.round(c.suggestion.distanceMeters) : null,
          c.checkedLat,
          c.checkedLng,
          c.checkedAddressVersion,
          c.roadDataVersion,
          c.addressDataVersion,
          c.rulesVersion,
        ],
      );
      if (r.rows[0]?.ok) n++;
    }
    return n;
  });
}

export interface StopDecision {
  stopId: string;
  confirmation: { by: string | null; at: string; issueCodes: string[]; note: string | null } | null;
  approach: (StopApproach & { distanceMeters: number | null; acceptedBy: string | null; acceptedAt: string }) | null;
}

type DecisionRow = {
  stop_id: string;
  confirmed_by: string | null;
  confirmed_at: Date | null;
  confirmed_lat: number | null;
  confirmed_lng: number | null;
  confirmed_address_version: number | null;
  confirmed_issue_codes: string[] | null;
  confirmation_note: string | null;
  approach_lat: number | null;
  approach_lng: number | null;
  approach_road_name: string | null;
  approach_distance_m: number | null;
  approach_accepted_by: string | null;
  approach_accepted_at: Date | null;
  approach_for_lat: number | null;
  approach_for_lng: number | null;
  approach_for_address_version: number | null;
};

/**
 * Decisions that are valid for the stop as it is now: a confirmation or approach belongs to the
 * exact coordinate and address version it was made for (the database also deletes them on change;
 * this comparison is the second line of defence).
 */
export async function loadDecisions(tx: Tx, stops: { id: string; location: GeoPoint | null; addressVersion?: number }[]): Promise<Map<string, StopDecision>> {
  if (!stops.length) return new Map();
  const { rows } = await tx.query<DecisionRow>(`select * from public.stop_location_decisions where stop_id = any($1::uuid[])`, [stops.map((s) => s.id)]);
  const byId = new Map(stops.map((s) => [s.id, s]));
  const out = new Map<string, StopDecision>();
  for (const r of rows) {
    const s = byId.get(r.stop_id);
    if (!s?.location || s.addressVersion == null) continue;
    const same = (lat: number | null, lng: number | null, v: number | null) => lat === s.location!.lat && lng === s.location!.lng && v === s.addressVersion;
    const confirmation =
      r.confirmed_at && same(r.confirmed_lat, r.confirmed_lng, r.confirmed_address_version)
        ? { by: r.confirmed_by, at: new Date(r.confirmed_at).toISOString(), issueCodes: r.confirmed_issue_codes ?? [], note: r.confirmation_note }
        : null;
    const approach =
      r.approach_accepted_at && r.approach_lat != null && r.approach_lng != null && same(r.approach_for_lat, r.approach_for_lng, r.approach_for_address_version)
        ? {
            lat: r.approach_lat,
            lng: r.approach_lng,
            ...(r.approach_road_name ? { roadName: r.approach_road_name } : {}),
            distanceMeters: r.approach_distance_m,
            acceptedBy: r.approach_accepted_by,
            acceptedAt: new Date(r.approach_accepted_at).toISOString(),
          }
        : null;
    if (confirmation || approach) out.set(r.stop_id, { stopId: r.stop_id, confirmation, approach });
  }
  return out;
}
