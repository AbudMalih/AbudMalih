import type { BadgeTone } from "@turvio/web-ui/ds";
import type { StatusFilter } from "./companyTable";
import type { OrgStatus } from "./remote";

/** NEXT tag colours for company status (prototype .tag: t-ok, t-info, t-warn, t-bad, t-mute). */
/** `dot`: Phase G shows status as a dot + neutral text (red/amber text only where action is needed). Labels: common.status.* */
export const STATUS: Record<StatusFilter, { cls: string; dot: string; tone: BadgeTone }> = {
  active: { cls: "bg-nx-mint-soft text-nx-mint g:text-ink-2", dot: "bg-success", tone: "success" },
  trialing: { cls: "bg-nx-cobalt-soft text-nx-cobalt-text g:text-ink-2", dot: "bg-info", tone: "brand" },
  past_due: { cls: "bg-nx-amber-soft text-nx-amber g:text-warning-ink", dot: "bg-warning", tone: "warning" },
  cancelled: { cls: "bg-surface-2 text-muted", dot: "bg-subtle", tone: "neutral" },
  incomplete: { cls: "bg-nx-amber-soft text-nx-amber g:text-warning-ink", dot: "bg-warning", tone: "warning" },
  suspended: { cls: "bg-nx-coral-soft text-nx-coral g:text-danger-ink", dot: "bg-danger", tone: "danger" },
};

/** Company (organization) states a platform admin can filter by and set. */
export const ORG_STATUSES: OrgStatus[] = ["trialing", "active", "past_due", "suspended", "cancelled"];
