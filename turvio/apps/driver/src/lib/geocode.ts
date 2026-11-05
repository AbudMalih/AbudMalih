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
