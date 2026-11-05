import type { Stop, StopStatus } from "./schemas";

/** Statuses in which the stop still has to be served. */
export const OPEN_STATUSES = ["pending", "in_progress"] as const satisfies readonly StopStatus[];
/** Successful outcomes. */
export const SUCCESS_STATUSES = ["delivered", "picked_up"] as const satisfies readonly StopStatus[];
/** "Not delivered" outcomes – they require a failure reason. */
export const NOT_DELIVERED_STATUSES = ["failed", "attempted", "rescheduled", "returned"] as const satisfies readonly StopStatus[];

export const isOpen = (s: StopStatus) => s === "pending" || s === "in_progress";
export const isSuccess = (s: StopStatus) => s === "delivered" || s === "picked_up";
export const isNotDelivered = (s: StopStatus) => (NOT_DELIVERED_STATUSES as readonly StopStatus[]).includes(s);
export const isClosed = (s: StopStatus) => !isOpen(s);

export const openStops = <T extends Pick<Stop, "status">>(stops: T[]) => stops.filter((s) => isOpen(s.status));

/** Allowed transitions. Closed stops can only be reopened (back to pending). Mirrors public.driver_set_stop_status. */
export function canTransition(from: StopStatus, to: StopStatus): boolean {
  if (from === to) return false;
  if (isOpen(from)) return true;
  return to === "pending";
}

/** Default failure reasons (codes are stable; labels come from i18n `reason.<code>`). Organizations can configure their own list. */
export const DEFAULT_FAILURE_REASONS = [
  "recipient_absent",
  "refused",
  "address_not_found",
  "no_access",
  "damaged",
  "business_closed",
  "rescheduled_by_recipient",
  "other",
] as const;

export interface FailureReason {
  code: string;
  /** Optional custom label (organization-defined reasons); falls back to i18n. */
  label?: string;
  /** Which outcomes this reason may be used with. Default: all not-delivered statuses. */
  statuses?: StopStatus[];
  /** Driver must add a note. */
  requiresNote?: boolean;
}

export function defaultFailureReasons(): FailureReason[] {
  return DEFAULT_FAILURE_REASONS.map((code) => ({ code, requiresNote: code === "other" }));
}

/** Validate an outcome before it is recorded (client and API use the same rule). */
export function validateOutcome(
  input: { status: StopStatus; failureReason?: string | null; notes?: string | null },
  reasons: FailureReason[] = defaultFailureReasons(),
): string | null {
  if (!isNotDelivered(input.status)) return null;
  if (!input.failureReason) return "failure_reason_required";
  const reason = reasons.find((r) => r.code === input.failureReason);
  if (!reason) return "unknown_failure_reason";
  if (reason.statuses && !reason.statuses.includes(input.status)) return "reason_not_allowed";
  if (reason.requiresNote && !input.notes?.trim()) return "note_required";
  return null;
}
