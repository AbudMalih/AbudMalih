"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Mobile-only sticky "Jetzt bewerben" bar. Hides while the application form
 * (`hideWhenVisible`) or the footer is on screen.
 */
export function StickyApply({ href, label = "Jetzt bewerben", hideWhenVisible }: { href: string; label?: string; hideWhenVisible?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const targets = [hideWhenVisible ? document.getElementById(hideWhenVisible) : null, document.querySelector("footer")].filter(Boolean) as Element[];
    const seen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      setHidden(seen.size > 0);
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [hideWhenVisible]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 p-3 backdrop-blur-sm transition-transform duration-300 md:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link href={href} tabIndex={hidden ? -1 : undefined} className="flex min-h-14 items-center justify-center bg-red-cta text-sm font-semibold uppercase tracking-[0.12em] text-white">
        {label}
      </Link>
    </div>
  );
}
