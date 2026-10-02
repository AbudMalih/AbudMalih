import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import { LuviscentLogo } from "@/components/brand/Logos";
import { BRANDS } from "@/content/site";

export const metadata: Metadata = { title: "Brands" };

export default function Page() {
  const b = BRANDS.luviscent;
  return (
    <PageShell index="02" eyebrow="Brands" title={<>We build <span className="tone-graphite">brands.</span></>} lead="Owned brands of Luna Trading GmbH.">
      <section id="luviscent" style={{ padding: "clamp(32px,6vw,80px)", background: "linear-gradient(180deg,#071a14,#04100c)", maxWidth: 1100 }}>
        <p className="t-label" style={{ color: "var(--lv-gold-soft)", marginBottom: 28 }}>
          Owned brand · {b.category}
        </p>
        <LuviscentLogo width="min(640px, 100%)" />
        <p className="t-serif" lang="de" style={{ fontStyle: "italic", fontSize: "clamp(1.6rem,3vw,2.6rem)", marginTop: 28, color: "var(--lv-mist)" }}>
          {b.claim}
        </p>
      </section>
    </PageShell>
  );
}
