import { formatClock, isOpen, type DelayCertainty, type Stop, type StopDeadlineState, type Tour, type TourProjection, type TourSummary } from "@turvio/shared";
import type { BadgeTone } from "@turvio/web-ui/ds";
import { durationText, EN_T, type TFunction } from "./i18n";

/**
 * The words Dispatch uses for times, ETAs and delays – one place, so the tour list, detail, map,
 * KPIs, pickups and live panel say the same thing for the same projection (shared projectTour).
 * Every function takes the translator of the current language (English by default).
 *
 * Facts:       "Deadline missed" (deadline passed, stop still open), "Delivered late"
 * Predictions: "Projected late" (road times), "Possibly late (estimate)" (straight line)
 * Tour status: "Delayed" (a fact), "Delay projected" (road), "Delay possible (estimate)"
 */

export const estimateReason = (r: NonNullable<TourProjection["estimateReason"]>, t: TFunction = EN_T) => t(`common.estimate.${r}`);

export function delayLabel(certainty: DelayCertainty | null, t: TFunction = EN_T): string {
  if (certainty === "projected") return t("common.delayProjected");
  if (certainty === "estimated") return t("common.delayEstimated");
  return t("common.delayed");
}

export function stopStateLabel(state: StopDeadlineState, source: TourProjection["source"], t: TFunction = EN_T): { label: string; tone: BadgeTone } | null {
  const est = source === "estimate";
  switch (state) {
    case "deadline_missed":
      return { label: t("common.deadlineMissed"), tone: "danger" };
    case "delivered_late":
      return { label: t("common.deliveredLate"), tone: "danger" };
    case "projected_late":
      return est ? { label: t("common.possiblyLate"), tone: "warning" } : { label: t("common.projectedLate"), tone: "danger" };
    case "at_risk":
      return { label: est ? t("common.closeToDeadlineEst") : t("common.closeToDeadline"), tone: "warning" };
    case "unknown":
      return { label: t("common.noEta"), tone: "danger" };
    default:
      return null;
  }
}

type FinishKind = "last_stop" | "end_address" | "depot";
function finishKind(tour: Pick<Tour, "endMode" | "endLocation">, p: TourProjection): FinishKind {
  if (p.endsAtLastStop) return "last_stop";
  if (tour.endMode === "address" || (!tour.endMode && tour.endLocation)) return "end_address";
  return "depot";
}

/** "Return to depot" / "Arrive at end address" / "Finish at last stop". */
export function finishTitle(tour: Pick<Tour, "endMode" | "endLocation">, p: TourProjection, t: TFunction = EN_T): string {
  const k = finishKind(tour, p);
  return k === "last_stop" ? t("common.finishLastStop") : k === "end_address" ? t("common.finishEndAddress") : t("common.finishDepot");
}

/** Short form for lists: "Return" / "At end address" / "Finish at last stop". */
export function finishShort(tour: Pick<Tour, "endMode" | "endLocation">, p: TourProjection, t: TFunction = EN_T): string {
  const k = finishKind(tour, p);
  return k === "last_stop" ? t("common.finishLastStop") : k === "end_address" ? t("common.finishShortEndAddress") : t("common.finishShortDepot");
}

/** Projected finish as a clock time: "≥ 14:05" when stops lack a position (never definitive). */
export function finishValue(p: TourProjection): string {
  return `${p.complete ? "" : "≥ "}${formatClock(p.finishMinute)}`;
}

export function ageLabel(seconds: number, t: TFunction = EN_T): string {
  if (seconds < 90) return t("common.sec", { n: Math.round(seconds) });
  const m = Math.round(seconds / 60);
  return m < 90 ? t("common.min", { n: m }) : t("common.hShort", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });
}

/** Where the projection counts from: live GPS, last completed stop (with GPS age), tour start. */
export function originLabel(p: TourProjection, t: TFunction = EN_T): string {
  if (p.origin === "completed") return t("common.originActual");
  if (p.origin === "gps") return t("common.originGps", { age: ageLabel(p.gpsAgeSeconds ?? 0, t) });
  const gps = p.gpsAgeSeconds !== null ? t("common.lastGpsAgo", { age: ageLabel(p.gpsAgeSeconds, t) }) : t("common.noGps");
  if (p.origin === "last_completed_stop") return t("common.originLastStop", { gps });
  return p.condition === "start_now" || p.condition === null ? t("common.originTourStart") : t("common.originTourStartGps", { gps });
}

/** The assumption behind a projection that is not happening right now. */
export function conditionLabel(p: TourProjection, t: TFunction = EN_T): string | null {
  if (p.condition === "resume_now") return t("common.conditionResume");
  if (p.condition === "start_now") return t("common.conditionStart");
  return null;
}

export function basisLabel(p: TourProjection, t: TFunction = EN_T): string {
  return p.source === "road" ? t("common.basisRoad") : t("common.basisEstimate", { reason: p.estimateReason ? estimateReason(p.estimateReason, t) : t("common.noRoadTimes") });
}

/**
 * A planned tour that is late to start has two finishes: the scheduled one (had it left at its
 * planned start) and the revised one (departing now). Null when there is only one.
 */
export function scheduledFinishLabel(p: TourProjection, t: TFunction = EN_T): string | null {
  return p.scheduledFinishMinute === null ? null : t("common.scheduledFinish", { time: `${p.complete ? "" : "≥ "}${formatClock(p.scheduledFinishMinute)}` });
}

/** One line under a finish/ETA figure: basis · origin · condition · scheduled finish · completeness. */
export function projectionNote(p: TourProjection, t: TFunction = EN_T): string {
  const parts = [basisLabel(p, t), originLabel(p, t)];
  const c = conditionLabel(p, t);
  if (c) parts.push(c);
  const sched = scheduledFinishLabel(p, t);
  if (sched) parts.push(sched);
  if (!p.complete) parts.push(t("common.incomplete", { count: p.unlocatedStopIds.length }));
  return parts.join(" · ");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Map tooltip of a stop: ETA and warning from the same projection as the stop row and list; location check and approach (P0-3.4). */
export function stopTooltipHtml(s: TourSummary, stop: Stop, index: number, location?: { label: string } | null, t: TFunction = EN_T): string {
  const eta = s.timeline.projections.get(stop.id);
  const warn = eta ? stopStateLabel(eta.state, s.timeline.projection.source, t) : null;
  const etaText =
    eta && Number.isFinite(eta.etaMinute) ? (s.timeline.projection.source === "estimate" ? t("common.etaEst", { time: formatClock(eta.etaMinute) }) : t("common.eta", { time: formatClock(eta.etaMinute) })) : "";
  return `<strong>${index}. ${esc(stop.recipientName ?? "")}</strong><br/>${esc(stop.address.street)} ${esc(stop.address.houseNumber ?? "")}<br/>${
    !isOpen(stop.status) ? esc(t(`common.stopStatus.${stop.status}`)) : etaText
  }${stop.timeWindow ? ` · ${esc(t("common.window", { range: `${formatClock(stop.timeWindow.start)}–${formatClock(stop.timeWindow.end)}` }))}` : ""}${warn ? `<br/>${esc(warn.label)}` : ""}${
    location && isOpen(stop.status) ? `<br/>${esc(location.label)}` : ""
  }${stop.approach && isOpen(stop.status) ? `<br/>${esc(t("common.approach", { road: stop.approach.roadName ?? t("common.approachSet") }))}` : ""}`;
}

export const minutes = (seconds: number, t: TFunction = EN_T) => durationText(Math.round(seconds / 60), t);
