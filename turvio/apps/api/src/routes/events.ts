import { can } from "@turvio/shared";
import type { FastifyInstance } from "fastify";
import { OrgParams, type RouteCtx } from "../http";
import type { ChangeFeed } from "../events";

/**
 * Server-sent events for Dispatch: "something changed in tour X". The stream
 * is filtered by tenant and by the subscriber's depot scope; it carries no
 * delivery data, clients reload through the normal endpoints.
 */
export function registerEventRoutes(app: FastifyInstance, { guards, events }: RouteCtx & { events: ChangeFeed }) {
  app.get("/v1/orgs/:orgId/events", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const m = req.membership!;
    const limited = m.role === "dispatcher" && m.depotIds && m.depotIds.length > 0 ? new Set(m.depotIds) : null;
    const seesLive = can(m.role, "tracking.view_live");

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
      if (e.org !== orgId) return;
      if (limited && (!e.depot || !limited.has(e.depot))) return;
      if (e.table === "driver_positions") {
        // Live positions: own event type (the fleet map refetches positions only, the tour data
        // stays as it is); only for roles that may see live positions.
        if (seesLive) res.write(`event: position\ndata: ${JSON.stringify({ tour: e.tour })}\n\n`);
        return;
      }
      res.write(`event: change\ndata: ${JSON.stringify({ table: e.table, tour: e.tour, op: e.op })}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(`: keep-alive\n\n`), 25_000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
