import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InsightsIndex from "@/components/insights/InsightsIndex";
import type { CardMeta } from "@/components/insights/shared";
import { isLocale, type Locale } from "@/content/i18n";
import {
  INSIGHTS_COPY,
  articlesFor,
  hasInsights,
  insightsLocales,
  readingMinutes,
} from "@/content/insights";
import {
  breadcrumbTrailJsonLd,
  collectionJsonLd,
  insightsMetadata,
  jsonLdGraph,
} from "@/lib/seo";
import { formatDate } from "@/lib/dates";

type P = { params: Promise<{ lang: string }> };

const paths = () =>
  Object.fromEntries(insightsLocales().map((l) => [l, "/insights"])) as Partial<
    Record<Locale, string>
  >;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang) || !hasInsights(lang)) return {};
  const t = INSIGHTS_COPY[lang];
  return insightsMetadata({
    locale: lang,
    paths: paths(),
    title: t.meta.title,
    description: t.meta.description,
  });
}

/** The listing exists only in languages with published articles; otherwise 404. */
export default async function Page({ params }: P) {
  const { lang } = await params;
  if (!isLocale(lang) || !hasInsights(lang)) notFound();
  const t = INSIGHTS_COPY[lang];
  const articles = articlesFor(lang);
  const meta: Record<string, CardMeta> = Object.fromEntries(
    articles.map((a) => [
      a.id,
      {
        published: formatDate(lang, a.published),
        publishedIso: a.published,
        minutes: readingMinutes(a.text[lang]!),
      },
    ]),
  );
  const ld = jsonLdGraph([
    collectionJsonLd(
      lang,
      "/insights",
      t.meta.title,
      t.meta.description,
      articles.map((a) => ({
        name: a.text[lang]!.title,
        path: `/insights/${a.text[lang]!.slug}`,
      })),
    ),
    breadcrumbTrailJsonLd(lang, [{ name: t.name, path: "/insights" }]),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld }}
      />
      <InsightsIndex articles={articles} meta={meta} />
    </>
  );
}
