import styles from "./ChapterTag.module.css";

/** Editorial chapter marker: index — hairline — label. */
export default function ChapterTag({ index, label, className }: { index: string; label: string; className?: string }) {
  return (
    <p className={`t-label ${styles.tag} ${className ?? ""}`} data-tag>
      <span className={styles.idx}>{index}</span>
      <span className={styles.rule} data-tag-rule />
      <span>{label}</span>
    </p>
  );
}
