"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

/** The document's direction, following changes (an app may switch language at runtime). */
function useDocumentDir(): "ltr" | "rtl" {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDir(el.dir === "rtl" ? "rtl" : "ltr");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["dir"] });
    return () => mo.disconnect();
  }, []);
  return dir;
}

export function Toaster() {
  const dir = useDocumentDir();
  return (
    <Sonner
      // Bottom corner at the end of the reading direction (right in LTR, left in RTL).
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      dir={dir}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line-strong !bg-raised !text-ink !shadow-overlay !font-sans !font-semibold !text-[13px]",
          description: "!text-muted",
        },
      }}
    />
  );
}
