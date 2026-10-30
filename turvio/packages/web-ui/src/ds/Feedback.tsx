import type { ReactNode } from "react";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden="true" />;
}

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface shadow-xs text-muted [&_svg]:size-5">{icon}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Labels content that is not real production data. */
export function DemoDataTag({ className, children = "Synthetic demo data" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-warning-soft px-2 py-0.5 text-2xs font-medium text-warning-ink", className)}>
      {children}
    </span>
  );
}
