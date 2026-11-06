import cors from "@fastify/cors";
import { OptimizeRequest, OptimizeResponse, can, isSubscriptionUsable, type Membership, type Permission } from "@turvio/shared";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { OrgParams, problem, type Guards } from "./http";
import type { AuthProvider } from "./auth/provider";
import { AuthError, type AuthUser, type TokenVerifier } from "./auth/tokens";
import { ApiError, type Db } from "./db";
import type { ChangeFeed } from "./events";
import type { Mailer } from "./mail";
import { registerAuthRoutes } from "./routes/auth";
import { registerDriverRoutes } from "./routes/driver";
import { registerEventRoutes } from "./routes/events";
import { registerExecutionRoutes } from "./routes/execution";
import type { Geocoder } from "./geocode";
import type { ProofStore } from "./storage";
import type { RoutingProvider } from "./routing";
import { RateLimiter } from "./geocode";
import { registerOrgRoutes } from "./routes/org";
import { registerPlatformRoutes } from "./routes/platform";
import { registerTourRoutes } from "./routes/tours";
import type { TenancyRepository } from "./tenancy";

export interface AppDeps {
  verifier: TokenVerifier;
  tenancy: TenancyRepository;
  optimizerUrl: string;
  corsOrigins?: string[];
  fetchImpl?: typeof fetch;
  logger?: boolean;
  /** Persistence (required for everything except the stateless optimize gateway). */
  db?: Db;
  auth?: AuthProvider;
  mailer?: Mailer;
  urls?: { dispatch: string; admin: string };
  devMailbox?: boolean;
  events?: ChangeFeed;
  proofStore?: ProofStore;
  geocoder?: Geocoder;
  routing?: RoutingProvider;
  /** Requests per minute per client IP (default 600; 0 = off). */
  rateLimitPerMinute?: number;
  /** Fastify trustProxy: true, false or the number of trusted proxy hops. */
  trustProxy?: boolean | number;
  /**
   * Require a second factor (aal2 session) for company-administration
   * permissions and all /v1/platform endpoints. Default: off (config turns it on
   * in production).
   */
  requireAdminMfa?: boolean;
}

/** Permissions that change or reveal company administration; with requireAdminMfa they need an aal2 session. */
export const ADMIN_MFA_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>(["org.settings.manage", "org.members.manage", "org.billing.view"]);

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    membership?: Membership;
  }
}

/** User-facing text for road-routing failures reported by the optimizer. */
function routingMessage(code: string, detail?: string): string {
  if (code === "routing_out_of_coverage") return `Road routing does not cover these locations – not optimized. ${detail ?? ""}`.trim();
  if (code === "routing_degenerate") return "Road routing returned no usable distances for these locations – not optimized.";
  return "Road routing is unavailable – not optimized. Try again later.";
}

