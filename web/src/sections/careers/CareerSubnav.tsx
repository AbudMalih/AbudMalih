"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/** Sticky in-page navigation for /karriere. Scrolls horizontally on phones. */
export function CareerSubnav({ items, applyHref }: { items: readonly Item[]; applyHref: string }) {
  const [active, setActive] = useState<string | null>(null);
  // Position-based scroll spy: the last section whose top passed 40 % of the viewport.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const i of items) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= line) current = i.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return (
    <nav aria-label="Karriere" className="sticky top-0 z-40 border-y border-white/10 bg-ink/95 backdrop-blur-sm">
      <div className="shell flex items-center gap-2">
        <ul className="-mx-2 flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((i) => (
            <li key={i.id} className="shrink-0">
              <a
                href={`#${i.id}`}
                aria-current={active === i.id ? "true" : undefined}
                className="relative flex min-h-14 items-center px-3 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-steel-300 transition-colors hover:text-white aria-[current=true]:text-white"
              >
                {i.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-0.5 origin-left bg-red transition-transform duration-300 ${active === i.id ? "scale-x-100" : "scale-x-0"}`}
                />
              </a>
            </li>
          ))}
        </ul>
        <Link
          href={applyHref}
          className="hidden min-h-11 shrink-0 items-center bg-red-cta px-5 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-white hover:bg-red-ink md:inline-flex"
        >
          Jetzt bewerben
        </Link>
      </div>
    </nav>
  );
}
