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

/** Dark page opening shared by all Phase-2 pages. CSS-only reveal. */
export function PageHero({ eyebrow, lines, lead, size = "calm", accent, children, aside }: Props) {
  const fs = size === "big" ? "text-[clamp(3rem,9.5vw,9.5rem)]" : "text-[clamp(2.4rem,6vw,5.5rem)]";
  return (
    <section className="relative overflow-hidden bg-ink pb-16 pt-32 lg:pb-24 lg:pt-44">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className={aside ? "lg:col-span-8" : "lg:col-span-11"}>
          <div className="[animation:rise_0.8s_var(--ease-out-expo)_both]">
            <SectionLabel>{eyebrow}</SectionLabel>
          </div>
          <h1 className={`display mt-6 ${fs} text-white`}>
            {lines.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.04em]">
                <span className="block [animation:line-rise_1s_var(--ease-out-expo)_both]" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
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
          {lead && <p className="mt-8 max-w-2xl text-lg leading-relaxed text-steel-300 [animation:rise_0.9s_var(--ease-out-expo)_0.3s_both]">{lead}</p>}
          {children && <div className="mt-10 [animation:rise_0.9s_var(--ease-out-expo)_0.4s_both]">{children}</div>}
        </div>
        {aside && <div className="self-end lg:col-span-4">{aside}</div>}
      </div>
    </section>
  );
}
