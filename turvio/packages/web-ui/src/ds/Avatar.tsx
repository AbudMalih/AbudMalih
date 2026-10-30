import { cn } from "./cn";

const HUES = [
  "bg-blue-50 text-blue-700 ring-blue-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-amber-50 text-amber-700 ring-amber-100",
  "bg-rose-50 text-rose-700 ring-rose-100",
  "bg-cyan-50 text-cyan-700 ring-cyan-100",
  "bg-slate-100 text-slate-700 ring-slate-200",
];

export function initials(name: string): string {
  const words = name
    .replace(/\b(GmbH|AG|KG|UG|SRL|S\.R\.L\.|Ltd|LLC|e\.K\.|&|Co\.?)\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function hueFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length]!;
}

export function Avatar({ name, size = "md", square = false, className }: { name: string; size?: "sm" | "md" | "lg"; square?: boolean; className?: string }) {
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold ring-1 ring-inset", square ? "rounded-md" : "rounded-full", dims, hueFor(name), className)}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
