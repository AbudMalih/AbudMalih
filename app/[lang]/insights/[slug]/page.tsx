import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticlePage from "@/components/insights/ArticlePage";
import type { CardMeta } from "@/components/insights/shared";
import { isLocale, type Locale } from "@/content/i18n";
import {
  INSIGHTS_COPY,
  articleBySlug,
  articlesFor,
  readingMinutes,
  relatedTo,
  translationsOf,
} from "@/content/insights";
import type { Article } from "@/content/insights";
import {
  articleJsonLd,
  breadcrumbTrailJsonLd,
  insightsMetadata,
  jsonLdGraph,
} from "@/lib/seo";
import { formatDate } from "@/lib/dates";

type P = { params: Promise<{ lang: string; slug: string }> };

/** Only built articles exist: unknown slugs are 404 (no on-demand rendering). */
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  if (!isLocale(params.lang)) return [];
  return articlesFor(params.lang).map((a) => ({
    slug: a.text[params.lang as Locale]!.slug,
  }));
}

const pathsOf = (a: Article) =>
  Object.fromEntries(
    translationsOf(a).map((l) => [l, `/insights/${a.text[l]!.slug}`]),
  ) as Partial<Record<Locale, string>>;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const a = articleBySlug(lang, slug);
  if (!a) return {};
  const x = a.text[lang]!;
  return insightsMetadata({
    locale: lang,
    paths: pathsOf(a),
    title: x.seoTitle ?? x.title,
    description: x.description,
    image: { url: `${a.cover.src}-1600.webp`, alt: x.coverAlt },
    article: {
      published: a.published,
      updated: a.updated,
      section: INSIGHTS_COPY[lang].categories[a.category],
    },
  });
}

export default async function Page({ params }: P) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const a = articleBySlug(lang, slug);
  if (!a) notFound();
  const x = a.text[lang]!;
  const t = INSIGHTS_COPY[lang];
  const related = relatedTo(a, lang);
  const relatedMeta: Record<string, CardMeta> = Object.fromEntries(
    related.map((r) => [
      r.id,
      {
        published: formatDate(lang, r.published),
        publishedIso: r.published,
        minutes: readingMinutes(r.text[lang]!),
      },
    ]),
  );
  const path = `/insights/${x.slug}`;
  const ld = jsonLdGraph([
    articleJsonLd({
      locale: lang,
      path,
      headline: x.title,
      description: x.description,
      image: `${a.cover.src}-1600.webp`,
      published: a.published,
      updated: a.updated,
      section: t.categories[a.category],
      sources: x.sources,
    }),
    breadcrumbTrailJsonLd(lang, [
      { name: t.name, path: "/insights" },
      { name: x.title, path },
    ]),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld }}
      />
      <ArticlePage
        article={a}
        dates={{
          published: formatDate(lang, a.published),
          publishedIso: a.published,
          updated: formatDate(lang, a.updated),
          updatedIso: a.updated,
          ...(a.reviewed
            ? {
                reviewed: formatDate(lang, a.reviewed),
                reviewedIso: a.reviewed,
              }
            : {}),
          minutes: readingMinutes(x),
        }}
        related={related}
        relatedMeta={relatedMeta}
      />
    </>
  );
}
