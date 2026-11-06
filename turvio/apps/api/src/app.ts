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
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    membership?: Membership;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 2 * 1024 * 1024, trustProxy: true });
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.register(cors, { origin: deps.corsOrigins ?? false, credentials: true });

  app.setErrorHandler((err: { statusCode?: number; message: string; validation?: unknown }, req, reply) => {
    if (err instanceof ApiError) return problem(reply, err.status, err.code, err.message);
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
      req.membership = membership;
    };
  }

  async function callOptimizer(body: unknown, timeLimitSeconds: number): Promise<OptimizeResponse> {
    const res = await fetchImpl(`${deps.optimizerUrl.replace(/\/$/, "")}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout((timeLimitSeconds + 30) * 1000),
    }).catch(() => null);
    if (!res || !res.ok) throw new ApiError(502, "optimizer_unavailable", "Optimization service unavailable");
    const parsed = OptimizeResponse.safeParse(await res.json());
    if (!parsed.success) throw new ApiError(502, "optimizer_bad_response", "Unexpected optimizer response");
    return parsed.data;
  }

  const guards: Guards = { authenticate, requireTenant, claims: (req) => ({ sub: req.user!.userId, email: req.user!.email }), callOptimizer };

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
