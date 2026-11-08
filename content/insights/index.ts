import { LOCALES, type Locale } from "@/content/i18n/config";
import type { Article, ArticleText, Block, CategoryId } from "./types";
import { plainText } from "@/lib/richtext";
import { incoterms } from "./articles/incoterms";
import { gpsr } from "./articles/gpsr";
import { privateLabel } from "./articles/private-label";
import { importChina } from "./articles/import-china";

export type { Article, ArticleText, Block, CategoryId } from "./types";
export { INSIGHTS_COPY } from "./copy";

/** Every article file, in any status. Add new articles here. */
const ALL: Article[] = [importChina, incoterms, gpsr, privateLabel];

export const CATEGORIES: CategoryId[] = [
  "import",
  "sourcing",
  "compliance",
  "brands",
];

/**
 * Drafts are rendered ONLY by the local development server (`next dev`).
 * `next build` always runs with NODE_ENV=production, so a production build
 * can never contain, list, link or sitemap a draft, whatever else is set.
 */
export const SHOW_DRAFTS = process.env.NODE_ENV === "development";

const visible = (a: Article) => a.status === "published" || SHOW_DRAFTS;

/** Visible articles in a language, newest first. */
export function articlesFor(locale: Locale): Article[] {
  return ALL.filter((a) => visible(a) && a.text[locale]).sort(
    (x, y) =>
      y.published.localeCompare(x.published) || ALL.indexOf(x) - ALL.indexOf(y),
  );
}

/** Whether a language has a knowledge section at all (navigation, routes, sitemap). */
export const hasInsights = (locale: Locale) => articlesFor(locale).length > 0;

export const insightsLocales = (): Locale[] => LOCALES.filter(hasInsights);

export function articleBySlug(
  locale: Locale,
  slug: string,
): Article | undefined {
  return articlesFor(locale).find((a) => a.text[locale]?.slug === slug);
}

/** Languages in which this article exists (and is visible). */
export const translationsOf = (a: Article): Locale[] =>
  visible(a) ? LOCALES.filter((l) => a.text[l]) : [];

/** Canonical (unlocalized) route of an article in a language: "/insights/<slug>". */
export const articleRoute = (a: Article, locale: Locale) =>
  `/insights/${a.text[locale]!.slug}`;

/** Related articles: listed ids first, then the same category, then newest; max 3. */
export function relatedTo(a: Article, locale: Locale): Article[] {
  const pool = articlesFor(locale).filter((x) => x.id !== a.id);
  const listed = (a.related ?? [])
    .map((id) => pool.find((x) => x.id === id))
    .filter((x): x is Article => !!x);
  const rest = pool
    .filter((x) => !listed.includes(x))
    .sort(
      (x, y) =>
        Number(y.category === a.category) - Number(x.category === a.category),
    );
  return [...listed, ...rest].slice(0, 3);
}

const blockText = (b: Block): string =>
  b.t === "ul" || b.t === "ol"
    ? b.items.join(" ")
    : b.t === "table"
      ? [...b.head, ...b.rows.flat()].join(" ")
      : `${"title" in b && b.title ? b.title + " " : ""}${b.text}`;

/** Reading time in minutes (~200 words per minute), at least 1. */
export function readingMinutes(t: ArticleText): number {
  const text = [t.lead, ...t.keyPoints, ...t.body.map(blockText)]
    .map(plainText)
    .join(" ");
  return Math.max(
    1,
    Math.round(text.split(/\s+/).filter(Boolean).length / 200),
  );
}

/** Newest update date among a language's articles (listing lastModified). */
export const latestUpdate = (locale: Locale) =>
  articlesFor(locale).reduce((m, a) => (a.updated > m ? a.updated : m), "");

/** id → slug per language, for visible articles only (small; sent to the language switch). */
export function insightSlugMap(): Record<
  string,
  Partial<Record<Locale, string>>
> {
  const out: Record<string, Partial<Record<Locale, string>>> = {};
  for (const a of ALL) {
    const ls = translationsOf(a);
    if (ls.length)
      out[a.id] = Object.fromEntries(ls.map((l) => [l, a.text[l]!.slug]));
  }
  return out;
}
