import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { CHAIN } from "@/content/ecosystem";
import { getDictionary, isLocale, type Locale } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.whatWeDo } : {};
}

export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  const p = d.pages.whatWeDo;
  return (
    <PageShell locale={locale} index="01" eyebrow={p.eyebrow} title={<>{p.t1} <span className="tone-graphite">{p.t2}</span></>} lead={p.lead}>
      <ol>
        {CHAIN.map((id, i) => (
          <li key={id}>
            <h2>
              <span className="t-label t-mono tone-graphite">{String(i + 1).padStart(2, "0")}</span>&ensp;{d.chain.steps[id].label}
            </h2>
            <p>{d.chain.steps[id].line}</p>
          </li>
        ))}
      </ol>
      <h2>
        {d.commerce.h1} {d.commerce.h2}
      </h2>
      <p>{d.commerce.body}</p>
      <p>{d.commerce.destinations.join(" · ")}</p>
    </PageShell>
  );
}
