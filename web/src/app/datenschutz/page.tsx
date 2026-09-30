import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Datenschutz", robots: { index: false, follow: true }, alternates: { canonical: "/datenschutz" } };

export default function Page() {
  return <PendingPage eyebrow="Rechtliches" title="Datenschutzerklärung" text="Die Datenschutzerklärung folgt." legal />;
}
