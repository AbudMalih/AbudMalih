import { isOpen, tourStartPoint } from "@turvio/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OrgParams, parse, type RouteCtx } from "../http";
import { loadDispatchDataset } from "../data/dispatch";
import type { CheckGroup, LocationChecker } from "../location-check";

const Query = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), tourId: z.string().uuid().optional() });

/**
 * Location checks for the open stops of one operating day (P0-3.1): errors, warnings and
 * information per stop, with "pending" while checks still run. Read-only – never changes a stop.
 */
export function registerLocationRoutes(app: FastifyInstance, { deps, guards }: RouteCtx, checker: LocationChecker) {
  app.get("/v1/orgs/:orgId/location-checks", { preHandler: guards.requireTenant("tours.view_all") }, async (req, reply) => {
    const { orgId } = OrgParams.parse(req.params);
    const q = parse(Query, req.query, reply);
    if (!q) return;
    const data = await deps.db.asUser(guards.claims(req), (tx) => loadDispatchDataset(tx, orgId, q.date));
    const depots = new Map(data.depots.map((d) => [d.id, d]));
    const toCheck = (s: (typeof data.stops)[number]) => ({ id: s.id, location: s.location ?? null, address: s.address });
    const groups: CheckGroup[] = [];
    for (const t of data.tours) {
      if (q.tourId && t.id !== q.tourId) continue;
      if (t.status === "completed") continue;
      const depot = depots.get(t.depotId);
      const stops = data.stops.filter((s) => s.tourId === t.id && isOpen(s.status));
      if (stops.length) groups.push({ origin: depot ? tourStartPoint(t, depot.location) : null, stops: stops.map(toCheck) });
    }
    if (!q.tourId) {
      for (const d of data.depots) {
        const stops = data.unassigned.filter((u) => u.depotId === d.id && isOpen(u.status));
        if (stops.length) groups.push({ origin: d.location, stops: stops.map((u) => ({ id: u.id, location: u.location ?? null, address: u.address })) });
      }
    }
    const { checks, report } = await checker.check(groups);
    req.log.info({ orgId, locationChecks: report }, "location checks");
    return {
      date: data.date,
      pending: report.pending > 0,
      thresholds: checker.thresholds,
      checks,
      summary: {
        stops: checks.length,
        errors: checks.filter((c) => c.severity === "error").length,
        warnings: checks.filter((c) => c.severity === "warning").length,
        pending: report.pending,
        noLocation: checks.filter((c) => c.status === "no_location").length,
      },
    };
  });
}
