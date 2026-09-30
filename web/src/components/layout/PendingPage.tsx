import { Slashes } from "@/components/brand/Slashes";
import { ButtonLink } from "@/components/ui/Button";
import { company } from "@/content/company";

/**
 * Honest interim page for routes scheduled for the next build phase.
 * Pages using it are `noindex` and excluded from the sitemap.
 */
export function PendingPage({ eyebrow, title, text, legal = false }: { eyebrow: string; title: string; text: string; legal?: boolean }) {
  return (
    <section className="flex min-h-[80svh] items-end bg-ink pb-20 pt-40">
      <div className="shell">
        <Slashes className="h-10 w-auto text-red" />
        <p className="eyebrow mt-10 text-steel-400">{eyebrow}</p>
        <h1 className="display mt-4 max-w-5xl text-[clamp(2.5rem,7vw,6.5rem)]">{title}</h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-steel-300">{text}</p>
        {legal ? (
          <p className="mt-6 max-w-xl border-l-2 border-red pl-4 text-sm text-steel-300">
            Platzhalter: Der rechtsverbindliche Text muss von JARBOU Logistik GmbH bereitgestellt und rechtlich geprüft werden.
          </p>
        ) : (
          <p className="mt-6 text-sm text-steel-400">
            Bewerbungen bis dahin gerne per E-Mail an{" "}
            <a href={`mailto:${company.email.careers}`} className="text-white underline underline-offset-4">
              {company.email.careers}
            </a>
          </p>
        )}
        <div className="mt-10">
          <ButtonLink href="/" variant="outline">
            Zur Startseite
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
