import type { Metadata } from "next";
import PageShell, { InPreparation } from "@/components/ui/PageShell";
import { getDictionary, isLocale, type Locale } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.company } : {};
}

export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  const p = d.pages.company;
  return (
    <PageShell locale={locale} index="03" eyebrow={p.eyebrow} title={<>{p.t1} <span className="tone-graphite">{p.t2}</span></>} lead={p.lead}>
      <InPreparation label={d.pages.prep} items={p.items} />
    </PageShell>
  );
}
