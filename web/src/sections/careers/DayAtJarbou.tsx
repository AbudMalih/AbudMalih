"use client";

import { useEffect, useRef, useState } from "react";
import type { ProcessStep } from "@/content/types";

/**
 * "Ein Tag bei JARBOU" – quiet scroll storytelling. A sticky counter and a
 * route line follow the reader through the eight stations of a working day.
 * No pinning or scroll hijacking; fully readable without JS.
 */
export function DayAtJarbou({ steps }: { steps: ProcessStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = steps[active]!;
  const progress = (active + 1) / steps.length;

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-32">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-steel-400">
            Station <span className="text-white">{current.index}</span> / {String(steps.length).padStart(2, "0")}
          </p>
          <p key={current.id} className="display mt-4 text-[clamp(2.5rem,4.6vw,4.5rem)] text-white [animation:rise_0.5s_var(--ease-out-expo)_both]" aria-hidden="true">
            {current.title}
          </p>
          <div className="mt-8 h-0.5 w-full bg-white/15">
            <div className="h-full origin-left bg-red transition-transform duration-500" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[0.65rem] uppercase tracking-[0.14em] text-steel-500">
            <span>Tourbeginn</span>
            <span>Tagesabschluss</span>
          </div>
        </div>
      </div>

      <ol className="relative lg:col-span-7">
        <span aria-hidden="true" className="absolute bottom-6 left-[7px] top-6 w-px bg-white/15" />
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-6 w-px origin-top bg-red transition-transform duration-500"
          style={{ height: "calc(100% - 3rem)", transform: `scaleY(${progress})` }}
        />
        {steps.map((s, i) => (
          <li
            key={s.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className="relative py-8 pl-12 lg:py-14"
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 top-10 block size-[15px] border transition-colors duration-300 [transform:skewX(-28deg)] lg:top-16 ${
                i <= active ? "border-red bg-red" : "border-white/50 bg-ink"
              }`}
            />
            <p className="font-mono text-xs text-steel-500">{s.index}</p>
            <h3 className={`mt-2 text-2xl font-extrabold uppercase tracking-[-0.02em] transition-colors sm:text-3xl ${i === active ? "text-white" : "text-steel-400"}`}>
              {s.title}
            </h3>
            <p className="mt-3 max-w-md leading-relaxed text-steel-300">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
