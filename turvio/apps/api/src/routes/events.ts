import { can, type Membership } from "@turvio/shared";
import type { FastifyInstance } from "fastify";
import { OrgParams, type RouteCtx } from "../http";
import type { ChangeEvent, ChangeFeed } from "../events";

/**
 * What one subscriber of the live feed may receive. Same rule as the database
 * (app.can_access_depot): owners/admins and members with all locations see the whole company;
 * everyone else only assigned locations – none = nothing. Positions only with tracking.view_live.
 */
export function liveEventFor(m: Pick<Membership, "organizationId" | "role" | "depotIds" | "allLocations">, e: ChangeEvent): "change" | "position" | null {
  if (e.org !== m.organizationId) return null;
  const companyWide = m.role === "owner" || m.role === "admin" || !!m.allLocations;
  if (!companyWide && (!e.depot || !(m.depotIds ?? []).includes(e.depot))) return null;
  if (e.table === "driver_positions") return can(m.role, "tracking.view_live") ? "position" : null;
  return "change";
}

/**
 * Server-sent events for Dispatch: "something changed in tour X". The stream
 * is filtered by tenant and by the subscriber's depot scope; it carries no
 * delivery data, clients reload through the normal endpoints.
 */
export function registerEventRoutes(app: FastifyInstance, { guards, events }: RouteCtx & { events: ChangeFeed }) {
  app.get("/v1/orgs/:orgId/events", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const m = { ...req.membership!, organizationId: orgId };

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: ready\ndata: {}\n\n`);
    const unsubscribe = events.subscribe((e) => {
      const kind = liveEventFor(m, e);
      // Live positions: own event type (the fleet map refetches positions only, the tour data stays).
      if (kind === "position") res.write(`event: position\ndata: ${JSON.stringify({ tour: e.tour })}\n\n`);
      if (kind !== "change") return;
      res.write(`event: change\ndata: ${JSON.stringify({ table: e.table, tour: e.tour, op: e.op })}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(`: keep-alive\n\n`), 25_000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
