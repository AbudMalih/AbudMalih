import type { StepId } from "@/content/i18n/types";

/**
 * 05 · one hairline drawing per discipline, drawn in by the scroll
 * (every path has pathLength=1, so the timeline animates stroke-dashoffset
 * 1 → 0). Technical-drawing language: outlines, dimension lines, one red
 * mark per drawing. viewBox 320 × 200.
 */
const P = (d: string, red = false) => ({ d, red });

const ART: Record<StepId, { d: string; red: boolean }[]> = {
  // a globe with its graticule and the sourcing point
  sourcing: [
    P("M160 20a80 80 0 1 0 0.01 0"),
    P("M160 20a34 80 0 1 0 0.01 0"),
    P("M80 100h160"),
    P("M90 62q70 14 140 0"),
    P("M90 138q70 -14 140 0"),
    P("M196 54v22M185 65h22", true),
    P("M207 65h70l16 -16"),
  ],
  // a shipping container in perspective, corrugated, with its dimension line
  import: [
    P("M60 70l150 -24l70 30l-150 24z"),
    P("M60 70v70l70 30v-70"),
    P("M130 100l150 -24v70l-150 24"),
    P("M150 98v70M170 95v70M190 92v70M210 89v70M230 86v70M250 83v70"),
    P("M60 184l70 -0M60 178v12M130 178v12"),
    P("M84 110v26M106 120v26", true),
  ],
  // a carton's dieline: the product before it exists
  development: [
    P("M100 60h120v80h-120z"),
    P("M100 60l-30 -24h120l30 24"),
    P("M100 140l-30 24h120l30 -24"),
    P("M100 60h-40v80h40M220 60h40v80h-40"),
    P("M70 36v-14M190 36v-14M70 29h120"),
    P("M151 100h18M160 91v18", true),
  ],
  // the carton, closed, with its label: a product with a stance
  brand: [
    P("M90 70l80 -30l80 30l-80 30z"),
    P("M90 70v80l80 30v-80"),
    P("M170 100l80 -30v80l-80 30"),
    P("M106 104l48 18v26l-48 -18z"),
    P("M114 116l32 12M114 124l22 8"),
    P("M196 120v22M185 131h22", true),
  ],
  // a storefront screen: tiles, a cursor, the order
  ecommerce: [
    P("M60 36h200v128h-200z"),
    P("M60 54h200"),
    P("M68 45h6M80 45h6M92 45h6"),
    P("M76 70h52v36h-52zM134 70h52v36h-52zM192 70h52v36h-52z"),
    P("M76 116h52v36h-52zM134 116h52v36h-52z"),
    P("M210 126v22M199 137h22", true),
  ],
  // one origin branching to retail, B2B and the customer
  distribution: [
    P("M50 100h70"),
    P("M120 100c40 0 50 -56 100 -56h50"),
    P("M120 100h150"),
    P("M120 100c40 0 50 56 100 56h50"),
    P("M270 36v16M270 92v16M270 148v16"),
    P("M50 89v22M39 100h22", true),
  ],
};

export default function ChainArt({ id, className, redClass }: { id: StepId; className?: string; redClass?: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} data-art aria-hidden="true">
      {ART[id].map((p, i) => (
        <path key={i} d={p.d} pathLength={1} className={p.red ? redClass : undefined} />
      ))}
    </svg>
  );
}