/** Fastify accepts a hop count at runtime but not in its types; express it as a trust function. */
function trustProxySetting(v: boolean | number | undefined): boolean | ((addr: string, hop: number) => boolean) {
  if (typeof v === "number") return (_addr, hop) => hop < v;
  return v ?? true;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 2 * 1024 * 1024, trustProxy: trustProxySetting(deps.trustProxy) });
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.register(cors, { origin: deps.corsOrigins ?? false, credentials: true });

  // Coarse abuse protection per client IP (login and geocoding have their own, stricter limits).
  const perMinute = deps.rateLimitPerMinute ?? 600;
  if (perMinute > 0) {
    const limiter = new RateLimiter(perMinute / 60, perMinute / 4);
    app.addHook("onRequest", async (req, reply) => {
      if (req.url === "/health" || req.url.endsWith("/events")) return;
      if (!limiter.take(req.ip)) return reply.status(429).header("retry-after", "10").send({ error: { code: "rate_limited", message: "Too many requests – slow down" } });
    });
  }

  app.setErrorHandler((err: { statusCode?: number; message: string; validation?: unknown }, req, reply) => {
    if (err instanceof ApiError) return problem(reply, err.status, err.code, err.message, err.details);
    req.log.error(err);
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    return problem(reply, status, status === 500 ? "internal_error" : "bad_request", status === 500 ? "Something went wrong on our side" : err.message);
  });

  async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    try {
      req.user = await deps.verifier.verify(token);
    } catch (e) {
      if (e instanceof AuthError) return problem(reply, 401, "unauthenticated", "Missing or invalid access token");
      throw e;
    }
  }

  /**
   * Tenant from the URL (/v1/orgs/:orgId/...): active membership + permission.
   * Unknown org and non-membership give the same answer (no tenant enumeration).
   */
  function requireTenant(permission: Permission) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      await authenticate(req, reply);
      if (reply.sent || !req.user) return;
      const params = OrgParams.safeParse(req.params);
      if (!params.success) return problem(reply, 400, "bad_request", "Invalid organization id");
      const membership = await deps.tenancy.getMembership(req.user.userId, params.data.orgId);
      if (!membership) return problem(reply, 403, "forbidden", "No access to this organization");
      const org = await deps.tenancy.getOrganization(params.data.orgId, req.user.userId);
      if (!org || org.status === "suspended" || org.status === "cancelled") return problem(reply, 403, "organization_inactive", "Organization is not active");
      if (!can(membership.role, permission)) return problem(reply, 403, "forbidden", `Missing permission ${permission}`);
      if (ADMIN_MFA_PERMISSIONS.has(permission) && !requireAal2(req, reply)) return;
      req.membership = membership;
    };
  }

  /** With requireAdminMfa: true when the session is aal2, else answers 403 mfa_required. Runs after the other checks, never instead of them. */
  function requireAal2(req: FastifyRequest, reply: FastifyReply): boolean {
    if (!deps.requireAdminMfa || req.user?.aal === "aal2") return true;
    void problem(reply, 403, "mfa_required", "This action needs two-step verification. Set it up or sign in with your authenticator code.");
    return false;
  }

  async function callOptimizer(body: unknown, timeLimitSeconds: number): Promise<OptimizeResponse> {
    const res = await fetchImpl(`${deps.optimizerUrl.replace(/\/$/, "")}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout((timeLimitSeconds + 30) * 1000),
    }).catch(() => null);
    if (res && (res.status === 422 || res.status === 503)) {
      // Road routing failed inside the optimizer: never turn that into a "successful" plan.
      const body = (await res.json().catch(() => ({}))) as { detail?: { code?: string; message?: string; points?: unknown[] } };
      const d = body.detail;
      if (d?.code?.startsWith("routing_")) {
        throw new ApiError(res.status === 422 ? 422 : 503, d.code, routingMessage(d.code, d.message), { points: Array.isArray(d.points) ? d.points : [] });
      }
    }
    if (!res || !res.ok) throw new ApiError(502, "optimizer_unavailable", "Optimization service unavailable");
    const parsed = OptimizeResponse.safeParse(await res.json());
    if (!parsed.success) throw new ApiError(502, "optimizer_bad_response", "Unexpected optimizer response");
    return parsed.data;
  }

  const guards: Guards = { authenticate, requireTenant, requireAal2, claims: (req) => ({ sub: req.user!.userId, email: req.user!.email }), callOptimizer };

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/me", { preHandler: authenticate }, async (req) => {
    const memberships = await deps.tenancy.listMemberships(req.user!.userId);
    const platformAdmin = deps.db
      ? await deps.db.asUser(guards.claims(req), async (tx) => (await tx.query<{ ok: boolean }>(`select app.is_platform_admin() as ok`)).rows[0]!.ok)
      : false;
    const name = deps.auth ? await deps.auth.displayName(req.user!.userId) : null;
    return {
      userId: req.user!.userId,
      email: req.user!.email ?? null,
      name,
      aal: req.user!.aal ?? "aal1",
      platformAdmin,
      memberships: memberships.map((m) => ({ organizationId: m.organizationId, organizationName: m.organizationName ?? null, role: m.role, depotIds: m.depotIds ?? null })),
    };
  });

  app.get("/v1/orgs/:orgId/subscription", { preHandler: requireTenant("org.billing.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const sub = await deps.tenancy.getSubscription(orgId, req.user!.userId);
    if (!sub) return problem(reply, 404, "not_found", "No subscription");
    return { subscription: sub.subscription, plan: sub.plan, usable: isSubscriptionUsable(sub.subscription), paymentsEnabled: false };
  });

  /** Stateless optimization of arbitrary stops (used by clients without saved tours). */
  app.post("/v1/orgs/:orgId/optimize", { preHandler: requireTenant("tours.optimize") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const sub = await deps.tenancy.getSubscription(orgId, req.user!.userId);
    if (!sub || !isSubscriptionUsable(sub.subscription)) return problem(reply, 402, "subscription_inactive", "Subscription is not active");
    if (!sub.plan.features.optimization) return problem(reply, 403, "feature_not_in_plan", "Optimization is not included in this plan");
    const body = OptimizeRequest.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: { code: "validation_failed", message: "Invalid optimize request", issues: body.error.issues } });
    return callOptimizer(body.data, body.data.timeLimitSeconds);
  });

  if (deps.db) {
    const ctx = { deps: deps as AppDeps & { db: Db }, guards };
    if (deps.auth) registerAuthRoutes(app, { ...ctx, auth: deps.auth });
    registerOrgRoutes(app, ctx);
    registerTourRoutes(app, ctx);
    registerDriverRoutes(app, ctx);
    registerExecutionRoutes(app, ctx, { proofStore: deps.proofStore, geocoder: deps.geocoder, routing: deps.routing });
    registerPlatformRoutes(app, ctx);
    if (deps.events) registerEventRoutes(app, { ...ctx, events: deps.events });
  }

  return app;
}


export { OrgParams, parse, problem } from "./http";
export type { Guards, RouteCtx } from "./http";
