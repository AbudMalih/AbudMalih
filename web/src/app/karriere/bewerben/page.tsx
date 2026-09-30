import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { ApplicationExperience } from "@/components/forms/ApplicationExperience";
import { PageHero } from "@/components/layout/PageHero";
import { applicationSteps } from "@/content/careers";
import { getJob } from "@/content/jobs";
import { applicationOptions } from "@/lib/forms/options";

export const metadata: Metadata = pageMeta({
  title: "Jetzt bewerben",
  description: "Bewerben Sie sich bei JARBOU Logistik – Kurzbewerbung in rund zwei Minuten oder vollständige Bewerbung mit Unterlagen. Ohne Konto.",
  path: "/karriere/bewerben",
});

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ stelle?: string }> }) {
  const { stelle } = await searchParams;
  const job = stelle ? getJob(stelle) : undefined;
  const opts = applicationOptions();
  return (
    <>
      <PageHero eyebrow="Bewerbung" lines={["Jetzt bewerben."]} lead="Kurzbewerbung in rund zwei Minuten – oder vollständig mit Unterlagen. Kein Konto, keine Umwege." />
      <section aria-label="Bewerbungsformular" className="bg-paper py-16 text-ink lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <aside className="order-2 lg:order-1 lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow text-steel-600">So geht es weiter</p>
              <ol className="mt-5 border-t border-ink">
                {applicationSteps.map((s) => (
                  <li key={s.id} className="flex gap-4 border-b border-ink/10 py-3">
                    <span className="font-mono text-xs text-red-ink">{s.index}</span>
                    <span className="font-semibold">{s.title}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm text-steel-600">
                Keine passende Stelle?{" "}
                <Link href="/karriere/initiativbewerbung" className="font-semibold text-ink underline underline-offset-4">
                  Initiativ bewerben
                </Link>
              </p>
            </div>
          </aside>
          <div className="order-1 lg:order-2 lg:col-span-7 lg:col-start-6">
            <ApplicationExperience {...opts} defaultPosition={job?.slug} defaultLocation={job?.location} />
          </div>
        </div>
      </section>
    </>
  );
}
