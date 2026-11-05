import type { ReactNode } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";

type Props = {
  eyebrow: string;
  lines: readonly string[];
  lead?: string;
  /** `big` is reserved for major moments (e.g. careers); inner pages use `calm`. */
  size?: "big" | "calm";
  /** Index of a word (in the last line) to render in JARBOU red. */
  accent?: string;
  children?: ReactNode;
  aside?: ReactNode;
};

/** Dark page opening shared by all inner pages. Same calm CSS entrance as the home hero. */
export function PageHero({ eyebrow, lines, lead, size = "calm", accent, children, aside }: Props) {
  const fs = size === "big" ? "text-[clamp(3rem,9.5vw,9.5rem)]" : "text-[clamp(2.4rem,6vw,5.5rem)]";
  return (
    <section className="relative overflow-hidden bg-ink pb-16 pt-32 lg:pb-24 lg:pt-44">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className={aside ? "lg:col-span-8" : "lg:col-span-11"}>
          <div className="motion-enter">
            <SectionLabel>{eyebrow}</SectionLabel>
          </div>
          <h1 className={`display motion-enter mt-6 ${fs} text-white`}>
            {lines.map((line) => (
              <span key={line} className="block pb-[0.04em]">
                <span className="block">
                  {accent && line.includes(accent) ? (
                    <>
                      {line.slice(0, line.indexOf(accent))}
                      <span className="text-red">{accent}</span>
                      {line.slice(line.indexOf(accent) + accent.length)}
                    </>
                  ) : (
                    line
                  )}
                </span>
              </span>
            ))}
          </h1>
          {lead && <p className="mt-8 max-w-2xl text-lg leading-relaxed text-steel-300 motion-fade" style={{ "--d": "60ms" } as React.CSSProperties}>{lead}</p>}
          {children && (
            <div className="motion-fade mt-10" style={{ "--d": "120ms" } as React.CSSProperties}>
              {children}
            </div>
          )}
        </div>
        {aside && <div className="self-end lg:col-span-4">{aside}</div>}
      </div>
    </section>
  );
}
