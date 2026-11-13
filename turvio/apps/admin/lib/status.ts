import type { StatusFilter } from "./companyTable";

/** NEXT tag colours for company status (prototype .tag: t-ok, t-info, t-warn, t-bad, t-mute). */
export const STATUS: Record<StatusFilter, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-nx-mint-soft text-nx-mint" },
  trialing: { label: "Trial", cls: "bg-nx-cobalt-soft text-nx-cobalt-text" },
  past_due: { label: "Past due", cls: "bg-nx-amber-soft text-nx-amber" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-muted" },
  incomplete: { label: "Incomplete", cls: "bg-nx-amber-soft text-nx-amber" },
  suspended: { label: "Suspended", cls: "bg-nx-coral-soft text-nx-coral" },
};

