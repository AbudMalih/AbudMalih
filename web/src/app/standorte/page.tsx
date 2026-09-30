import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Standorte", robots: { index: false, follow: true }, alternates: { canonical: "/standorte" } };

export default function Page() {
  return <PendingPage eyebrow="Standorte" title="Deutschlandweit im Einsatz. Regional stark." text="Diese Seite wird in der nächsten Ausbaustufe umgesetzt." />;
}
