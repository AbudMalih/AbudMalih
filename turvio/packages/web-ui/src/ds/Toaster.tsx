"use client";

import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-line !bg-surface !text-ink !shadow-overlay !font-sans",
          description: "!text-muted",
        },
      }}
    />
  );
}
