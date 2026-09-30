import { Slashes } from "@/components/brand/Slashes";

/** Small section label: `// 03 — Leistungen`. */
export function SectionLabel({ index, children, tone = "light" }: { index?: string; children: string; tone?: "light" | "dark" }) {
  return (
    <p className={`eyebrow flex items-center gap-3 ${tone === "light" ? "text-steel-300" : "text-graphite-600"}`}>
      <Slashes className="h-2.5 w-auto text-red" />
      {index && <span className={tone === "light" ? "text-white" : "text-ink"}>{index}</span>}
      <span>{children}</span>
    </p>
  );
}
