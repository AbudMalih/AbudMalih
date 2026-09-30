import type { Metadata } from "next";
import { LegalNotice } from "@/components/layout/LegalNotice";
import { PageHero } from "@/components/layout/PageHero";
import { ScrollSpyNav } from "@/components/layout/ScrollSpyNav";
import { privacyPolicy } from "@/content/legal";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMeta({ title: "Datenschutz", description: "Datenschutzerklärung der JARBOU Logistik GmbH.", path: "/datenschutz" }),
  robots: { index: privacyPolicy.approved, follow: true },
};

export default function PrivacyPage() {
  const sections = privacyPolicy.sections.filter((s) => s.body?.length);
  const updated = privacyPolicy.updated ? privacyPolicy.updated.split("-").reverse().join(".") : null;
  return (
    <>
      <PageHero eyebrow="Rechtliches" lines={["Datenschutz­erklärung"]} lead={updated ? `Stand: ${updated}` : undefined} />
      <section className="bg-paper py-20 text-ink lg:py-28">
        <div className="shell grid gap-14 lg:grid-cols-12">
          {sections.length > 0 && (
            <aside className="hidden lg:col-span-3 lg:block">
              <div className="sticky top-28">
                <p className="eyebrow mb-5 text-steel-600">Inhalt</p>
                <ScrollSpyNav label="Inhalt der Datenschutzerklärung" items={sections.map((s) => ({ id: s.id, label: s.title }))} />
              </div>
            </aside>
          )}
          <div className={sections.length ? "min-w-0 lg:col-span-8 lg:col-start-5" : "lg:col-span-8"}>
            {!privacyPolicy.approved && <LegalNotice />}
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-28 border-t border-ink/15 py-10 first:border-t-0">
                <h2 id={`${s.id}-t`} className="flex items-baseline gap-4 text-2xl font-extrabold uppercase tracking-[-0.02em]">
                  <span className="font-mono text-xs font-normal text-red-ink">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.body!.map((p, n) => (
                  <p key={n} className="mt-4 max-w-3xl leading-relaxed text-graphite-700">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
