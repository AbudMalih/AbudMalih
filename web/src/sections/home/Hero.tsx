import { SLASH_A, SLASH_B, SLASH_VIEWBOX } from "@/components/brand/Slashes";
import { ButtonLink } from "@/components/ui/Button";
import { company } from "@/content/company";
import { publishedLocations } from "@/content/locations";

const LINES = ["Logistik,", "die messbar", "funktioniert."];

/**
 * Moment 1 – the two slashes sweep in from the left and settle as a large
 * cropped mark; the headline rises line by line. CSS-only, runs pre-hydration.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink pt-24 lg:pt-28">
      {/* Signature mark */}
      {/* Each slash is its own element so the sweep runs on the compositor. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[30vw] top-[10%] -z-10 aspect-[453/366] h-[33svh] sm:-right-[14vw] sm:h-[44svh] lg:-right-[2vw] lg:top-[12%] lg:h-[53svh]"
      >
        {[SLASH_A, SLASH_B].map((d, i) => (
          <svg
            key={d}
            viewBox={SLASH_VIEWBOX}
            className="absolute inset-0 h-full w-full text-red will-change-transform [animation:hero-slash_1.1s_var(--ease-out-expo)_both]"
            style={{ animationDelay: `${i * 0.09}s` }}
          >
            <path d={d} fill="currentColor" />
          </svg>
        ))}
      </div>

      <div className="shell flex flex-1 flex-col justify-center py-10">
        <p className="eyebrow text-steel-300 [animation:rise_0.8s_var(--ease-out-expo)_0.3s_both]">
          <span className="text-white">{company.legalName}</span>
          <span className="mx-3 text-red">{"//"}</span>Seit {company.founded}
        </p>
        <h1 id="hero-title" className="display mt-6 text-[clamp(3rem,9vw,9.75rem)] text-white">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.04em]">
              <span className="block [animation:line-rise_1s_var(--ease-out-expo)_both]" style={{ animationDelay: `${0.25 + i * 0.1}s` }}>
                {line}
              </span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-12 lg:gap-12 [animation:rise_0.9s_var(--ease-out-expo)_0.5s_both]">
          <p className="text-xl font-semibold leading-snug tracking-[-0.01em] text-white sm:text-2xl lg:col-span-5">{company.subclaim}</p>
          <p className="max-w-xl text-base leading-relaxed text-steel-300 lg:col-span-6 lg:col-start-7">{company.intro}</p>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-12">
              <ButtonLink href="/leistungen">Unsere Leistungen</ButtonLink>
              <ButtonLink href="/karriere" variant="outline">
                Karriere bei JARBOU
              </ButtonLink>
          </div>
        </div>
      </div>

      {/* Location strip on the route line */}
      <div className="shell relative pb-8 [animation:fade-up_0.9s_var(--ease-out-expo)_1s_both]">
        <div className="flex items-end justify-between gap-6 border-t border-white/10 pt-6">
          <div className="min-w-0">
            <p className="eyebrow text-steel-500">Im Einsatz in</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-steel-200">
              {publishedLocations.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 bg-red" />
                  {l.name}
                </li>
              ))}
            </ul>
          </div>
          <a href="#ablauf" className="group hidden shrink-0 items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-steel-300 hover:text-white md:flex">
            Vom Lager zum Ziel
            <span aria-hidden="true" className="relative block h-10 w-px overflow-hidden bg-white/20">
              <span className="absolute inset-x-0 top-0 h-1/2 bg-red [animation:scroll-cue_1.8s_var(--ease-in-out-quart)_infinite]" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
