import type { GeoPoint } from "@turvio/shared";
import { ApiError } from "./auth";
import type { Requester } from "./outbox";

export interface AddressSuggestion {
  label: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  location: GeoPoint;
  precision: "house" | "street" | "postal_code" | "city" | "other";
  source: string;
}

export type SearchOutcome = { status: "ok"; results: AddressSuggestion[] } | { status: "unavailable" | "offline" | "rate_limited"; message: string };

/** Address search via the TURVIO API (the provider is configured server-side). */
export async function searchAddress(client: Requester | null, q: string, near?: GeoPoint): Promise<SearchOutcome> {
  if (!client) return { status: "unavailable", message: "No server configured" };
  const params = new URLSearchParams({ q, country: "DE", limit: "5" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lng", String(near.lng));
  }
  try {
    const r = await client.request<{ results: AddressSuggestion[] }>("GET", `/v1/geocode/search?${params.toString()}`);
    return { status: "ok", results: r.results };
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return { status: "unavailable", message: e.message };
    if (e instanceof ApiError && e.status === 429) return { status: "rate_limited", message: e.message };
    return { status: "offline", message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Bulk geocoding for imported rows. Only exact house-level matches are applied; street-level
 * results and misses are left as "needs map position" (never an invented house position).
 */
export async function geocodeImportRows<R extends { street: string; houseNumber?: string; postalCode: string; city: string; location: GeoPoint | null }>(
  client: Requester | null,
  rows: R[],
): Promise<{ rows: R[]; applied: number; streetOnly: number; status: SearchOutcome["status"] }> {
  const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.location);
  if (!client || !todo.length) return { rows, applied: 0, streetOnly: 0, status: client ? "ok" : "unavailable" };
  const out = [...rows];
  let applied = 0;
  let streetOnly = 0;
  try {
    for (let k = 0; k < todo.length; k += 200) {
      const chunk = todo.slice(k, k + 200);
      const res = await client.request<{ results: (AddressSuggestion | null)[] }>("POST", "/v1/geocode/batch", {
        addresses: chunk.map(({ r }) => ({ street: r.street, houseNumber: r.houseNumber, postalCode: r.postalCode, city: r.city })),
      });
      res.results.forEach((hit, j) => {
        const { i } = chunk[j]!;
        if (hit?.precision === "house") {
          out[i] = { ...out[i]!, location: hit.location };
          applied++;
        } else if (hit?.precision === "street") streetOnly++;
      });
    }
    return { rows: out, applied, streetOnly, status: "ok" };
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return { rows, applied: 0, streetOnly: 0, status: "unavailable" };
    if (e instanceof ApiError && e.status === 429) return { rows, applied, streetOnly, status: "rate_limited" };
    return { rows, applied, streetOnly, status: "offline" };
  }
}
