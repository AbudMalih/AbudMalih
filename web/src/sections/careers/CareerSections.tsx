import Image from "next/image";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { EmployeeStory, Faq, ProcessStep } from "@/content/types";
import { InView } from "@/motion/InView";

/** Recruitment journey – a route line with six stations. No response-time promises. */
export function ApplicationProcess({ steps }: { steps: ProcessStep[] }) {
  return (
    <InView as="ol" className="relative grid gap-0 md:grid-cols-3 lg:grid-cols-6" threshold={0.25}>
      <span aria-hidden="true" className="reveal-line absolute left-0 right-0 top-[7px] hidden h-0.5 bg-ink lg:block" />
      <span aria-hidden="true" className="reveal-y absolute bottom-0 left-[7px] top-0 w-0.5 bg-ink md:hidden" />
      {steps.map((s, i) => (
        <li key={s.id} className="reveal relative pb-10 pl-10 md:pl-0 md:pr-6 lg:pb-0" style={{ "--d": `${200 + i * 160}ms` } as React.CSSProperties}>
          <span
            aria-hidden="true"
            className={`absolute left-0 top-0 block size-4 border-2 border-ink [transform:skewX(-28deg)] ${i === steps.length - 1 ? "bg-red" : "bg-paper"}`}
          />
          <p className="font-mono text-xs text-steel-600 md:mt-10">{s.index}</p>
          <h3 className="mt-2 text-lg font-extrabold uppercase tracking-[-0.01em]">{s.title}</h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-graphite-600">{s.text}</p>
        </li>
      ))}
    </InView>
  );
}

/** Possible development path – explicitly not a promise. */
export function DevelopmentPath({ path, disclaimer }: { path: { id: string; title: string }[]; disclaimer: string }) {
  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <InView as="ol" className="lg:col-span-7" threshold={0.2}>
        {path.map((p, i) => (
          <li key={p.id} className="reveal" style={{ "--d": `${i * 140}ms`, paddingLeft: `calc(${i} * clamp(0.4rem, 2.5vw, 2.75rem))` } as React.CSSProperties}>
            <div className="flex items-center gap-5 border-t border-white/15 py-5">
              <span className="font-mono text-xs text-steel-500">0{i + 1}</span>
              <span className={`min-w-0 break-words text-[clamp(1.5rem,3.6vw,3rem)] font-extrabold uppercase leading-none tracking-[-0.03em] ${i === path.length - 1 ? "text-white" : "text-steel-300"}`}>
                {p.title}
              </span>
              {i < path.length - 1 && (
                <svg aria-hidden="true" viewBox="0 0 16 16" className="ml-auto size-4 -rotate-45 text-red">
                  <path d="M8 1v13M3 9l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              )}
            </div>
          </li>
        ))}
      </InView>
      <div className="self-end lg:col-span-4 lg:col-start-9">
        <p className="border-l-2 border-red pl-5 text-lg leading-relaxed text-steel-200">{disclaimer}</p>
      </div>
    </div>
  );
}

/** Employee stories – renders nothing until approved stories exist. */
export function EmployeeStories({ stories }: { stories: EmployeeStory[] }) {
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="stories-title" className="bg-ink py-24 lg:py-32">
      <div className="shell">
        <SectionLabel>Menschen bei JARBOU</SectionLabel>
        <h2 id="stories-title" className="h-section mt-6">
          Aus unseren Teams.
        </h2>
        <ul className="mt-14 grid gap-12 md:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id} className="border-t border-white/15 pt-8">
              {s.photo?.src && (
                <div className="relative mb-6 aspect-[4/3] overflow-hidden bg-graphite-800">
                  <Image src={s.photo.src} alt={s.photo.alt} fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
                </div>
              )}
              <blockquote className="text-xl leading-relaxed text-white">{s.story}</blockquote>
              <p className="mt-6 font-semibold text-white">{s.name}</p>
              <p className="text-sm text-steel-400">
                {s.role} · {s.location}
                {s.employedSince ? ` · ${s.employedSince}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Genuine, visible FAQs (also used for FAQPage structured data). */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="border-t border-ink">
      {faqs.map((f) => (
        <details key={f.id} className="group border-b border-ink/15">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
            {f.question}
            <span aria-hidden="true" className="relative size-4 shrink-0">
              <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-ink" />
              <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 bg-ink transition-transform duration-300 group-open:scale-y-0" />
            </span>
          </summary>
          <p className="max-w-3xl pb-6 leading-relaxed text-graphite-600">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
