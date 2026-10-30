import { cn } from "./cn";

/**
 * TURVIO mark: a route that leaves a depot (ring), bends once and arrives at a
 * stop (dot) – drawn on a deep-navy tile. Original artwork.
 */
export function TurvioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0F172A" />
      <path d="M9.5 21.5V15a4 4 0 0 1 4-4h5a4 4 0 0 0 4-4" fill="none" stroke="#3B82F6" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9.5" cy="22.5" r="2.6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="22.5" cy="9" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}

export function Wordmark({ product, collapsed = false, className }: { product?: string; collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <TurvioMark />
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <div className="text-[15px] font-semibold tracking-[0.14em] text-ink">TURVIO</div>
          {product && <div className="mt-1 truncate text-2xs font-medium uppercase tracking-[0.12em] text-muted">{product}</div>}
        </div>
      )}
    </div>
  );
}
