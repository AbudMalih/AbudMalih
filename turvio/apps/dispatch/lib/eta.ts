import { formatClock, formatDuration, isOpen, type DelayCertainty, type Stop, type StopDeadlineState, type Tour, type TourProjection, type TourSummary } from "@turvio/shared";
import type { BadgeTone } from "@turvio/web-ui/ds";

/**
 * The words Dispatch uses for times, ETAs and delays – one place, so the tour list, detail, map,
 * KPIs, pickups and live panel say the same thing for the same projection (shared projectTour).
 *
 * Facts:       "Deadline missed" (deadline passed, stop still open), "Delivered late"
 * Predictions: "Projected late" (road times), "Possibly late (estimate)" (straight line)
 * Tour status: "Delayed" (a fact), "Delay projected" (road), "Delay possible (estimate)"
 */

export const ESTIMATE_REASON: Record<NonNullable<TourProjection["estimateReason"]>, string> = {
  routing_unavailable: "road routing is unavailable",
  out_of_coverage: "some stops are outside the road data",
  pending: "road times are still being calculated",
  not_configured: "no road routing is configured",
  stale: "the stop order changed – road times are being updated",
};

export function delayLabel(certainty: DelayCertainty | null): string {
  if (certainty === "projected") return "Delay projected";
  if (certainty === "estimated") return "Delay possible (estimate)";
  return "Delayed";
}

export function stopStateLabel(state: StopDeadlineState, source: TourProjection["source"]): { label: string; tone: BadgeTone } | null {
  const est = source === "estimate";
  switch (state) {
    case "deadline_missed":
      return { label: "Deadline missed", tone: "danger" };
    case "delivered_late":
      return { label: "Delivered late", tone: "danger" };
    case "projected_late":
      return est ? { label: "Possibly late (estimate)", tone: "warning" } : { label: "Projected late", tone: "danger" };
    case "at_risk":
      return { label: est ? "Close to deadline (estimate)" : "Close to deadline", tone: "warning" };
    case "unknown":
      return { label: "No ETA – no usable map position", tone: "danger" };
    default:
      return null;
  }
}

/** "Return to depot" / "Arrive at end address" / "Finish at last stop". */
export function finishTitle(tour: Pick<Tour, "endMode" | "endLocation">, p: TourProjection): string {
  if (p.endsAtLastStop) return "Finish at last stop";
  if (tour.endMode === "address" || (!tour.endMode && tour.endLocation)) return "Arrive at end address";
  return "Return to depot";
}

/** Short form for lists: "Return" / "At end address" / "Finish at last stop". */
export function finishShort(tour: Pick<Tour, "endMode" | "endLocation">, p: TourProjection): string {
  const t = finishTitle(tour, p);
  return t === "Return to depot" ? "Return" : t === "Arrive at end address" ? "At end address" : t;
}

/** Projected finish as a clock time: "≥ 14:05" when stops lack a position (never definitive). */
export function finishValue(p: TourProjection): string {
  return `${p.complete ? "" : "≥ "}${formatClock(p.finishMinute)}`;
}

export function ageLabel(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const m = Math.round(seconds / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Where the projection counts from: live GPS, last completed stop (with GPS age), tour start. */
export function originLabel(p: TourProjection): string {
  if (p.origin === "completed") return "actual times";
  if (p.origin === "gps") return `from live position (${ageLabel(p.gpsAgeSeconds ?? 0)} old)`;
  const gps = p.gpsAgeSeconds !== null ? `last GPS ${ageLabel(p.gpsAgeSeconds)} ago` : "no GPS position";
  if (p.origin === "last_completed_stop") return `from last completed stop · ${gps}`;
  return p.condition === "start_now" || p.condition === null ? "from tour start" : `from tour start · ${gps}`;
}

/** The assumption behind a projection that is not happening right now. */
export function conditionLabel(p: TourProjection): string | null {
  if (p.condition === "resume_now") return "Paused – times assume the driver resumes now";
  if (p.condition === "start_now") return "Not started yet – times assume the tour starts now";
  return null;
}

export function basisLabel(p: TourProjection): string {
  return p.source === "road" ? "Road times (OSRM)" : `Straight-line estimate – ${p.estimateReason ? ESTIMATE_REASON[p.estimateReason] : "no road times"}`;
}

/**
 * A planned tour that is late to start has two finishes: the scheduled one (had it left at its
 * planned start) and the revised one (departing now). Null when there is only one.
 */
export function scheduledFinishLabel(p: TourProjection): string | null {
  return p.scheduledFinishMinute === null ? null : `scheduled finish ${p.complete ? "" : "≥ "}${formatClock(p.scheduledFinishMinute)}`;
}

/** One line under a finish/ETA figure: basis · origin · condition · scheduled finish · completeness. */
export function projectionNote(p: TourProjection): string {
  const parts = [basisLabel(p), originLabel(p)];
  const c = conditionLabel(p);
  if (c) parts.push(c);
  const sched = scheduledFinishLabel(p);
  if (sched) parts.push(sched);
  if (!p.complete) parts.push(`incomplete: ${p.unlocatedStopIds.length} stop${p.unlocatedStopIds.length > 1 ? "s" : ""} without a usable map position`);
  return parts.join(" · ");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Map tooltip of a stop: ETA and warning from the same projection as the stop row and list; location check and approach (P0-3.4). */
export function stopTooltipHtml(s: TourSummary, stop: Stop, index: number, location?: { label: string } | null): string {
  const eta = s.timeline.projections.get(stop.id);
  const warn = eta ? stopStateLabel(eta.state, s.timeline.projection.source) : null;
  const etaText = eta && Number.isFinite(eta.etaMinute) ? `ETA ${formatClock(eta.etaMinute)}${s.timeline.projection.source === "estimate" ? " (est.)" : ""}` : "";
  return `<strong>${index}. ${esc(stop.recipientName ?? "")}</strong><br/>${esc(stop.address.street)} ${esc(stop.address.houseNumber ?? "")}<br/>${
    !isOpen(stop.status) ? esc(stop.status) : etaText
  }${stop.timeWindow ? ` · window ${formatClock(stop.timeWindow.start)}–${formatClock(stop.timeWindow.end)}` : ""}${warn ? `<br/>${esc(warn.label)}` : ""}${
    location && isOpen(stop.status) ? `<br/>${esc(location.label)}` : ""
  }${stop.approach && isOpen(stop.status) ? `<br/>Navigation approach: ${esc(stop.approach.roadName ?? "set")}` : ""}`;
}

export const minutes = (seconds: number) => formatDuration(Math.round(seconds / 60));
