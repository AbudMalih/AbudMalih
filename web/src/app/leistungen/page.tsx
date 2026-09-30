import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Leistungen", robots: { index: false, follow: true }, alternates: { canonical: "/leistungen" } };

export default function Page() {
  return <PendingPage eyebrow="Leistungen" title="Ein Partner für den gesamten Ablauf." text="Diese Seite wird in der nächsten Ausbaustufe umgesetzt." />;
}
