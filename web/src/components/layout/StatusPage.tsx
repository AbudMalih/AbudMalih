import type { ReactNode } from "react";
import { Slashes } from "@/components/brand/Slashes";

/** Branded full-height status page (404, job gone, errors). */
export function StatusPage({ code, title, text, children }: { code: string; title: readonly string[]; text: string; children?: ReactNode }) {
  return (
    <section className="relative flex min-h-[88svh] items-end overflow-hidden bg-ink pb-20 pt-40">
      <Slashes className="pointer-events-none absolute -right-[10%] top-[12%] h-[60%] w-auto text-white/[0.04]" />
      <div className="shell relative">
        <p className="eyebrow flex items-center gap-3 text-steel-400">
          <Slashes className="h-2.5 w-auto text-red" />
          {code}
        </p>
        <h1 className="display mt-6 text-[clamp(2.6rem,7.5vw,7rem)] text-white">
          {title.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-steel-300">{text}</p>
        {children && <div className="mt-10 flex flex-col gap-3 sm:flex-row">{children}</div>}
      </div>
    </section>
  );
}
