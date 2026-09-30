import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Karriere", robots: { index: false, follow: true }, alternates: { canonical: "/karriere" } };

export default function Page() {
  return <PendingPage eyebrow="Karriere" title="Deine Leistung bewegt uns." text="Stellenübersicht, Stellendetails und Online-Bewerbung werden in der nächsten Ausbaustufe umgesetzt." />;
}
