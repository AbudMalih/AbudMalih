import type { MetadataRoute } from "next";
import { LOCALES, LOCALE_META, localePath } from "@/content/i18n/config";
import { absolute } from "@/lib/seo";

/** Indexable pages in every language (legal pages are noindex and stay out). */
const PATHS = ["/", "/what-we-do", "/brands", "/company", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((p) =>
    LOCALES.map((l) => ({
      url: absolute(localePath(l, p)),
      changeFrequency: "monthly" as const,
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((x) => [LOCALE_META[x].htmlLang, absolute(localePath(x, p))])),
          "x-default": absolute(localePath("de", p)),
        },
      },
    }))
  );
}
