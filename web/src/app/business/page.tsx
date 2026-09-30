import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Für Unternehmen", robots: { index: false, follow: true }, alternates: { canonical: "/business" } };

export default function Page() {
  return <PendingPage eyebrow="Für Unternehmen" title="Operative Logistik. Zuverlässig skaliert." text="Das Anfrageformular für Unternehmen wird in der nächsten Ausbaustufe umgesetzt." />;
}
