import styles from "./BrandMediaSlot.module.css";

export type BrandMedia =
  | { type: "image"; src: string; alt: string; width: number; height: number }
  | { type: "video"; src: string; poster?: string; alt: string };

/**
 * Arch-shaped media slot for owned-brand moments.
 * Phase 1: no product photography exists, so the slot renders a composed
 * light study (warm key light, drifting mist, forest depth) — it presents
 * no fictional product. Pass `media` to place final photography / film /
 * a 3D render without changing the layout.
 */
export default function BrandMediaSlot({ media, className }: { media?: BrandMedia | null; className?: string }) {
  return (
    <figure className={`${styles.slot} ${className ?? ""}`} data-media-slot>
      {media?.type === "image" && (
        <img src={media.src} alt={media.alt} width={media.width} height={media.height} className={styles.media} loading="lazy" decoding="async" />
      )}
      {media?.type === "video" && (
        <video className={styles.media} src={media.src} poster={media.poster} muted playsInline loop autoPlay aria-label={media.alt} />
      )}
      {!media && (
        <div className={styles.study} aria-hidden="true">
          <span className={styles.key} data-key />
          <span className={styles.mist} data-mist />
          <span className={`${styles.mist} ${styles.mist2}`} data-mist2 />
          <span className={styles.floor} />
        </div>
      )}
      <span className={styles.edge} aria-hidden="true" />
    </figure>
  );
}
