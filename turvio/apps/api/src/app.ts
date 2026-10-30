import cors from "@fastify/cors";
import {
  OptimizeRequest,
  OptimizeResponse,
  can,
  isSubscriptionUsable,
  type Membership,
  type Permission,
} from "@turvio/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthError, type AuthUser, type TokenVerifier } from "./auth";
import type { TenancyRepository } from "./tenancy";

export interface AppDeps {
  verifier: TokenVerifier;
  tenancy: TenancyRepository;
  optimizerUrl: string;
  corsOrigins?: string[];
  fetchImpl?: typeof fetch;
  logger?: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    membership?: Membership;
  }
}

const OrgParams = z.object({ orgId: z.string().min(1).max(64) });

function problem(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ error: { code, message } });
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.register(cors, { origin: deps.corsOrigins ?? false });

  // Never echo internals to clients.
  app.setErrorHandler((err: { statusCode?: number; message: string }, req, reply) => {
    req.log.error(err);
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    return problem(reply, status, status === 500 ? "internal_error" : "bad_request", status === 500 ? "Internal error" : err.message);
  });

  /** Authenticate the bearer token. */
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
   * Resolve the tenant from the URL (/v1/orgs/:orgId/...) and require an active
   * membership with the given permission. The tenant is always explicit – it
   * is never inferred from request bodies.
   */
  function requireTenant(permission: Permission) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      await authenticate(req, reply);
      if (reply.sent || !req.user) return;
      const params = OrgParams.safeParse(req.params);
      if (!params.success) return problem(reply, 400, "bad_request", "Invalid organization id");
      const membership = await deps.tenancy.getMembership(req.user.userId, params.data.orgId);
      // Same response for "no such org" and "not a member" to avoid tenant enumeration.
      if (!membership) return problem(reply, 403, "forbidden", "No access to this organization");
      const org = await deps.tenancy.getOrganization(params.data.orgId);
      if (!org || org.status === "suspended" || org.status === "cancelled") {
        return problem(reply, 403, "organization_inactive", "Organization is not active");
      }
      if (!can(membership.role, permission)) return problem(reply, 403, "forbidden", `Missing permission ${permission}`);
      req.membership = membership;
    };
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/me", { preHandler: authenticate }, async (req) => {
    const memberships = await deps.tenancy.listMemberships(req.user!.userId);
    return { userId: req.user!.userId, memberships: memberships.map((m) => ({ organizationId: m.organizationId, role: m.role })) };
  });

  app.get("/v1/orgs/:orgId/subscription", { preHandler: requireTenant("org.billing.view") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const sub = await deps.tenancy.getSubscription(orgId);
    if (!sub) return problem(reply, 404, "not_found", "No subscription");
    return { subscription: sub.subscription, plan: sub.plan, usable: isSubscriptionUsable(sub.subscription), paymentsEnabled: false };
  });

  app.post("/v1/orgs/:orgId/optimize", { preHandler: requireTenant("tours.optimize") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const sub = await deps.tenancy.getSubscription(orgId);
    if (!sub || !isSubscriptionUsable(sub.subscription)) {
      return problem(reply, 402, "subscription_inactive", "Subscription is not active");
    }
    if (!sub.plan.features.optimization) return problem(reply, 403, "feature_not_in_plan", "Optimization is not included in this plan");

    const body = OptimizeRequest.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: "validation_failed", message: "Invalid optimize request", issues: body.error.issues } });
    }

    const res = await fetchImpl(`${deps.optimizerUrl.replace(/\/$/, "")}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
      signal: AbortSignal.timeout((body.data.timeLimitSeconds + 30) * 1000),
    }).catch((e: unknown) => {
      req.log.error(e, "optimizer unreachable");
      return null;
    });
    if (!res || !res.ok) return problem(reply, 502, "optimizer_unavailable", "Optimization service unavailable");
    const parsed = OptimizeResponse.safeParse(await res.json());
    if (!parsed.success) return problem(reply, 502, "optimizer_bad_response", "Unexpected optimizer response");
    return parsed.data;
  });

  return app;
}
