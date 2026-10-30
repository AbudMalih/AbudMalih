import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-2",
        brand: "border-brand-200 bg-brand-50 text-brand-700",
        success: "border-emerald-200 bg-success-soft text-success-ink",
        warning: "border-amber-200 bg-warning-soft text-warning-ink",
        danger: "border-red-200 bg-danger-soft text-danger-ink",
        outline: "border-line bg-surface text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const DOT: Record<NonNullable<VariantProps<typeof badgeVariants>["tone"]>, string> = {
  neutral: "bg-subtle",
  brand: "bg-brand-600",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  outline: "bg-subtle",
};

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ tone = "neutral", dot = false, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
