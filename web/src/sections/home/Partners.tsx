/* eslint-disable @next/next/no-img-element -- partner logos are SVG */
import { SectionLabel } from "@/components/ui/SectionLabel";
import { visiblePartners } from "@/content/partners";

/** Renders nothing until at least one partner logo is approved for public use. */
export function Partners() {
  if (visiblePartners.length === 0) return null;
  return (
    <section aria-labelledby="partners-title" className="border-t border-white/10 bg-ink py-16">
      <div className="shell">
        <SectionLabel>Projekte</SectionLabel>
        <h2 id="partners-title" className="sr-only">
          Projektpartner
        </h2>
        <ul className="mt-8 flex flex-wrap items-center gap-12">
          {visiblePartners.map((p) => (
            <li key={p.id}>
              <img src={p.logo!} alt={p.name} className="h-8 w-auto opacity-80" />
              {p.relationship && <p className="mt-2 text-xs text-steel-500">{p.relationship}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
