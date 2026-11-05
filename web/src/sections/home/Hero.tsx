import { SLASH_A, SLASH_B, SLASH_VIEWBOX } from "@/components/brand/Slashes";
import { ButtonLink } from "@/components/ui/Button";
import { company } from "@/content/company";
import { publishedLocations } from "@/content/locations";

const LINES = ["Logistik,", "die messbar", "funktioniert."];

/**
 * Hero – the signature slashes stand still; headline, supporting text and
 * CTAs enter once (fade + 12px, ≤ 480ms). CSS-only, runs pre-hydration.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink pt-24 lg:pt-28">
      {/* Signature mark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[30vw] top-[10%] -z-10 aspect-[453/366] h-[33svh] sm:-right-[14vw] sm:h-[44svh] lg:-right-[2vw] lg:top-[12%] lg:h-[53svh]"
      >
        {[SLASH_A, SLASH_B].map((d) => (
          <svg key={d} viewBox={SLASH_VIEWBOX} className="absolute inset-0 h-full w-full text-red">
            <path d={d} fill="currentColor" />
          </svg>
        ))}
      </div>

      <div className="shell flex flex-1 flex-col justify-center py-10">
        <p className="eyebrow motion-enter text-steel-300">
          <span className="text-white">{company.legalName}</span>
          <span className="mx-3 text-red">{"//"}</span>Seit {company.founded}
        </p>
        <h1 id="hero-title" className="display motion-enter mt-6 text-[clamp(3rem,9vw,9.75rem)] text-white">
          {LINES.map((line) => (
            <span key={line} className="block pb-[0.04em]">
              {line}
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-12 lg:gap-12">
          <p style={{ "--d": "60ms" } as React.CSSProperties} className="motion-fade text-xl font-semibold leading-snug tracking-[-0.01em] text-white sm:text-2xl lg:col-span-5">{company.subclaim}</p>
          <p style={{ "--d": "60ms" } as React.CSSProperties} className="motion-fade max-w-xl text-base leading-relaxed text-steel-300 lg:col-span-6 lg:col-start-7">{company.intro}</p>
          <div style={{ "--d": "120ms" } as React.CSSProperties} className="motion-fade flex flex-col gap-3 sm:flex-row lg:col-span-12">
              <ButtonLink href="/leistungen">Unsere Leistungen</ButtonLink>
              <ButtonLink href="/karriere" variant="outline">
                Karriere bei JARBOU
              </ButtonLink>
          </div>
        </div>
      </div>

      {/* Location strip on the route line */}
      <div style={{ "--d": "120ms" } as React.CSSProperties} className="shell motion-fade relative pb-8">
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
          <a href="#ablauf" className="group hidden shrink-0 items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-steel-300 transition-colors hover:text-white md:flex">
            Vom Lager zum Ziel
            <span aria-hidden="true" className="relative block h-10 w-px overflow-hidden bg-white/20">
              <span className="absolute inset-x-0 top-0 h-1/2 bg-red" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
