"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Sets `data-inview="true"` on its wrapper once it enters the viewport.
 * Children animate with `group-data-[inview=true]:` utilities (CSS only).
 * Content is fully visible without JavaScript: the hidden start state is
 * only applied when `html.js` is present.
 */
export function InView({
  as: Tag = "div",
  className = "",
  children,
  threshold = 0.25,
  ...rest
}: {
  as?: "div" | "section" | "ol" | "ul" | "figure";
  className?: string;
  children: ReactNode;
  threshold?: number;
} & Partial<Record<`data-${string}` | "id" | "aria-labelledby", string>>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.inview = "true";
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} data-inview="false" className={`group/iv ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
