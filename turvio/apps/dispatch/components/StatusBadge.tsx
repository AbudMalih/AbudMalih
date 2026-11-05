import type { DispatchTourStatus, PickupState, StopStatus } from "@turvio/shared";
import { Badge, type BadgeTone } from "@turvio/web-ui/ds";

export const TOUR_STATUS: Record<DispatchTourStatus, { label: string; tone: BadgeTone }> = {
  in_progress: { label: "On route", tone: "brand" },
  delayed: { label: "Delayed", tone: "danger" },
  paused: { label: "Paused", tone: "warning" },
  planned: { label: "Planned", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
};

export const PICKUP_STATE: Record<PickupState, { label: string; tone: BadgeTone }> = {
  late: { label: "Will be late", tone: "danger" },
  at_risk: { label: "At risk", tone: "warning" },
  unassigned: { label: "Unassigned", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "brand" },
  completed: { label: "Picked up", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export const STOP_STATUS: Record<StopStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Open", tone: "neutral" },
  delivered: { label: "Delivered", tone: "success" },
  picked_up: { label: "Picked up", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "warning" },
};

export function TourStatusBadge({ status }: { status: DispatchTourStatus }) {
  const s = TOUR_STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function PickupStateBadge({ state }: { state: PickupState }) {
  const s = PICKUP_STATE[state];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
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
