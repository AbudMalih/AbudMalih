import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { getDictionary, type Locale } from "@/content/i18n";

export const metadata: Metadata = { title: "Datenschutz", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  return (
    <PageShell locale={locale} index="§" eyebrow={d.pages.legalEyebrow} title="Datenschutz" lead={d.pages.legalNote || undefined}>
      <div lang="de" dir="ltr" style={{ textAlign: "start" }}>
        <p>Die Datenschutzerklärung wird vor Veröffentlichung der Website von der Luna Trading GmbH bereitgestellt.</p>
        <h2>Technischer Hinweis</h2>
        <p>
          Diese Website lädt Schriften, Texturen und Skripte ausschließlich vom eigenen Server. Es werden keine Tracking- oder
          Analysedienste eingesetzt. Für die Wiedergabe des Intros wird ein technischer Eintrag im Sitzungsspeicher
          (sessionStorage) verwendet. Wählen Sie ausdrücklich eine Sprache, wird diese Wahl in einem technisch notwendigen
          Cookie (luna-lang) gespeichert.
        </p>
      </div>
    </PageShell>
  );
}
