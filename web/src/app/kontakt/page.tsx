import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Kontakt", robots: { index: false, follow: true }, alternates: { canonical: "/kontakt" } };

export default function Page() {
  return <PendingPage eyebrow="Kontakt" title="Kontakt" text="Getrennte Wege für Geschäftsanfragen, Bewerbungen und allgemeine Anliegen folgen in der nächsten Ausbaustufe." />;
}
