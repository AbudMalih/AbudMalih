import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parse, problem, type RouteCtx } from "../http";
import { AuthFailure, type AuthProvider } from "../auth/provider";
import { hashToken } from "../auth/tokens";

const Email = z.string().trim().toLowerCase().email().max(254);

const STATUS: Record<AuthFailure["code"], number> = {
  invalid_credentials: 401,
  too_many_attempts: 429,
  invalid_token: 401,
  weak_password: 422,
  not_configured: 501,
  invalid_code: 422,
  mfa_required: 403,
  no_pending_factor: 409,
  mfa_already_enabled: 409,
};

const Code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export function registerAuthRoutes(app: FastifyInstance, ctx: RouteCtx & { auth: AuthProvider }) {
  const { auth, deps, guards } = ctx;
  const db = deps.db;

  const fail = (reply: Parameters<typeof problem>[0], e: unknown) => {
    if (e instanceof AuthFailure) return problem(reply, STATUS[e.code], e.code, e.message);
    throw e;
  };

  app.post("/v1/auth/login", async (req, reply) => {
    const body = parse(z.object({ email: Email, password: z.string().min(1).max(200) }), req.body, reply);
    if (!body) return;
    try {
      return await auth.login(body.email, body.password, req.headers["user-agent"]);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/auth/refresh", async (req, reply) => {
    const body = parse(z.object({ refreshToken: z.string().min(10).max(500) }), req.body, reply);
    if (!body) return;
    try {
      return await auth.refresh(body.refreshToken, req.headers["user-agent"]);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // --- Second factor (TOTP) -------------------------------------------------
  const caller = (req: FastifyRequest) => ({
    userId: req.user!.userId,
    email: req.user!.email,
    aal: req.user!.aal,
    accessToken: (req.headers.authorization ?? "").slice("Bearer ".length),
  });

  app.get("/v1/auth/mfa", { preHandler: guards.authenticate }, async (req, reply) => {
    try {
      const status = await auth.mfaStatus(caller(req));
      return { ...status, aal: req.user!.aal ?? "aal1", factorType: "totp" };
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/auth/mfa/enroll", { preHandler: guards.authenticate }, async (req, reply) => {
    try {
      return await auth.mfaEnroll(caller(req));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/auth/mfa/activate", { preHandler: guards.authenticate }, async (req, reply) => {
    const body = parse(z.object({ code: Code }), req.body, reply);
    if (!body) return;
    try {
      return await auth.mfaActivate(caller(req), body.code, req.headers["user-agent"]);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/auth/mfa/verify", async (req, reply) => {
    const body = parse(z.object({ mfaToken: z.string().min(10).max(4000), code: Code }), req.body, reply);
    if (!body) return;
    try {
      return await auth.mfaVerify(body.mfaToken, body.code, req.headers["user-agent"]);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const body = parse(z.object({ refreshToken: z.string().min(10).max(500) }), req.body, reply);
    if (!body) return;
    await auth.logout(body.refreshToken);
    return reply.status(204).send();
  });

  app.post("/v1/auth/password/forgot", async (req, reply) => {
    const body = parse(z.object({ email: Email, app: z.enum(["dispatch", "admin"]).default("dispatch") }), req.body, reply);
    if (!body) return;
    const base = body.app === "admin" ? deps.urls?.admin : deps.urls?.dispatch;
    await auth.requestPasswordReset(body.email, base ?? "http://localhost:3000");
    // Same answer whether or not the account exists.
    return reply.status(202).send({ status: "sent_if_exists" });
  });

  app.post("/v1/auth/password/reset", async (req, reply) => {
    const body = parse(z.object({ token: z.string().min(10).max(2000), password: z.string().min(1).max(200) }), req.body, reply);
    if (!body) return;
    try {
      await auth.resetPassword(body.token, body.password);
      return reply.status(204).send();
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/v1/invitations/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const info = await db.asService(async (tx) => (await tx.query(`select * from app.invitation_info($1)`, [hashToken(token)])).rows[0]);
    if (!info) return problem(reply, 404, "not_found", "Invitation not found");
    return { organizationName: info.organization_name, email: info.email, role: info.role, state: info.state };
  });

  app.post("/v1/invitations/accept", async (req, reply) => {
    const body = parse(
      z.object({ token: z.string().min(10).max(500), password: z.string().min(1).max(200), displayName: z.string().trim().min(1).max(120).optional() }),
      req.body,
      reply,
    );
    if (!body) return;
    const hash = hashToken(body.token);
    const info = await db.asService(async (tx) => (await tx.query<{ email: string; state: string }>(`select * from app.invitation_info($1)`, [hash])).rows[0]);
    if (!info || info.state !== "open") return problem(reply, 410, "invitation_unavailable", "This invitation is no longer valid");
    try {
      const { userId } = await auth.ensureUser(info.email, body.password, body.displayName ?? null);
      await db.asService((tx) => tx.query(`select app.accept_invitation($1, $2)`, [hash, userId]));
      return await auth.login(info.email, body.password, req.headers["user-agent"]);
    } catch (e) {
      return fail(reply, e);
    }
  });

  if (deps.devMailbox) {
    // Local testing of reset/invitation mails. Disabled in production by config validation.
    app.get("/v1/dev/outbox", async (req) => {
      const { to } = req.query as { to?: string };
      return db.asService(async (tx) => {
        const { rows } = await tx.query(
          `select id, to_email as "to", subject, body, created_at as "createdAt" from app_auth.outbox where ($1::text is null or lower(to_email) = lower($1)) order by id desc limit 20`,
          [to ?? null],
        );
        return rows;
      });
    });
  }
}
