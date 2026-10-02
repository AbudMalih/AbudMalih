"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "@/lib/motion/gsap";

/**
 * CTA with restrained magnetic response (desktop fine pointers only):
 * travels at most ~10px toward the pointer, springs back on leave.
 */
export default function MagneticLink({
  href,
  children,
  className,
  external,
  strength = 0.28,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      xTo(Math.max(-12, Math.min(12, dx * strength)));
      yTo(Math.max(-10, Math.min(10, dy * strength)));
    };
    const leave = () => {
      xTo(0);
      yTo(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);

  if (external)
    return (
      <a ref={ref} href={href} className={className} target="_blank" rel="noopener" data-cursor="link">
        {children}
      </a>
    );
  return (
    <Link ref={ref} href={href} className={className} data-cursor="link">
      {children}
    </Link>
  );
}
