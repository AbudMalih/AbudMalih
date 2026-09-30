import type { Metadata } from "next";
import { PendingPage } from "@/components/layout/PendingPage";

export const metadata: Metadata = { title: "Impressum", robots: { index: false, follow: true }, alternates: { canonical: "/impressum" } };

export default function Page() {
  return <PendingPage eyebrow="Rechtliches" title="Impressum" text="Angaben gemäß § 5 DDG folgen." legal />;
}
