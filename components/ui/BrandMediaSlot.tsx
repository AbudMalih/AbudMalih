import styles from "./BrandMediaSlot.module.css";

export type BrandMedia =
  | { type: "image"; src: string; alt: string; width: number; height: number }
  | { type: "video"; src: string; poster?: string; alt: string };

/**
 * An arched niche set into a plastered wall: the place where the real
 * owned-brand product will stand. Until photography / renders exist it
 * shows only architecture and light (a warm evening downlight, the niche's
 * depth, a stone ledge, a faint botanical shadow, slow air) and presents no
 * fictional product. Pass `media` to place the real product: an image is
 * set on the ledge (contain, bottom centre); a video fills the niche. The
 * light, ledge and shadow stay, so the scene needs no redesign.
 */
export default function BrandMediaSlot({ media, className }: { media?: BrandMedia | null; className?: string }) {
  return (
    <figure className={`${styles.slot} ${className ?? ""}`} data-media-slot>
      <div className={styles.study} aria-hidden="true">
        <span className={styles.back} />
        <span className={styles.key} data-key />
        <svg className={styles.botanical} viewBox="0 0 200 260">
          {/* a single olive sprig, seen only as a soft cast shadow */}
          <path d="M196 4 C150 40 118 86 92 150 C80 180 70 214 64 258" />
          <path d="M150 42 c-22 -6 -40 2 -52 16 c20 4 38 0 52 -16z" />
          <path d="M136 64 c10 -20 28 -30 48 -30 c-6 18 -24 30 -48 30z" />
          <path d="M120 92 c-24 -2 -40 8 -50 24 c20 2 38 -6 50 -24z" />
          <path d="M108 118 c12 -18 30 -26 50 -24 c-8 18 -26 28 -50 24z" />
          <path d="M96 148 c-22 2 -36 14 -42 30 c20 -2 34 -12 42 -30z" />
          <path d="M86 176 c14 -16 32 -22 50 -18 c-10 16 -28 24 -50 18z" />
          <path d="M76 206 c-20 4 -32 16 -36 32 c18 -4 30 -14 36 -32z" />
        </svg>
        <span className={styles.mist} data-mist />
        <span className={`${styles.mist} ${styles.mist2}`} data-mist2 />
        <span className={styles.depth} />
        <span className={styles.ledge} />
      </div>
      {media?.type === "image" && (
        <img src={media.src} alt={media.alt} width={media.width} height={media.height} className={styles.product} loading="lazy" decoding="async" />
      )}
      {media?.type === "video" && (
        <video className={styles.media} src={media.src} poster={media.poster} muted playsInline loop autoPlay aria-label={media.alt} />
      )}
      <span className={styles.edge} aria-hidden="true" />
    </figure>
  );
}
