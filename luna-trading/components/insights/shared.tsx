"use client";

import Link from "next/link";
import type { Article, ArticleText } from "@/content/insights/types";
import { useI18n } from "@/content/i18n/I18nProvider";
import { INSIGHTS_COPY } from "@/content/insights/copy";
import s from "./Insights.module.css";

/** Cover photograph: responsive, labelled when illustrative ("Symbolbild"). */
export function Cover({
  src,
  alt,
  illustrative,
  priority,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  illustrative: boolean;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  const { locale } = useI18n();
  return (
    <figure className={`${s.cover} ${className}`}>
      <img
        src={`${src}-1600.webp`}
        srcSet={`${src}-960.webp 960w, ${src}-1600.webp 1600w`}
        sizes={sizes}
        alt={alt}
        width={1600}
        height={1195}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
      {illustrative && (
        <span className={s.note}>{INSIGHTS_COPY[locale].illustrative}</span>
      )}
    </figure>
  );
}

/** Pre-formatted dates and reading time, computed on the server (no hydration drift). */
export type CardMeta = {
  published: string;
  publishedIso: string;
  minutes: number;
};

/** Article preview card (listing grid and "read next"). */
export function ArticleCard({
  article,
  text,
  meta,
  headingLevel = 3,
}: {
  article: Article;
  text: ArticleText;
  meta: CardMeta;
  headingLevel?: 2 | 3;
}) {
  const { locale, href } = useI18n();
  const t = INSIGHTS_COPY[locale];
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={s.card} data-reveal>
      <Link
        href={href(`/insights/${text.slug}`)}
        className={s.cardLink}
        data-cursor="link"
      >
        <Cover
          src={article.cover.src}
          alt={text.coverAlt}
          illustrative={article.cover.illustrative}
          sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 420px"
          className={s.cardCover}
        />
        <p className={`t-label ${s.cat}`}>{t.categories[article.category]}</p>
        <H className={s.cardTitle}>{text.title}</H>
        <p className={s.cardLead}>{text.lead}</p>
        <p className={s.cardMeta}>
          <time dateTime={meta.publishedIso}>{meta.published}</time>
          <span aria-hidden="true">·</span>
          <span>{t.readingTime(meta.minutes)}</span>
        </p>
      </Link>
    </article>
  );
}

/** Visible marker for drafts (development server only; drafts never exist in production). */
export function DraftBadge({ show }: { show: boolean }) {
  const { locale } = useI18n();
  if (!show) return null;
  return <span className={s.draft}>{INSIGHTS_COPY[locale].draft}</span>;
}
