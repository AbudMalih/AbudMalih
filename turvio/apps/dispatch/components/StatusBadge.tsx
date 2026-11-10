import type { DelayCertainty, DispatchTourStatus, PickupState, StopStatus } from "@turvio/shared";
import { Badge, type BadgeTone } from "@turvio/web-ui/ds";
import { delayLabel } from "../lib/eta";

export const TOUR_STATUS: Record<DispatchTourStatus, { label: string; tone: BadgeTone }> = {
  in_progress: { label: "On route", tone: "brand" },
  delayed: { label: "Delayed", tone: "danger" },
  paused: { label: "Paused", tone: "warning" },
  planned: { label: "Planned", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
};

export const PICKUP_STATE: Record<PickupState, { label: string; tone: BadgeTone }> = {
  missed: { label: "Window missed", tone: "danger" },
  late: { label: "Projected late", tone: "danger" },
  at_risk: { label: "Close to deadline", tone: "warning" },
  unassigned: { label: "Unassigned", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "brand" },
  completed: { label: "Picked up", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export const STOP_STATUS: Record<StopStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Open", tone: "neutral" },
  in_progress: { label: "Driver on site", tone: "brand" },
  delivered: { label: "Delivered", tone: "success" },
  picked_up: { label: "Picked up", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  attempted: { label: "Attempted", tone: "danger" },
  rescheduled: { label: "Rescheduled", tone: "warning" },
  returned: { label: "Returned", tone: "danger" },
  skipped: { label: "Skipped", tone: "warning" },
};

/** Labels for the default failure-reason codes (companies may define their own labels). */
export const FAILURE_REASON: Record<string, string> = {
  recipient_absent: "Recipient not at home",
  refused: "Refused by recipient",
  address_not_found: "Address not found",
  no_access: "No access",
  damaged: "Parcel damaged",
  business_closed: "Business closed",
  rescheduled_by_recipient: "Recipient asked for another day",
  other: "Other",
};

/** `certainty` tells a delay that already happened from a projected or estimated one. */
export function TourStatusBadge({ status, certainty = null }: { status: DispatchTourStatus; certainty?: DelayCertainty | null }) {
  const s = TOUR_STATUS[status];
  const label = status === "delayed" ? delayLabel(certainty) : s.label;
  const tone: BadgeTone = status === "delayed" && certainty === "estimated" ? "warning" : s.tone;
  return (
    <Badge tone={tone} dot data-testid="tour-status">
      {label}
    </Badge>
  );
}

export function PickupStateBadge({ state, estimated = false }: { state: PickupState; estimated?: boolean }) {
  const s = PICKUP_STATE[state];
  const est = estimated && (state === "late" || state === "at_risk");
  const label = est && state === "late" ? "Possibly late (estimate)" : est ? `${s.label} (estimate)` : s.label;
  return (
    <Badge tone={est && state === "late" ? "warning" : s.tone} dot>
      {label}
    </Badge>
  );
}

/** "in 1 h 05" / "12 min ago" relative to the synthetic clock. */
export function deadlineLabel(minutes: number | null): string {
  if (minutes === null) return "–";
  const abs = Math.abs(Math.round(minutes));
  const text = abs >= 60 ? `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, "0")}` : `${abs} min`;
  return minutes >= 0 ? `in ${text}` : `${text} ago`;
}
