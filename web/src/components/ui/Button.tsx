import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "outline" | "outline-dark" | "text";

const base =
  "group relative inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden px-6 text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-colors duration-300";

const variants: Record<Variant, string> = {
  primary: "bg-red-cta text-white hover:bg-red-ink",
  outline: "border border-white/35 text-white hover:border-white",
  "outline-dark": "border border-ink/25 text-ink hover:border-ink",
  text: "min-h-0 px-0 text-current",
};

type Props = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  arrow?: boolean;
};

/** Link-button. The slash accent sweeps across on hover. */
export function ButtonLink({ href, children, variant = "primary", className = "", arrow = true }: Props) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {variant !== "text" && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 -translate-x-full skew-x-[-28deg] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-[520%] ${
            variant === "primary" ? "bg-white/15" : "bg-red/25"
          }`}
        />
      )}
      <span className="relative">{children}</span>
      {arrow && <Arrow className="relative size-4 transition-transform duration-300 group-hover:translate-x-1" />}
    </Link>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" focusable="false">
      <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
