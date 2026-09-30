"use client";

import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui/Button";

/** Runtime error boundary – never shows technical details. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage code="Fehler" title={["Hier ist etwas", "schiefgelaufen."]} text="Die Seite konnte gerade nicht geladen werden. Bitte versuchen Sie es noch einmal.">
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-12 items-center justify-center bg-red-cta px-6 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-white hover:bg-red-ink"
      >
        Erneut versuchen
      </button>
      <ButtonLink href="/" variant="outline">
        Zur Startseite
      </ButtonLink>
    </StatusPage>
  );
}
