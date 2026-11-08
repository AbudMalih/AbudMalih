import type { MetadataRoute } from "next";
import { LOCALES, LOCALE_META, localePath } from "@/content/i18n/config";
import { absolute } from "@/lib/seo";
import {
  articlesFor,
  insightsLocales,
  latestUpdate,
  translationsOf,
  type Article,
} from "@/content/insights";
import type { Locale } from "@/content/i18n/config";

/**
 * Indexable pages in every language (legal pages are noindex and stay out).
 * lastModified: the date the page's content last changed; update it with the
 * content (dates of the Phase 1 SEO release, 8 November 2026).
 */
const PAGES: { path: string; updated: string }[] = [
  { path: "/", updated: "2026-11-08" },
  { path: "/what-we-do", updated: "2026-11-08" },
  { path: "/import", updated: "2026-11-08" },
  { path: "/quote", updated: "2026-11-08" },
  { path: "/brands", updated: "2026-11-08" },
  { path: "/company", updated: "2026-11-08" },
  { path: "/contact", updated: "2026-11-08" },
];

/** Same form as the canonical tag: the root without a trailing slash. */
const url = (path: string) =>
  absolute(path).replace(/^(https:\/\/[^/]+)\/$/, "$1");

/** hreflang alternates among the given languages (x-default → German, else the first). */
function alternatesAmong(paths: Partial<Record<Locale, string>>) {
  const ls = LOCALES.filter((l) => paths[l]);
  const def = paths.de ? "de" : ls[0];
  return {
    languages: {
      ...Object.fromEntries(
        ls.map((l) => [LOCALE_META[l].htmlLang, url(localePath(l, paths[l]!))]),
      ),
      "x-default": url(localePath(def, paths[def]!)),
    },
  };
}

/**
 * Knowledge section: the listing in every language that has published
 * articles (dated by its newest article) and every published article with
 * its own update date. Drafts never exist in production builds.
 */
function insights(): MetadataRoute.Sitemap {
  const langs = insightsLocales();
  const listing = Object.fromEntries(
    langs.map((l) => [l, "/insights"]),
  ) as Partial<Record<Locale, string>>;
  const out: MetadataRoute.Sitemap = langs.map((l) => ({
    url: url(localePath(l, "/insights")),
    lastModified: latestUpdate(l),
    changeFrequency: "weekly" as const,
    alternates: alternatesAmong(listing),
  }));
  const seen = new Set<string>();
  for (const l of langs)
    for (const a of articlesFor(l) as Article[]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const paths = Object.fromEntries(
        translationsOf(a).map((x) => [x, `/insights/${a.text[x]!.slug}`]),
      ) as Partial<Record<Locale, string>>;
      for (const x of translationsOf(a))
        out.push({
          url: url(localePath(x, paths[x]!)),
          lastModified: a.updated,
          changeFrequency: "monthly" as const,
          alternates: alternatesAmong(paths),
        });
    }
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [...pages(), ...insights()];
}

function pages(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, updated }) =>
    LOCALES.map((l) => ({
      url: url(localePath(l, path)),
      lastModified: updated,
      changeFrequency: "monthly" as const,
      alternates: {
        languages: {
          ...Object.fromEntries(
            LOCALES.map((x) => [
              LOCALE_META[x].htmlLang,
              url(localePath(x, path)),
            ]),
          ),
          "x-default": url(localePath("de", path)),
        },
      },
    })),
  );
}
