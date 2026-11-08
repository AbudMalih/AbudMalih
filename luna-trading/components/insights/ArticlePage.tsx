"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { INSIGHTS_COPY } from "@/content/insights/copy";
import type { Article, Block } from "@/content/insights/types";
import RichText from "@/components/ui/RichText";
import { usePageMotion } from "@/components/services/usePageMotion";
import { RedButton, kit as k } from "@/components/kit/Kit";
import svc from "@/components/services/Services.module.css";
import { ArticleCard, Cover, DraftBadge, type CardMeta } from "./shared";
import s from "./Insights.module.css";

export type ArticleDates = {
  published: string;
  publishedIso: string;
  updated: string;
  updatedIso: string;
  reviewed?: string;
  reviewedIso?: string;
  minutes: number;
};

function BodyBlock({ b }: { b: Block }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 id={b.id} className={s.h2}>
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 className={s.h3}>{b.text}</h3>;
    case "p":
      return (
        <p>
          <RichText text={b.text} />
        </p>
      );
    case "ul":
    case "ol": {
      const L = b.t;
      return (
        <L className={s.list}>
          {b.items.map((x) => (
            <li key={x}>
              <RichText text={x} />
            </li>
          ))}
        </L>
      );
    }
    case "note":
      return (
        <aside className={s.noteBox}>
          {b.title && <p className={s.noteTitle}>{b.title}</p>}
          <p>
            <RichText text={b.text} />
          </p>
        </aside>
      );
    case "table":
      /* explicit roles keep table semantics when phones stack the rows */
      return (
        <div
          className={s.tableWrap}
          tabIndex={0}
          role="region"
          aria-label={b.caption ?? b.head.join(", ")}
        >
          <table className={s.table} role="table" data-cols={b.head.length}>
            {b.caption && <caption>{b.caption}</caption>}
            <thead role="rowgroup">
              <tr role="row">
                {b.head.map((h) => (
                  <th key={h} scope="col" role="columnheader">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {b.rows.map((r) => (
                <tr key={r.join("|")} role="row">
                  {r.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" role="rowheader">
                        {c}
                      </th>
                    ) : (
                      <td key={i} role="cell" data-label={b.head[i]}>
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Table of contents with the section currently being read marked. */
function Toc({
  items,
  label,
}: {
  items: { id: string; text: string }[];
  label: string;
}) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items
      .map((x) => document.getElementById(x.id))
      .filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (es) => {
        const vis = es
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  const list = (
    <ol className={s.tocList}>
      {items.map((x) => (
        <li key={x.id}>
          <a
            href={`#${x.id}`}
            aria-current={active === x.id ? "location" : undefined}
            data-cursor="link"
          >
            {x.text}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <nav className={s.tocSide} aria-label={label}>
        <p className={`t-label ${s.tocLabel}`}>{label}</p>
        {list}
      </nav>
      <details className={s.tocInline}>
        <summary className="t-label">{label}</summary>
        {list}
      </details>
    </>
  );
}

/**
 * Article template: breadcrumb, editorial header, cover, "in brief", body with
 * a table of contents (3+ sections), legal note for compliance topics, one
 * contextual call to action and related articles.
 */
export default function ArticlePage({
  article,
  dates,
  related,
  relatedMeta,
}: {
  article: Article;
  dates: ArticleDates;
  related: Article[];
  relatedMeta: Record<string, CardMeta>;
}) {
  const { locale, href, dict } = useI18n();
  const t = INSIGHTS_COPY[locale];
  const a = article.text[locale]!;
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const toc = a.body
    .filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2")
    .map((b) => ({ id: b.id, text: b.text }));
  const cta =
    article.category === "import"
      ? { ...t.cta.import, href: href("/quote") }
      : { ...t.cta.general, href: href("/contact") };

  return (
    <article ref={root} className={`${svc.page} ${k.page}`}>
      <header className={s.head} data-tone="light" data-hero>
        <div className={`frame ${s.headInner}`}>
          <nav aria-label={t.crumbs} className={s.crumbs} data-reveal>
            <ol>
              <li>
                <Link href={href("/")}>{dict.nav.home}</Link>
              </li>
              <li>
                <Link href={href("/insights")}>{t.name}</Link>
              </li>
              <li aria-current="page">{a.title}</li>
            </ol>
          </nav>
          <p
            className={`t-label ${s.kicker}`}
            data-reveal
            style={{ ["--d" as string]: "60ms" }}
          >
            <span className={s.plus} aria-hidden="true" />
            {t.categories[article.category]}
            <DraftBadge show={article.status === "draft"} />
          </p>
          <h1
            className={s.title}
            data-reveal
            style={{ ["--d" as string]: "100ms" }}
          >
            {a.title}
          </h1>
          <p
            className={`t-lead ${s.lead}`}
            data-reveal
            style={{ ["--d" as string]: "160ms" }}
          >
            {a.lead}
          </p>
          <p
            className={s.meta}
            data-reveal
            style={{ ["--d" as string]: "220ms" }}
          >
            <span>{t.by}</span>
            <span>
              {t.published}{" "}
              <time dateTime={dates.publishedIso}>{dates.published}</time>
            </span>
            {dates.updatedIso !== dates.publishedIso && (
              <span>
                {t.updated}{" "}
                <time dateTime={dates.updatedIso}>{dates.updated}</time>
              </span>
            )}
            <span>{t.readingTime(dates.minutes)}</span>
          </p>
          {dates.reviewed && (
            <p
              className={s.reviewed}
              data-reveal
              style={{ ["--d" as string]: "260ms" }}
            >
              <span className={s.plus} aria-hidden="true" />
              {t.reviewed}:{" "}
              <time dateTime={dates.reviewedIso}>{dates.reviewed}</time>
            </p>
          )}
        </div>
        <div
          className={`frame ${s.coverWrap}`}
          data-reveal
          style={{ ["--d" as string]: "200ms" }}
        >
          <Cover
            src={article.cover.src}
            alt={a.coverAlt}
            illustrative={article.cover.illustrative}
            priority
            sizes="(max-width: 1440px) 100vw, 1320px"
            className={s.heroCover}
          />
        </div>
      </header>

      <section
        className={`${k.light} ${s.bodySection}`}
        data-tone="light"
        aria-label={a.title}
      >
        <div
          className={`frame ${s.layout} ${toc.length >= 3 ? s.withToc : ""}`}
        >
          {toc.length >= 3 && <Toc items={toc} label={t.toc} />}
          <div className={s.prose}>
            <aside className={s.brief} aria-labelledby="art-brief">
              <p id="art-brief" className={`t-label ${s.briefLabel}`}>
                {t.keyPoints}
              </p>
              <ul>
                {a.keyPoints.map((x) => (
                  <li key={x}>
                    <RichText text={x} />
                  </li>
                ))}
              </ul>
            </aside>
            {a.body.map((b, i) => (
              <BodyBlock key={i} b={b} />
            ))}
            {a.sources && a.sources.length > 0 && (
              <section className={s.sources} aria-labelledby="art-sources">
                <h2 id="art-sources" className={s.sourcesTitle}>
                  {t.sources}
                </h2>
                <p className={s.sourcesNote}>{t.sourcesNote}</p>
                <ol className={s.sourcesList}>
                  {a.sources.map((src) => (
                    <li key={src.url}>
                      <a
                        href={src.url}
                        rel="noopener noreferrer"
                        data-cursor="link"
                      >
                        {src.title}
                      </a>
                      <span className={s.sourcesBy}>{src.publisher}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {dates.reviewed && (
              <p className={s.legal}>{t.legalNote(dates.reviewed)}</p>
            )}
            <aside className={s.ctaBox} aria-labelledby="art-cta">
              <div>
                <p id="art-cta" className={s.ctaTitle}>
                  {cta.title}
                </p>
                <p className={s.ctaText}>{cta.text}</p>
              </div>
              <RedButton href={cta.href}>{cta.button}</RedButton>
            </aside>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section
          className={`${k.light} ${k.alt} ${s.section}`}
          data-tone="light"
          aria-labelledby="art-related"
        >
          <div className="frame">
            <div className={s.relatedHead}>
              <h2 id="art-related" className={s.relatedTitle}>
                {t.related}
              </h2>
              <Link
                href={href("/insights")}
                className={`link-line t-label ${s.allLink}`}
                data-cursor="link"
              >
                {t.backToList} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={s.grid}>
              {related.map((r) => (
                <ArticleCard
                  key={r.id}
                  article={r}
                  text={r.text[locale]!}
                  meta={relatedMeta[r.id]}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
