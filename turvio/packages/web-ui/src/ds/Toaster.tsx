"use client";

import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line-strong !bg-raised !text-ink !shadow-overlay !font-sans !font-semibold !text-[13px]",
          description: "!text-muted",
        },
      }}
    />
  );
}
