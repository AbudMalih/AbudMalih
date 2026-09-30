import Link from "next/link";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { whyJarbou } from "@/content/careers";
import { formatStartDate, getPublishedJobs } from "@/content/jobs";

const REASONS = whyJarbou.filter((w) => ["onboarding", "fleet", "teams", "perspective"].includes(w.id));

export function CareersTeaser() {
  const jobs = getPublishedJobs().filter((j) => j.featured);
  return (
    <section aria-labelledby="careers-title" className="relative overflow-hidden bg-white py-24 text-ink lg:py-36 defer-render">
      <div className="shell">
        <SectionLabel index="05" tone="dark">
          Karriere
        </SectionLabel>
        <div className="mt-6 grid gap-10 lg:grid-cols-12">
          <h2 id="careers-title" className="display text-[clamp(2.75rem,7.5vw,7.5rem)] lg:col-span-9">
            Deine Leistung <span className="text-red">bewegt</span> uns.
          </h2>
        </div>

        <div className="mt-16 grid gap-14 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <h3 className="eyebrow text-graphite-600">Warum JARBOU?</h3>
            <dl className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
              {REASONS.map((r) => (
                <div key={r.title} className="border-l-2 border-red pl-5">
                  <dt className="text-lg font-semibold">{r.title}</dt>
                  <dd className="mt-1 leading-relaxed text-graphite-600">{r.text}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-7">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="eyebrow text-graphite-600">Aktuelle Stellen</h3>
              <span className="font-mono text-xs text-steel-600">{jobs.length} offen</span>
            </div>
            <ul className="mt-6 border-t border-ink">
              {jobs.map((job) => (
                <li key={job.slug} className="border-b border-ink/15">
                  <Link href={`/karriere/jobs/${job.slug}`} className="group grid gap-3 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
                    <span>
                      <span className="block text-xl font-bold tracking-[-0.015em] sm:text-2xl">{job.title}</span>
                      <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-graphite-600">
                        <span>{job.location}</span>
                        <span>{job.employmentType}</span>
                        <span>Start: {formatStartDate(job.startDate)}</span>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-red-ink">
                      Details
                      <Arrow className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/karriere/bewerben">Jetzt bewerben</ButtonLink>
              <ButtonLink href="/karriere" variant="outline-dark">
                Karriere bei JARBOU
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
