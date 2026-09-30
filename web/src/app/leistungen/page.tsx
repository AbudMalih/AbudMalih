import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Image from "next/image";
import { ServiceIllustration } from "@/components/illustrations/ServiceIllustration";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollSpyNav } from "@/components/layout/ScrollSpyNav";
import { ButtonLink } from "@/components/ui/Button";
import { media } from "@/content/media";
import { serviceDetails, services } from "@/content/services";
import { InView } from "@/motion/InView";
import { OperatingModel } from "@/sections/home/OperatingModel";

export const metadata: Metadata = pageMeta({
  title: "Leistungen",
  description: "Disposition, Routen- und Tourenmanagement, Zustellung und Abholung, Qualitätsmanagement, Fuhrparkmanagement und operative Umsetzung – aus einer Hand.",
  path: "/leistungen",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Leistungen"
        lines={["Ein Partner für", "den gesamten Ablauf."]}
        lead="Von der Planung bis zur Qualitätskontrolle übernehmen wir die operative Verantwortung für Transport, Zustellung und Last Mile – mit eigenen Teams und eigenen Fahrzeugen."
      >
        <ButtonLink href="/business">Logistik anfragen</ButtonLink>
      </PageHero>

      <section aria-label="Leistungen im Detail" className="bg-paper text-ink">
        <div className="shell grid gap-10 py-20 lg:grid-cols-12 lg:py-28">
          <aside className="hidden min-w-0 lg:col-span-3 lg:block">
            <div className="sticky top-28">
              <p className="eyebrow mb-5 text-steel-600">Übersicht</p>
              <ScrollSpyNav label="Leistungen" items={services.map((s) => ({ id: s.id, label: s.title, index: s.index }))} />
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-9">
            {services.map((s, i) => {
              const d = serviceDetails[s.id]!;
              const m = media[s.media];
              return (
                <InView
                  as="section"
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-title`}
                  className="scroll-mt-24 border-t border-ink/15 py-16 first:border-t-0 first:pt-0 lg:py-24"
                >
                  <p className="reveal font-mono text-xs text-red-ink">{s.index} / 06</p>
                  <h2 id={`${s.id}-title`} className="reveal h-section mt-4 break-words [hyphens:auto]" style={{ "--d": "80ms" } as React.CSSProperties}>
                    {s.title}
                  </h2>
                  <div className="mt-10 grid gap-10 xl:grid-cols-9">
                    <div className={`min-w-0 xl:col-span-4 ${i % 2 ? "xl:order-2" : ""}`}>
                      <p className="reveal text-lg leading-relaxed text-graphite-600" style={{ "--d": "160ms" } as React.CSSProperties}>
                        {d.intro}
                      </p>
                      <ul className="mt-8 border-t border-ink">
                        {d.tasks.map((t, j) => (
                          <li key={t} className="reveal flex gap-4 border-b border-ink/10 py-4" style={{ "--d": `${220 + j * 70}ms` } as React.CSSProperties}>
                            <span className="font-mono text-xs text-steel-600">{String(j + 1).padStart(2, "0")}</span>
                            <span className="font-medium">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`min-w-0 xl:col-span-5 ${i % 2 ? "xl:order-1" : ""}`}>
                      <figure className="reveal relative aspect-[16/12] overflow-hidden bg-steel-100" style={{ "--d": "120ms" } as React.CSSProperties}>
                        {m.src ? (
                          <Image src={m.src} alt={m.alt} fill sizes="(min-width: 1280px) 40vw, 100vw" className="object-cover" />
                        ) : (
                          <div className="absolute inset-0 p-6 sm:p-10">
                            <ServiceIllustration id={s.media} label={m.alt} />
                          </div>
                        )}
                        <figcaption className="absolute left-0 top-0 bg-ink px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white">
                          {s.index} — {s.title}
                        </figcaption>
                      </figure>
                      <p className="reveal mt-6 border-l-2 border-red pl-5 text-xl font-semibold leading-snug tracking-[-0.01em]" style={{ "--d": "300ms" } as React.CSSProperties}>
                        {d.result}
                      </p>
                    </div>
                  </div>
                </InView>
              );
            })}
          </div>
        </div>
      </section>

      <OperatingModel />

      <section className="bg-graphite-900 py-20">
        <div className="shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="h-section max-w-2xl">Sie planen ein Transport-, Express- oder Last-Mile-Projekt?</p>
          <ButtonLink href="/business">Projekt anfragen</ButtonLink>
        </div>
      </section>
    </>
  );
}
