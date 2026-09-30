"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ServiceIllustration } from "@/components/illustrations/ServiceIllustration";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { media } from "@/content/media";
import { services } from "@/content/services";

/**
 * Editorial service navigator: vertical tab list left, large visual right.
 * On small screens each service expands in place (accordion semantics via tabs).
 */
export function Services() {
  const [active, setActive] = useState(0);
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = services[active]!;
  const m = media[current.media];

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = services.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % n;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + n) % n;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      setActive(next);
      tabs.current[next]?.focus();
    }
  };

  return (
    <section id="leistungen" aria-labelledby="services-title" className="bg-paper py-24 text-ink lg:py-36 defer-render">
      <div className="shell">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel index="01" tone="dark">
              Leistungen
            </SectionLabel>
            <h2 id="services-title" className="display mt-6 text-[clamp(2.2rem,6vw,5.75rem)]">
              Ein Partner für den gesamten Ablauf.
            </h2>
          </div>
          <p className="max-w-md self-end text-lg leading-relaxed text-graphite-600 lg:col-span-4 lg:col-start-9">
            Von der Planung bis zur Qualitätskontrolle: Wir übernehmen die operative Verantwortung für Transport, Zustellung und Last Mile.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          {/* Mobile: accordion */}
          <div className="lg:hidden">
            {services.map((s, i) => {
              const open = i === active;
              return (
                <div key={s.id} className="border-t border-ink/15 last:border-b">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${base}-m-${i}`}
                      onClick={() => setActive(i)}
                      className="flex w-full items-baseline gap-5 py-5 text-left"
                    >
                      <span className={`font-mono text-xs ${open ? "text-red-ink" : "text-steel-600"}`}>{s.index}</span>
                      <span className={`flex-1 text-xl font-semibold tracking-[-0.015em] ${open ? "text-ink" : "text-graphite-600"}`}>{s.title}</span>
                      <span aria-hidden="true" className={`h-3 w-5 shrink-0 self-center bg-red [transform:skewX(-28deg)] ${open ? "" : "opacity-0"}`} />
                    </button>
                  </h3>
                  <div id={`${base}-m-${i}`} hidden={!open} className="pb-8">
                    <p className="leading-relaxed text-graphite-600">{s.lead}</p>
                    <div className="relative mt-5 aspect-[16/11] bg-steel-100 p-4">
                      <ServiceIllustration id={s.media} label={media[s.media].alt} />
                    </div>
                    <ul className="mt-4 space-y-2 text-sm">
                      {s.points.map((pt) => (
                        <li key={pt} className="flex gap-3">
                          <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 bg-red" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: vertical tabs */}
          <div role="tablist" aria-orientation="vertical" aria-label="Leistungen" className="hidden lg:col-span-5 lg:block">
            {services.map((s, i) => {
              const selected = i === active;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`${base}-tab-${i}`}
                  aria-selected={selected}
                  aria-controls={`${base}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  className="group flex w-full items-baseline gap-5 border-t border-ink/15 py-6 text-left last:border-b"
                >
                  <span className={`font-mono text-xs transition-colors ${selected ? "text-red-ink" : "text-steel-600"}`}>{s.index}</span>
                  <span
                    className={`flex-1 text-2xl font-semibold tracking-[-0.015em] transition-colors ${
                      selected ? "text-ink" : "text-graphite-600 group-hover:text-ink"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-3 w-5 shrink-0 self-center bg-red transition-transform duration-500 ease-[var(--ease-out-expo)] [transform:skewX(-28deg)_scaleX(var(--sx))] ${
                      selected ? "[--sx:1]" : "[--sx:0] group-hover:[--sx:0.5]"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${base}-panel`}
            aria-labelledby={`${base}-tab-${active}`}
            className="hidden lg:col-span-7 lg:block"
          >
            <div key={current.id} className="grid gap-8 [animation:fade-up_0.6s_var(--ease-out-expo)_both] md:grid-cols-7">
              <figure className="relative aspect-[16/11] overflow-hidden bg-steel-100 md:col-span-7">
                {m.src ? (
                  <Image src={m.src} alt={m.alt} fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
                ) : (
                  <div className="absolute inset-0 p-6 sm:p-10">
                    <ServiceIllustration id={current.media} label={m.alt} />
                  </div>
                )}
                <figcaption className="absolute left-0 top-0 bg-ink px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white">
                  {current.index} — {current.title}
                </figcaption>
              </figure>
              <p className="hidden text-2xl font-semibold leading-snug tracking-[-0.015em] md:col-span-4 lg:block">{current.lead}</p>
              <ul className="space-y-3 text-sm md:col-span-7 lg:col-span-3">
                {current.points.map((pt) => (
                  <li key={pt} className="flex gap-3 border-b border-ink/10 pb-3">
                    <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 bg-red" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <ButtonLink href="/leistungen" variant="outline-dark">
            Alle Leistungen
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
