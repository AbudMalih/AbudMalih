"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "./cn";

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      aria-label={label}
      className={cn(
        "peer inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border border-line-3 bg-surface transition-colors duration-[var(--duration-fast)] hover:border-brand-500 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:bg-brand-600",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="text-on-accent">
        {checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
