import type { Metadata } from "next";
import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Seite nicht gefunden", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <StatusPage code="Fehler 404" title={["Diese Route", "endet hier."]} text="Die angeforderte Seite gibt es nicht oder nicht mehr. Von hier aus geht es sicher weiter.">
      <ButtonLink href="/">Zur Startseite</ButtonLink>
      <ButtonLink href="/karriere#jobs" variant="outline">
        Offene Stellen
      </ButtonLink>
    </StatusPage>
  );
}
