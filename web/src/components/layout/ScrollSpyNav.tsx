"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string; index?: string };

/** Vertical in-page index that highlights the section in view. */
export function ScrollSpyNav({ items, label, tone = "dark" }: { items: Item[]; label: string; tone?: "dark" | "light" }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [items]);

  const base = tone === "dark" ? "text-graphite-600 hover:text-ink" : "text-steel-400 hover:text-white";
  const on = tone === "dark" ? "text-ink" : "text-white";
  return (
    <nav aria-label={label}>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "true" : undefined}
              className={`group flex items-center gap-3 py-2 text-sm font-medium transition-colors ${active === i.id ? on : base}`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-4 shrink-0 bg-red transition-transform duration-500 ease-[var(--ease-out-expo)] [transform:skewX(-28deg)_scaleX(var(--sx))] ${
                  active === i.id ? "[--sx:1]" : "[--sx:0]"
                }`}
              />
              {i.index && <span className="font-mono text-[0.7rem] text-steel-600">{i.index}</span>}
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
