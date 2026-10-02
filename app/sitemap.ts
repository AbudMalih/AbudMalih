import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/content/i18n/config";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
const PATHS = ["/", "/what-we-do", "/brands", "/company", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((p) =>
    LOCALES.map((l) => ({
      url: `${SITE}${localePath(l, p)}`,
      changeFrequency: "monthly" as const,
      alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${SITE}${localePath(x, p)}`])) },
    }))
  );
}
