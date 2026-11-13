import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./cn";

export const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-lg px-[9px] text-xs font-bold leading-4",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted",
        brand: "bg-brand-50 text-brand-700",
        info: "bg-info-soft text-info-ink",
        success: "bg-success-soft text-success-ink",
        warning: "bg-warning-soft text-warning-ink",
        danger: "bg-danger-soft text-danger-ink",
        outline: "border border-line bg-transparent text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const DOT: Record<NonNullable<VariantProps<typeof badgeVariants>["tone"]>, string> = {
  neutral: "bg-subtle",
  brand: "bg-brand-600",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  outline: "bg-subtle",
};

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ tone = "neutral", dot = false, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {dot && <span className={cn("size-2 rounded-full", DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
