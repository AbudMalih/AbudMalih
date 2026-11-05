/**
 * Address search / geocoding behind a provider interface. No provider is
 * active by default: TURVIO never invents coordinates, so without a provider
 * addresses are kept and marked "needs location" (the driver can set a pin).
 *
 * Providers (no paid service is enabled without approval):
 * - nominatim: a self-hosted Nominatim (or the public instance for light testing only –
 *   its usage policy forbids autocomplete and heavy use).
 * - photon: a self-hosted Photon (OSM-based search-as-you-type).
 */

export type GeocodePrecision = "house" | "street" | "postal_code" | "city" | "other";

export interface GeocodeResult {
  label: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  location: { lat: number; lng: number };
  precision: GeocodePrecision;
  source: string;
}

export interface Geocoder {
  readonly name: string;
  search(q: string, opts: { countryCodes?: string[]; limit?: number; near?: { lat: number; lng: number } }): Promise<GeocodeResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
}

export class GeocoderUnavailable extends Error {}

export class NoGeocoder implements Geocoder {
  readonly name = "none";
  async search(): Promise<GeocodeResult[]> {
    throw new GeocoderUnavailable("No geocoding provider configured");
  }
  async reverse(): Promise<GeocodeResult | null> {
    throw new GeocoderUnavailable("No geocoding provider configured");
  }
}

function precisionOf(type: string | undefined, hasHouse: boolean): GeocodePrecision {
  if (hasHouse) return "house";
  if (!type) return "other";
  if (/street|road|residential|highway/.test(type)) return "street";
  if (/postcode/.test(type)) return "postal_code";
  if (/city|town|village|municipality|district/.test(type)) return "city";
  return "other";
}

const label = (r: Omit<GeocodeResult, "label" | "location" | "precision" | "source">) =>
  [[r.street, r.houseNumber].filter(Boolean).join(" "), [r.postalCode, r.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export class NominatimGeocoder implements Geocoder {
  readonly name = "nominatim";
  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  private map(r: { lat: string; lon: string; type?: string; addresstype?: string; address?: Record<string, string> }): GeocodeResult {
    const a = r.address ?? {};
    const base = {
      street: a.road ?? a.pedestrian ?? a.footway,
      houseNumber: a.house_number,
      postalCode: a.postcode,
      city: a.city ?? a.town ?? a.village ?? a.municipality,
      countryCode: a.country_code?.toUpperCase(),
    };
    return { ...base, label: label(base), location: { lat: Number(r.lat), lng: Number(r.lon) }, precision: precisionOf(r.addresstype ?? r.type, !!a.house_number), source: this.name };
  }
  async search(q: string, opts: { countryCodes?: string[]; limit?: number }) {
    const u = new URL("search", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    u.searchParams.set("q", q);
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("addressdetails", "1");
    u.searchParams.set("limit", String(opts.limit ?? 5));
    if (opts.countryCodes?.length) u.searchParams.set("countrycodes", opts.countryCodes.join(",").toLowerCase());
    const r = await this.fetchImpl(u, { headers: { "user-agent": this.userAgent, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new GeocoderUnavailable(`Geocoder responded ${r.status}`);
    return ((await r.json()) as Parameters<NominatimGeocoder["map"]>[0][]).map((x) => this.map(x));
  }
  async reverse(lat: number, lng: number) {
    const u = new URL("reverse", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lng));
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("addressdetails", "1");
    const r = await this.fetchImpl(u, { headers: { "user-agent": this.userAgent, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new GeocoderUnavailable(`Geocoder responded ${r.status}`);
    const body = (await r.json()) as Parameters<NominatimGeocoder["map"]>[0] & { error?: string };
    return body.error ? null : this.map(body);
  }
}

export class PhotonGeocoder implements Geocoder {
  readonly name = "photon";
  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  private map(f: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }): GeocodeResult {
    const p = f.properties;
    const base = { street: p.street ?? (p.type === "street" ? p.name : undefined), houseNumber: p.housenumber, postalCode: p.postcode, city: p.city ?? p.town ?? p.village, countryCode: p.countrycode?.toUpperCase() };
    return { ...base, label: label(base) || p.name || "", location: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }, precision: precisionOf(p.type, !!p.housenumber), source: this.name };
  }
  private async get(path: string, params: Record<string, string>) {
    const u = new URL(path, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await this.fetchImpl(u, { headers: { "user-agent": this.userAgent, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new GeocoderUnavailable(`Geocoder responded ${r.status}`);
    return ((await r.json()) as { features: Parameters<PhotonGeocoder["map"]>[0][] }).features.map((f) => this.map(f));
  }
  async search(q: string, opts: { countryCodes?: string[]; limit?: number; near?: { lat: number; lng: number } }) {
    const params: Record<string, string> = { q, limit: String(opts.limit ?? 5) };
    if (opts.near) Object.assign(params, { lat: String(opts.near.lat), lon: String(opts.near.lng) });
    const all = await this.get("api", params);
    return opts.countryCodes?.length ? all.filter((r) => !r.countryCode || opts.countryCodes!.includes(r.countryCode)) : all;
  }
  async reverse(lat: number, lng: number) {
    return (await this.get("reverse", { lat: String(lat), lon: String(lng) }))[0] ?? null;
  }
}

/** Per-user token bucket – protects self-hosted geocoders and public usage policies. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {}
  take(key: string): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: t };
    b.tokens = Math.min(this.burst, b.tokens + ((t - b.at) / 1000) * this.perSecond);
    b.at = t;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.set(key, b);
    if (this.buckets.size > 10_000) this.buckets.clear();
    return ok;
  }
}
