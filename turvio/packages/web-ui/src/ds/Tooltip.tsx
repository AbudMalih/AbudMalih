"use client";

import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "top", disabled = false }: { content: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left"; disabled?: boolean }) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          className="z-50 max-w-60 rounded-[10px] border border-line-strong bg-raised px-2.5 py-[7px] text-xs font-medium leading-[1.4] text-ink shadow-overlay data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
