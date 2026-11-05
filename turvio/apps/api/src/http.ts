import type { OptimizeResponse, Permission } from "@turvio/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppDeps } from "./app";
import type { Db } from "./db";

export const OrgParams = z.object({ orgId: z.string().min(1).max(64) });

export function problem(reply: FastifyReply, status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return reply.status(status).send({ error: { code, message, ...extra } });
}

/** Parse a body/query with zod or answer 400 with the issues. */
export function parse<T extends z.ZodType>(schema: T, value: unknown, reply: FastifyReply): z.infer<T> | undefined {
  const r = schema.safeParse(value);
  if (!r.success) {
    void problem(reply, 400, "validation_failed", "Some fields are invalid", { issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return undefined;
  }
  return r.data;
}

export interface Guards {
  authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  requireTenant: (permission: Permission) => (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  claims: (req: FastifyRequest) => { sub: string; email?: string };
  callOptimizer: (body: unknown, timeLimitSeconds: number) => Promise<OptimizeResponse>;
}

export type RouteCtx = { deps: AppDeps & { db: Db }; guards: Guards };
