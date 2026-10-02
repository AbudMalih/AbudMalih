import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";

export const metadata: Metadata = { title: "Datenschutz", robots: { index: false } };

export default function Page() {
  return (
    <PageShell index="§" eyebrow="Legal" title="Datenschutz">
      <div lang="de">
        <p>Die Datenschutzerklärung wird vor Veröffentlichung der Website durch die Luna Trading GmbH bereitgestellt.</p>
        <h2>Technischer Hinweis</h2>
        <p>
          Diese Website lädt Schriften, Texturen und Skripte ausschließlich vom eigenen Server. Es werden keine Tracking- oder
          Analyse-Dienste eingesetzt und keine Cookies gesetzt. Für die Wiedergabe des Intros wird ein technischer Eintrag im
          Sitzungsspeicher (sessionStorage) des Browsers verwendet.
        </p>
      </div>
    </PageShell>
  );
}
