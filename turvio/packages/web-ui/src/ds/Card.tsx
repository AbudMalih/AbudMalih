import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, interactive = false, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-2xl border border-line bg-surface shadow-card g:rounded-lg g:shadow-none",
        interactive && "transition-[box-shadow,border-color,transform] duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-overlay g:hover:translate-y-0 g:hover:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4 g:px-4 g:py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold">{title}</h2>
        {description && <p className="mt-px text-[12.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-bold uppercase tracking-[0.09em] text-muted g:text-[12px] g:font-medium g:normal-case g:tracking-normal g:text-ink-2", className)}>{children}</div>;
}
