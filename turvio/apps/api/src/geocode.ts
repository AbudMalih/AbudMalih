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

/** Normalisation identical to SQL geo.norm() (kept in sync; tested). */
export function normAddressPart(t: string): string {
  const map: Record<string, string> = { ä: "a", ö: "o", ü: "u", ß: "ss", à: "a", á: "a", â: "a", ã: "a", å: "a", ç: "c", è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i", ñ: "n", ò: "o", ó: "o", ô: "o", õ: "o", ù: "u", ú: "u", û: "u", ý: "y", ă: "a", ș: "s", ț: "t", ş: "s" };
  return [...t.toLowerCase()]
    .map((ch) => map[ch] ?? ch)
    .join("")
    // ASCII umlaut spellings (Haeuser, Goethe, Mueller) match the umlaut forms.
    .replace(/([aou])e/g, "$1")
    .replace(/(strasse|straße|str\.|str)(\s|$)/g, "str$2")
    .replace(/[^a-z0-9]/g, "");
}

/** Splits "Lister Meile 42, 30161 Hannover" style queries into parts. */
export function parseQuery(q: string): { street: string; houseNumber?: string; postcode?: string; city?: string } {
  let rest = q.replace(/\s+/g, " ").trim();
  const pc = /\b(\d{5})\b/.exec(rest);
  let city: string | undefined;
  if (pc) {
    city = rest.slice(pc.index + 5).replace(/^[\s,]+/, "").trim() || undefined;
    rest = rest.slice(0, pc.index).replace(/[\s,]+$/, "");
  } else {
    const comma = rest.split(",");
    if (comma.length > 1) {
      city = comma.slice(1).join(",").trim() || undefined;
      rest = comma[0]!.trim();
    } else {
      // "herrenhäuser str. 4 hannover": city after the house number, no comma or postcode.
      const m = /^(.*?[^\d\s])\s+(\d{1,4}[a-zA-Z]?(?:[-/]\d{1,4}[a-zA-Z]?)?)\s+([^\d,]{3,})$/.exec(rest);
      if (m) {
        city = m[3]!.trim();
        rest = `${m[1]} ${m[2]}`;
      }
    }
  }
  const hn = /^(.*?[^\d\s])\s*(\d{1,4}\s?[a-zA-Z]?(?:\s?[-/]\s?\d{1,4}[a-zA-Z]?)?)$/.exec(rest);
  return { street: hn ? hn[1]!.trim() : rest, houseNumber: hn ? hn[2]!.replace(/\s/g, "").toLowerCase() : undefined, postcode: pc?.[1], city };
}

interface AddressRow {
  street: string;
  house_number: string | null;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
  exact: boolean;
}

type Query = <R>(sql: string, params: unknown[]) => Promise<{ rows: R[] }>;

/**
 * Self-hosted geocoder on PostgreSQL (`geo.addresses`, imported from OpenStreetMap).
 * German address autocomplete by street prefix + house number + postal code/city.
 * A house number that does not exist gives a street-level result (precision "street"),
 * never an invented house position.
 */
export class PostgresGeocoder implements Geocoder {
  readonly name = "postgres";
  constructor(private readonly query: Query) {}

  async search(q: string, opts: { limit?: number } = {}): Promise<GeocodeResult[]> {
    const p = parseQuery(q);
    const street = normAddressPart(p.street);
    if (street.length < 3) return [];
    const limit = opts.limit ?? 5;
    const city = p.city ? normAddressPart(p.city) : null;
    const { rows } = await this.query<AddressRow>(
      `select street, house_number, postcode, city, lat, lng, (hn_norm = coalesce($2, '')) as exact
         from geo.addresses
        where street_norm like $1 || '%'
          and ($3::text is null or postcode = $3)
          and ($4::text is null or city_norm like $4 || '%')
          and ($2::text is null or hn_norm like $2 || '%')
        order by (hn_norm = coalesce($2, '')) desc, length(street_norm), street, nullif(regexp_replace(hn_norm, '\\D.*$', ''), '')::int nulls last, hn_norm
        limit $5`,
      [street, p.houseNumber ?? null, p.postcode ?? null, city, limit],
    );
    if (rows.length) return rows.map((r) => this.map(r, "house"));
    if (!p.houseNumber) return [];
    // House number unknown: street-level centre (clearly marked as such).
    const street2 = await this.query<AddressRow>(
      `select street, null as house_number, postcode, city, avg(lat) as lat, avg(lng) as lng, false as exact
         from geo.addresses where street_norm = $1 and ($2::text is null or postcode = $2) and ($3::text is null or city_norm like $3 || '%')
        group by street, postcode, city limit $4`,
      [street, p.postcode ?? null, city, limit],
    );
    return street2.rows.map((r) => this.map(r, "street"));
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const { rows } = await this.query<AddressRow>(
      `select street, house_number, postcode, city, lat, lng, true as exact from geo.addresses
        where lat between $1 - 0.002 and $1 + 0.002 and lng between $2 - 0.003 and $2 + 0.003
        order by (lat - $1) ^ 2 + ((lng - $2) * cos(radians($1))) ^ 2 limit 1`,
      [lat, lng],
    );
    return rows[0] ? this.map(rows[0], "house") : null;
  }

  /** Exact structured match for imports (no fuzzy guessing). */
  async exact(a: { street: string; houseNumber?: string; postalCode: string }): Promise<GeocodeResult | null> {
    const r = await this.search(`${a.street} ${a.houseNumber ?? ""}, ${a.postalCode}`, { limit: 2 });
    const hit = r.find((x) => x.precision === "house" && (!a.houseNumber || x.houseNumber?.toLowerCase().replace(/\s/g, "") === a.houseNumber.toLowerCase().replace(/\s/g, "")));
    return hit ?? (r[0]?.precision === "street" ? r[0] : null);
  }

  private map(r: AddressRow, precision: GeocodePrecision): GeocodeResult {
    const base = { street: r.street, houseNumber: r.house_number ?? undefined, postalCode: r.postcode, city: r.city, countryCode: "DE" };
    return { ...base, label: label(base), location: { lat: Number(r.lat), lng: Number(r.lng) }, precision, source: "osm-local" };
  }
}
