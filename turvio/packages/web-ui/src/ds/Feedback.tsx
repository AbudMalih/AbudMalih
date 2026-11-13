import type { ReactNode } from "react";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden="true" />;
}

export function EmptyState({ icon, title, description, action, className }: { icon: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 inline-flex size-[72px] items-center justify-center rounded-[22px] border border-line bg-[radial-gradient(circle_at_30%_20%,var(--violet-soft),transparent_70%),var(--surface-2)] text-nx-violet-text [&_svg]:size-7">{icon}</div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Labels content that is not real production data. */
export function DemoDataTag({ className, children = "Synthetic demo data" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-soft px-2.5 text-[11.5px] font-bold text-warning-ink", className)}>
      {children}
    </span>
  );
}
