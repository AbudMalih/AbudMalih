import type { Db } from "./db";
import type { Geocoder } from "./geocode";
import type { RoutingProvider } from "./routing";
import { RoutingOutOfCoverage } from "./routing";

/**
 * Live platform status for TURVIO Admin (GET /v1/platform/system).
 *
 * Every "live" entry is measured at request time by a real call to the dependency (with a timeout).
 * "config" entries only report how this API instance is configured – they are labelled as such and
 * never presented as a health check. Nothing here reads tenant data.
 */
export type ServiceState = "operational" | "degraded" | "down" | "not_configured" | "disabled";
export interface ServiceStatus {
  key: string;
  label: string;
  kind: "live" | "config";
  state: ServiceState;
  detail: string;
  latencyMs?: number;
}
export interface SystemStatus {
  checkedAt: string;
  release: string | null;
  uptimeSeconds: number;
  services: ServiceStatus[];
  routingCounters: { routeRequests: number; tableRequests: number; failures: number; cacheHits: number } | null;
}
export interface SystemInfo {
  authProvider: string;
  adminMfaRequired: boolean;
  mailer: "outbox" | "smtp" | "none";
  proofStorage: "local" | "supabase" | "none";
  geocoder: string;
  addressDataVersion: string | null;
  roadDataVersion: string | null;
  release: string | null;
}

const TIMEOUT_MS = 4000;
// Fixed public reference points in Hannover (Hauptbahnhof → Kröpcke) for the routing probe.
const PROBE_FROM = { lat: 52.37677, lng: 9.74116 };
const PROBE_TO = { lat: 52.37438, lng: 9.73847 };
const PROBE_ADDRESS = "Lister Meile 4, 30161 Hannover";

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: Error; ms: number }> {
  const t0 = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS);
      }),
    ]);
    return { ok: true, value, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, error: e as Error, ms: Math.round(performance.now() - t0) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkSystem(deps: { db?: Db; optimizerUrl: string; fetchImpl: typeof fetch; routing?: RoutingProvider; geocoder?: Geocoder }, info: SystemInfo): Promise<SystemStatus> {
  const [database, optimizer, routing, geocoding] = await Promise.all([
    // Database: a real round trip through the API's pool.
    (async (): Promise<ServiceStatus> => {
      if (!deps.db) return { key: "database", label: "Database", kind: "live", state: "not_configured", detail: "No database configured for this API instance." };
      const r = await timed(() => deps.db!.asService(async (tx) => (await tx.query<{ v: string }>(`select current_setting('server_version') as v`)).rows[0]!.v));
      return r.ok
        ? { key: "database", label: "Database", kind: "live", state: r.ms > 1500 ? "degraded" : "operational", detail: `PostgreSQL ${r.value.split(" ")[0]} · query answered`, latencyMs: r.ms }
        : { key: "database", label: "Database", kind: "live", state: "down", detail: `Query failed: ${r.error.message}`, latencyMs: r.ms };
    })(),
    // Route optimizer: its own health endpoint.
    (async (): Promise<ServiceStatus> => {
      const r = await timed(async () => {
        const res = await deps.fetchImpl(`${deps.optimizerUrl.replace(/\/$/, "")}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.status;
      });
      return r.ok
        ? { key: "optimizer", label: "Route optimizer", kind: "live", state: "operational", detail: "OR-Tools service answered its health check", latencyMs: r.ms }
        : { key: "optimizer", label: "Route optimizer", kind: "live", state: "down", detail: `Health check failed: ${r.error.message}`, latencyMs: r.ms };
    })(),
    // Road routing (OSRM): a short real route.
    (async (): Promise<ServiceStatus> => {
      if (!deps.routing) return { key: "routing", label: "Road routing", kind: "live", state: "not_configured", detail: "No OSRM configured – travel times fall back to straight-line estimates." };
      const r = await timed(() => deps.routing!.route([PROBE_FROM, PROBE_TO]));
      const version = info.roadDataVersion ? ` · data ${info.roadDataVersion}` : "";
      if (r.ok) return { key: "routing", label: "Road routing", kind: "live", state: "operational", detail: `${deps.routing.name}: test route ${Math.round(r.value.distanceMeters)} m${version}`, latencyMs: r.ms };
      if (r.error instanceof RoutingOutOfCoverage) return { key: "routing", label: "Road routing", kind: "live", state: "degraded", detail: `Answering, but the test route is outside the loaded road graph${version}`, latencyMs: r.ms };
      return { key: "routing", label: "Road routing", kind: "live", state: "down", detail: `Test route failed: ${r.error.message}`, latencyMs: r.ms };
    })(),
    // Geocoding: a real address search.
    (async (): Promise<ServiceStatus> => {
      if (!deps.geocoder || info.geocoder === "none")
        return { key: "geocoding", label: "Address search", kind: "live", state: "not_configured", detail: "No geocoder configured – imported addresses are kept and marked “needs location”." };
      const r = await timed(() => deps.geocoder!.search(PROBE_ADDRESS, { countryCodes: ["de"], limit: 1 }));
      const version = info.addressDataVersion ? ` · data ${info.addressDataVersion}` : "";
      if (!r.ok) return { key: "geocoding", label: "Address search", kind: "live", state: "down", detail: `Test search failed: ${r.error.message}`, latencyMs: r.ms };
      return r.value.length
        ? { key: "geocoding", label: "Address search", kind: "live", state: "operational", detail: `${info.geocoder}: test address found (${r.value[0]!.precision})${version}`, latencyMs: r.ms }
        : { key: "geocoding", label: "Address search", kind: "live", state: "degraded", detail: `${info.geocoder}: answering, but the test address was not found${version}`, latencyMs: r.ms };
    })(),
  ]);

  const config: ServiceStatus[] = [
    {
      key: "auth",
      label: "Sign-in",
      kind: "config",
      state: "operational",
      detail: `${info.authProvider === "supabase" ? "Supabase Auth" : info.authProvider === "local" ? "TURVIO accounts" : "Development tokens"} · two-step verification for platform admins ${info.adminMfaRequired ? "required" : "not required"}`,
    },
    {
      key: "mail",
      label: "E-mail delivery",
      kind: "config",
      state: info.mailer === "smtp" ? "operational" : "not_configured",
      detail: info.mailer === "smtp" ? "SMTP configured (delivery is not tested here)" : "Development outbox – invitation and reset e-mails are not sent",
    },
    {
      key: "storage",
      label: "Proof-of-delivery storage",
      kind: "config",
      state: info.proofStorage === "none" ? "not_configured" : "operational",
      detail: info.proofStorage === "supabase" ? "Private Supabase Storage bucket" : info.proofStorage === "local" ? "Local disk of the API server" : "Not configured",
    },
    { key: "billing", label: "Online payments", kind: "config", state: "disabled", detail: "Intentionally off – subscriptions are managed manually" },
    { key: "carriers", label: "Carrier integrations", kind: "config", state: "disabled", detail: "Not connected – needs written authorization first" },
  ];

  const stats = deps.routing?.stats?.();
  return {
    checkedAt: new Date().toISOString(),
    release: info.release,
    uptimeSeconds: Math.round(process.uptime()),
    services: [{ key: "api", label: "Platform API", kind: "live", state: "operational", detail: "Answering this request" }, database, optimizer, routing, geocoding, ...config],
    routingCounters: stats ? { routeRequests: stats.routeRequests, tableRequests: stats.tableRequests, failures: stats.failures, cacheHits: stats.cacheHits } : null,
  };
}
