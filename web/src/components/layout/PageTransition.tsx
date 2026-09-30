"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Route-change accent: the two red slashes cross the viewport once (≈450 ms).
 * Purely decorative – it never blocks navigation or hides content.
 */
export function PageTransition() {
  const pathname = usePathname();
  const [prev, setPrev] = useState(pathname);
  const [key, setKey] = useState(0);

  // Route changes only happen client-side, so `window` is available here.
  if (prev !== pathname) {
    setPrev(pathname);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setKey((k) => k + 1);
  }

  if (key === 0) return null;
  return (
    <div key={key} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <span className="absolute -top-[10%] left-0 h-[120%] w-[9vw] bg-red [animation:transition-cross_460ms_var(--ease-in-out-quart)_forwards]" style={{ transform: "translate3d(-60vw,0,0)" }} />
      <span className="absolute -top-[10%] left-[7vw] h-[120%] w-[9vw] bg-red [animation:transition-cross_460ms_var(--ease-in-out-quart)_60ms_forwards]" style={{ transform: "translate3d(-60vw,0,0)" }} />
    </div>
  );
}
