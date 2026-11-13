"use client";

import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-line-strong bg-raised p-1.5 text-[13px] font-semibold text-ink shadow-overlay",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, icon, hint, children, ...props }: ComponentProps<typeof DropdownMenu.Item> & { icon?: ReactNode; hint?: ReactNode }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "relative flex min-h-[38px] cursor-default select-none items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11.5px] font-medium text-muted">{hint}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem
      className={cn(
        "relative flex min-h-[38px] cursor-default select-none items-center gap-2.5 rounded-[10px] py-1.5 ps-8 pe-2.5 outline-none transition-colors data-[highlighted]:bg-surface-2",
        className,
      )}
      onSelect={(e) => e.preventDefault()}
      {...props}
    >
      <span className="absolute start-2 inline-flex size-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check className="size-3.5 text-brand-700" strokeWidth={2.5} />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted", className)} {...props} />;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn("mx-1 my-1.5 h-px bg-line", className)} />;
}
