"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { INSIGHTS_COPY } from "@/content/insights/copy";
import type { Article, CategoryId } from "@/content/insights/types";
import { usePageMotion } from "@/components/services/usePageMotion";
import { PageHero, Cta, kit as k } from "@/components/kit/Kit";
import svc from "@/components/services/Services.module.css";
import { ArticleCard, Cover, DraftBadge, type CardMeta } from "./shared";
import s from "./Insights.module.css";

/**
 * Knowledge section listing: an editorial cover story, a topic filter and the
 * article grid. Only categories with articles are offered as filters.
 */
export default function InsightsIndex({
  articles,
  meta,
}: {
  articles: Article[];
  meta: Record<string, CardMeta>;
}) {
  const { locale, href } = useI18n();
  const t = INSIGHTS_COPY[locale];
  const root = useRef<HTMLElement>(null);
  usePageMotion(root);
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const [first, ...rest] = articles;
  const cats = (
    ["import", "sourcing", "compliance", "brands"] as CategoryId[]
  ).filter((c) => articles.some((a) => a.category === c));
  const shown =
    cat === "all" ? rest : articles.filter((a) => a.category === cat);
  const ft = first.text[locale]!;

  return (
    <article ref={root} className={`${svc.page} ${k.page}`}>
      <PageHero
        id="ins-title"
        short
        eyebrow={t.hero.eyebrow}
        a={t.hero.h1a}
        b={t.hero.h1b}
        lead={t.hero.lead}
      />

      <section
        className={`${k.light} ${s.section}`}
        data-tone="light"
        aria-labelledby="ins-featured"
      >
        <div className="frame">
          {cat === "all" && (
            <article className={s.featured} data-reveal>
              <Link
                href={href(`/insights/${ft.slug}`)}
                className={s.featuredLink}
                data-cursor="link"
              >
                <Cover
                  src={first.cover.src}
                  alt={ft.coverAlt}
                  illustrative={first.cover.illustrative}
                  priority
                  sizes="(max-width: 1023px) 100vw, 760px"
                  className={s.featuredCover}
                />
                <div className={s.featuredText}>
                  <p className={`t-label ${s.kicker}`}>
                    <span className={s.plus} aria-hidden="true" />
                    {t.featured} · {t.categories[first.category]}
                    <DraftBadge show={first.status === "draft"} />
                  </p>
                  <h2 id="ins-featured" className={s.featuredTitle}>
                    {ft.title}
                  </h2>
                  <p className={s.featuredLead}>{ft.lead}</p>
                  <p className={s.cardMeta}>
                    <time dateTime={meta[first.id].publishedIso}>
                      {meta[first.id].published}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{t.readingTime(meta[first.id].minutes)}</span>
                  </p>
                </div>
              </Link>
            </article>
          )}
          {cat !== "all" && (
            <h2 id="ins-featured" className={s.srOnly}>
              {t.categories[cat]}
            </h2>
          )}

          {cats.length > 1 && (
            <div
              className={s.filters}
              role="group"
              aria-label={t.topics}
              data-reveal
            >
              <button
                type="button"
                className={s.filter}
                aria-pressed={cat === "all"}
                onClick={() => setCat("all")}
              >
                {t.all}
              </button>
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={s.filter}
                  aria-pressed={cat === c}
                  onClick={() => setCat(c)}
                >
                  {t.categories[c]}
                </button>
              ))}
            </div>
          )}

          {shown.length > 0 && (
            <div className={s.grid}>
              {shown.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  text={a.text[locale]!}
                  meta={meta[a.id]}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Cta
        id="ins-cta"
        title={t.closing.title}
        text={t.closing.text}
        button={t.closing.button}
        href={href("/contact")}
      />
    </article>
  );
}
