import type { MetadataRoute } from "next";
import { LOCALES, LOCALE_META, localePath } from "@/content/i18n/config";
import { absolute } from "@/lib/seo";

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

export default function sitemap(): MetadataRoute.Sitemap {
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
