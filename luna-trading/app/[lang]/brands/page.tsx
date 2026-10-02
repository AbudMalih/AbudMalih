import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { LuviscentLogo } from "@/components/brand/Logos";
import { BRANDS } from "@/content/site";
import { getDictionary, isLocale, type Locale } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.brands } : {};
}

export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  const p = d.pages.brands;
  const b = BRANDS.luviscent;
  return (
    <PageShell locale={locale} index="02" eyebrow={p.eyebrow} title={<>{p.t1} <span className="tone-graphite">{p.t2}</span></>} lead={p.lead}>
      <section
        id="luviscent"
        style={{
          padding: "clamp(32px,6vw,80px)",
          background: "radial-gradient(110% 80% at 22% 105%, #17372d, transparent 70%), linear-gradient(180deg,#091a15,#05110d)",
          maxWidth: 1100,
        }}
      >
        <p className="t-label" style={{ color: "var(--lv-champagne-soft)", marginBottom: 28 }}>
          {d.luviscent.owner} · {d.luviscent.category}
        </p>
        <LuviscentLogo width="min(640px, 100%)" />
        <p className="t-serif" lang="de" dir="ltr" style={{ fontStyle: "italic", fontSize: "clamp(1.6rem,3vw,2.6rem)", marginTop: 28, color: "var(--lv-ivory)", textAlign: "start" }}>
          {b.claim}
        </p>
      </section>
    </PageShell>
  );
}
