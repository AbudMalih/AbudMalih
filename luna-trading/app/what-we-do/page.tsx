import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { CHAIN } from "@/content/ecosystem";

export const metadata: Metadata = { title: "What we do" };

export default function Page() {
  return (
    <PageShell
      index="01"
      eyebrow="What we do"
      title={<>From source <span className="tone-graphite">to market.</span></>}
      lead="Global sourcing, import & export, product and brand development, e-commerce and European distribution — as one continuous chain."
    >
      <ol>
        {CHAIN.map((c, i) => (
          <li key={c.id}>
            <h2>
              <span className="t-label t-mono tone-graphite">{String(i + 1).padStart(2, "0")}</span>&ensp;{c.label}
            </h2>
            <p>{c.line}</p>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
