"use client";

import { Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-xs placeholder:text-subtle transition-[border-color,box-shadow] duration-[var(--duration-fast)] focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="ps-9 pe-8 [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute end-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
