import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Unternehmen", robots: { index: false, follow: true }, alternates: { canonical: "/unternehmen" } };

export default function Page() {
  return <PendingPage eyebrow="Unternehmen" title="Logistik braucht Menschen, die Verantwortung übernehmen." text="Diese Seite wird in der nächsten Ausbaustufe umgesetzt." />;
}
