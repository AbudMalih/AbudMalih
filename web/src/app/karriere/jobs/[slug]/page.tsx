import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationExperience } from "@/components/forms/ApplicationExperience";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { formatStartDate, getJob, getPublishedJobs } from "@/content/jobs";
import { applicationOptions } from "@/lib/forms/options";
import { jobPostingJsonLd, jsonLdScript } from "@/lib/structured-data";
import { StickyApply } from "@/sections/careers/StickyApply";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPublishedJobs().map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const job = getJob((await params).slug);
  if (!job) return {};
  const title = `${job.title} in ${job.location}`;
  return pageMeta({
    title,
    description: `${job.summary} ${job.employmentType}, Start: ${formatStartDate(job.startDate)}. Jetzt in rund zwei Minuten bewerben.`,
    path: `/karriere/jobs/${job.slug}`,
  });
}

export default async function JobPage({ params }: Params) {
  const job = getJob((await params).slug);
  if (!job) notFound();
  const opts = applicationOptions();
  const facts = [
    ["Standort", job.location],
    ["Anstellung", job.employmentType],
    ["Start", formatStartDate(job.startDate)],
    ["Bereich", job.department],
  ] as const;
  const blocks = [
    { id: "aufgaben", title: "Ihre Aufgaben", items: job.responsibilities },
    { id: "anforderungen", title: "Das bringen Sie mit", items: job.requirements },
    { id: "vorteil", title: "Von Vorteil", items: job.niceToHave },
    { id: "angebot", title: "Das bieten wir", items: job.benefits },
  ].filter((b) => b.items.length > 0);

  return (
    <>
      <section className="bg-ink pb-16 pt-32 lg:pb-20 lg:pt-40">
        <div className="shell">
          <nav aria-label="Brotkrumen" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-steel-400">
            <Link href="/karriere" className="hover:text-white">
              Karriere
            </Link>
            <span className="mx-2 text-red">/</span>
            <Link href="/karriere#jobs" className="hover:text-white">
              Jobs
            </Link>
          </nav>
          <h1 className="display mt-6 max-w-5xl text-[clamp(2.3rem,5.6vw,5.25rem)] text-white [animation:rise_0.8s_var(--ease-out-expo)_both]">{job.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-steel-300">{job.description}</p>
          <dl className="mt-10 grid grid-cols-2 border-t border-white/15 md:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k} className="border-b border-white/10 py-5 pr-4">
                <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-400">{k}</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#bewerben">Jetzt bewerben</ButtonLink>
            <ButtonLink href="/karriere#jobs" variant="outline" arrow={false}>
              Alle Stellen
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-label="Stellenbeschreibung" className="bg-paper py-20 text-ink lg:py-28">
        <div className="shell grid gap-14 lg:grid-cols-12">
          <div className="space-y-16 lg:col-span-8">
            {blocks.map((b, i) => (
              <div key={b.id}>
                <h2 className="flex items-baseline gap-4 text-2xl font-extrabold uppercase tracking-[-0.02em] sm:text-3xl">
                  <span className="font-mono text-xs font-normal text-red-ink">0{i + 1}</span>
                  {b.title}
                </h2>
                <ul className="mt-6 border-t border-ink">
                  {b.items.map((item) => (
                    <li key={item} className="flex gap-4 border-b border-ink/10 py-4 text-lg leading-snug">
                      <span aria-hidden="true" className="mt-[0.55em] h-2 w-3 shrink-0 bg-red [transform:skewX(-28deg)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!job.salary && (
              <p className="text-sm text-steel-600">Details zur Vergütung besprechen wir persönlich im Bewerbungsgespräch.</p>
            )}
          </div>
          <aside className="lg:col-span-4">
            <div className="sticky top-28 bg-ink p-8 text-white">
              <p className="eyebrow text-steel-400">Kurzbewerbung</p>
              <p className="mt-3 text-2xl font-extrabold uppercase leading-tight tracking-[-0.02em]">In rund 2 Minuten bewerben.</p>
              <p className="mt-3 text-sm leading-relaxed text-steel-300">Ohne Konto. Lebenslauf optional – auch als Foto vom Smartphone.</p>
              <Link
                href="#bewerben"
                className="mt-6 flex min-h-14 items-center justify-center bg-red-cta text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-red-ink"
              >
                Jetzt bewerben
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="bewerben" aria-labelledby="apply-title" className="scroll-mt-16 border-t border-ink/10 bg-paper pb-24 text-ink lg:pb-32">
        <div className="shell grid gap-12 pt-20 lg:grid-cols-12 lg:pt-28">
          <div className="lg:col-span-4">
            <SectionLabel tone="dark">Bewerbung</SectionLabel>
            <h2 id="apply-title" className="h-section mt-6">
              Jetzt bewerben.
            </h2>
            <p className="mt-6 text-graphite-600">
              {job.title} · {job.location}
            </p>
            <p className="mt-6 text-sm text-steel-600">
              Lieber per E-Mail?{" "}
              <a href={`mailto:${opts.careersEmail}?subject=${encodeURIComponent(`Bewerbung: ${job.title}`)}`} className="font-semibold text-ink underline underline-offset-4">
                {opts.careersEmail}
              </a>
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ApplicationExperience {...opts} defaultPosition={job.slug} defaultLocation={job.location} />
          </div>
        </div>
      </section>

      <StickyApply href="#bewerben" hideWhenVisible="bewerben" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jobPostingJsonLd(job)) }} />
    </>
  );
}
