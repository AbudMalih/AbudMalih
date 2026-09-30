import type { Metadata } from "next";
import { LegalNotice } from "@/components/layout/LegalNotice";
import { PageHero } from "@/components/layout/PageHero";
import { imprint } from "@/content/legal";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMeta({ title: "Impressum", description: "Impressum der JARBOU Logistik GmbH.", path: "/impressum" }),
  // Indexed only once the final, approved Impressum is in place.
  robots: { index: imprint.approved, follow: true },
};

export default function ImprintPage() {
  const i = imprint;
  const rows: [string, React.ReactNode][] = (
    [
      ["Anbieter", <>
        {i.company}
        {i.address && (
          <>
            <br />
            {i.address.street}
            <br />
            {i.address.zip} {i.address.city}
          </>
        )}
      </>],
      ["Vertreten durch", i.managingDirectors.length ? i.managingDirectors.join(", ") : null],
      ["Telefon", i.phone],
      ["E-Mail", i.email ? <a href={`mailto:${i.email}`} className="underline underline-offset-4">{i.email}</a> : null],
      ["Registereintrag", i.register ? `${i.register.court}, ${i.register.number}` : null],
      ["Umsatzsteuer-ID", i.vatId],
      ["Verantwortlich für den Inhalt", i.contentResponsible ? `${i.contentResponsible.name}, ${i.contentResponsible.address}` : null],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => v);

  return (
    <>
      <PageHero eyebrow="Rechtliches" lines={["Impressum"]} />
      <section className="bg-paper py-20 text-ink lg:py-28">
        <div className="shell grid gap-14 lg:grid-cols-12">
          <dl className="border-t border-ink lg:col-span-7">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-2 border-b border-ink/15 py-5 sm:grid-cols-[14rem_1fr]">
                <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-steel-600">{k}</dt>
                <dd className="text-lg leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:col-span-5">
            {!i.approved && <LegalNotice />}
            {i.sections
              .filter((s) => s.body?.length)
              .map((s) => (
                <div key={s.id} className="mb-10">
                  <h2 className="text-xl font-bold uppercase tracking-[-0.01em]">{s.title}</h2>
                  {s.body!.map((p, n) => (
                    <p key={n} className="mt-3 leading-relaxed text-graphite-700">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
