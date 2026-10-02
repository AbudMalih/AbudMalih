import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

/**
 * Template for secondary pages (Phase 2 will give each its own choreography).
 * Same typographic system as the homepage; no cinematic layers.
 */
export default function PageShell({
  index,
  eyebrow,
  title,
  lead,
  children,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className={styles.page}>
      <header className={`frame ${styles.head}`}>
        <p className={`t-label ${styles.eyebrow}`}>
          <span className={styles.idx}>{index}</span>
          <span className={styles.rule} />
          {eyebrow}
        </p>
        <h1 className={`t-display ${styles.title}`}>{title}</h1>
        {lead && <p className={`t-lead ${styles.lead}`}>{lead}</p>}
      </header>
      <div className={`frame ${styles.body}`}>{children}</div>
      <div className={`frame ${styles.back}`}>
        <Link href="/" className="link-line t-label" data-cursor="link">
          ← Back to the story
        </Link>
      </div>
    </article>
  );
}

export function InPreparation({ items }: { items?: string[] }) {
  return (
    <div className={styles.prep}>
      <p className="t-label">Phase 2 · In preparation</p>
      {items && (
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
