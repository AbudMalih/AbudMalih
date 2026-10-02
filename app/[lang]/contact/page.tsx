import type { Metadata } from "next";
import PageShell, { InPreparation } from "@/components/ui/PageShell";
import { COMPANY } from "@/content/site";
import { getDictionary, isLocale, type Locale } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.contact } : {};
}

export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  const p = d.pages.contact;
  return (
    <PageShell
      locale={locale}
      index="04"
      eyebrow={p.eyebrow}
      title={
        <>
          {p.t1} <span className="tone-graphite">{p.t2}</span>
          <span className="tone-red">+</span>
        </>
      }
    >
      <p>
        {COMPANY.legalName}
        <br />
        {d.company.place}
      </p>
      {COMPANY.email ? (
        <p>
          <a className="link-line" href={`mailto:${COMPANY.email}`}>
            {COMPANY.email}
          </a>
        </p>
      ) : (
        <InPreparation label={d.pages.prep} items={[p.pending]} />
      )}
    </PageShell>
  );
}
