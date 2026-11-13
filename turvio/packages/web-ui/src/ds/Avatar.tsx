import { cn } from "./cn";

export function initials(name: string): string {
  const words = name
    .replace(/\b(GmbH|AG|KG|UG|SRL|S\.R\.L\.|Ltd|LLC|e\.K\.|&|Co\.?)\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, size = "md", square = false, className }: { name: string; size?: "sm" | "md" | "lg"; square?: boolean; className?: string }) {
  const dims = size === "sm" ? "size-6 text-[10px] rounded-[8px]" : size === "lg" ? "size-10 text-sm rounded-[13px]" : "size-[34px] text-[12.5px] rounded-[11px]";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center bg-[image:var(--avatar-bg)] font-bold text-[color:var(--avatar-text)]", dims, square && "rounded-[10px]", className)}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
