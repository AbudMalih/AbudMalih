import { isOpen, sortBySequence, type Stop, type Tour } from "@turvio/shared";
import type { OutboxItem } from "./outbox";

/**
 * What dispatch changed between two syncs, told to the driver instead of replacing the route
 * silently: a tour gone from the list (withdrawn, cancelled, reassigned, moved, archived – the
 * app cannot tell which), finished by dispatch, stops added / removed / cancelled, a new order.
 * The driver's own pending actions (outbox) never count as dispatch changes.
 */
export type TourChange =
  | { kind: "removed"; tourId: string; tourName: string }
  | { kind: "finished"; tourId: string; tourName: string; reason?: string | null }
  | { kind: "stops_added"; tourId: string; tourName: string; count: number }
  | { kind: "stops_removed"; tourId: string; tourName: string; count: number }
  | { kind: "reordered"; tourId: string; tourName: string };

/** `today`: the company's calendar day – tours of an earlier day leave the list at midnight (not a change). */
export function diffTours(prev: { tours: Tour[]; stops: Stop[] }, next: { tours: Tour[]; stops: Stop[] }, outbox: OutboxItem[], today?: string): TourChange[] {
  const out: TourChange[] = [];
  // Stops the driver removed or merged away themselves (not a dispatch change).
  const ownRemoved = new Set(outbox.flatMap((o) => (o.kind === "stop_remove" || o.kind === "stop_merge" ? [o.stopId] : [])));
  const ownCreated = new Set(outbox.flatMap((o) => (o.kind === "create_stops" ? o.stops.map((s) => s.id) : [])));
  const ownStatus = new Set(outbox.flatMap((o) => (o.kind === "tour_status" ? [o.tourId] : [])));
  const ownSequence = new Set(outbox.flatMap((o) => (o.kind === "sequence" ? [o.tourId] : [])));
  const nextById = new Map(next.tours.map((t) => [t.id, t]));
  for (const p of prev.tours) {
    // The driver's own personal routes are theirs to change; only dispatch tours are reported.
    if (p.origin === "driver") continue;
    const n = nextById.get(p.id);
    if (!n) {
      if (p.status !== "completed" && (!today || p.date === today)) out.push({ kind: "removed", tourId: p.id, tourName: p.name });
      continue;
    }
    if (p.status !== "completed" && n.status === "completed" && !ownStatus.has(p.id)) {
      out.push({ kind: "finished", tourId: p.id, tourName: p.name, reason: n.closedRemotely ? (n.closeReason ?? null) : null });
      continue;
    }
    if (n.status === "completed") continue;
    const before = prev.stops.filter((s) => s.tourId === p.id);
    const after = next.stops.filter((s) => s.tourId === p.id);
    const beforeIds = new Set(before.map((s) => s.id));
    const afterIds = new Set(after.map((s) => s.id));
    const added = after.filter((s) => !beforeIds.has(s.id) && !ownCreated.has(s.id)).length;
    const removed = before.filter((s) => !afterIds.has(s.id) && !ownRemoved.has(s.id)).length;
    if (added) out.push({ kind: "stops_added", tourId: p.id, tourName: p.name, count: added });
    if (removed) out.push({ kind: "stops_removed", tourId: p.id, tourName: p.name, count: removed });
    if (!ownSequence.has(p.id)) {
      // Only stops on the tour before and after – additions / removals are reported above.
      const both = new Set([...beforeIds].filter((id) => afterIds.has(id)));
      const order = (xs: Stop[]) => sortBySequence(xs.filter((s) => both.has(s.id) && isOpen(s.status))).map((s) => s.id).join(",");
      if (order(before) !== order(after)) out.push({ kind: "reordered", tourId: p.id, tourName: p.name });
    }
  }
  return out;
}
