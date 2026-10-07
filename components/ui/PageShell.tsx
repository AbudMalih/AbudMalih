import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary, localePath, type Locale } from "@/content/i18n";
import styles from "./PageShell.module.css";

/**
 * Template for secondary pages (each gets its own choreography later).
 * Same typographic system as the homepage; no cinematic layers.
 */
export default function PageShell({
  locale,
  index,
  eyebrow,
  title,
  lead,
  backLabel,
  children,
}: {
  locale: Locale;
  index: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  /** label of the link home (defaults to "back to the story") */
  backLabel?: string;
  children?: ReactNode;
}) {
  const dict = getDictionary(locale);
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
        <Link href={localePath(locale, "/")} className={`link-line t-label ${styles.backLink}`} data-cursor="link">
          <span className={styles.arrow} aria-hidden="true">
            ←
          </span>
          {backLabel ?? dict.pages.back}
        </Link>
      </div>
    </article>
  );
}

export function InPreparation({ label, items }: { label: string; items?: string[] }) {
  return (
    <div className={styles.prep}>
      <p className="t-label">{label}</p>
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
