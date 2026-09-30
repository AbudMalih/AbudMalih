import { company } from "@/content/company";

/** Neutral public note while legal content is being finalised. */
export function LegalNotice() {
  return (
    <div className="border-l-2 border-red pl-6">
      <p className="text-xl font-semibold leading-snug">Diese Angaben werden derzeit aktualisiert.</p>
      <p className="mt-3 max-w-xl leading-relaxed text-graphite-600">
        Die vollständige Fassung wird in Kürze veröffentlicht. Bei Fragen zu Bewerbungen erreichen Sie uns unter{" "}
        <a href={`mailto:${company.email.careers}`} className="font-semibold text-ink underline underline-offset-4">
          {company.email.careers}
        </a>
        .
      </p>
    </div>
  );
}
