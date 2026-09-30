import Image from "next/image";
import { media } from "@/content/media";
import type { MediaKey } from "@/content/types";

/**
 * Renders an approved photo from the media registry – or nothing at all.
 * Used for real JARBOU photography; layouts are complete without it.
 */
export function MediaSlot({ id, className = "", sizes = "100vw", priority = false }: { id: MediaKey; className?: string; sizes?: string; priority?: boolean }) {
  const m = media[id];
  if (!m.src || m.placeholder) return null;
  return (
    <figure className={`relative overflow-hidden bg-graphite-800 ${className}`}>
      <Image src={m.src} alt={m.alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </figure>
  );
}
