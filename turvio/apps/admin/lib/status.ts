import type { StatusFilter } from "./companyTable";

/** NEXT tag colours for company status (prototype .tag: t-ok, t-info, t-warn, t-bad, t-mute). */
/** `dot`: Phase G shows status as a dot + neutral text (red/amber text only where action is needed). */
export const STATUS: Record<StatusFilter, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-nx-mint-soft text-nx-mint g:text-ink-2", dot: "bg-success" },
  trialing: { label: "Trial", cls: "bg-nx-cobalt-soft text-nx-cobalt-text g:text-ink-2", dot: "bg-info" },
  past_due: { label: "Past due", cls: "bg-nx-amber-soft text-nx-amber g:text-warning-ink", dot: "bg-warning" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-muted", dot: "bg-subtle" },
  incomplete: { label: "Incomplete", cls: "bg-nx-amber-soft text-nx-amber g:text-warning-ink", dot: "bg-warning" },
  suspended: { label: "Suspended", cls: "bg-nx-coral-soft text-nx-coral g:text-danger-ink", dot: "bg-danger" },
};

