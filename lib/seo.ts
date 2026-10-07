import type { Metadata } from "next";
import { LOCALES, LOCALE_META, getDictionary, localePath, type Locale } from "@/content/i18n";

import { absolute } from "./origin";
import { LEGAL_ENTITY } from "@/content/legal";
export { SITE_ORIGIN, SITE_HOST, INDEXING_ENABLED, absolute } from "./origin";


/** The corporate share image (one image, language-neutral). */
export const OG_IMAGE = { url: "/og/luna-trading.png", width: 1200, height: 630, alt: "Luna Trading GmbH" };

/** canonical + hreflang (with x-default → German) for a canonical route. */
export function alternatesFor(locale: Locale, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[LOCALE_META[l].htmlLang] = absolute(localePath(l, path));
  languages["x-default"] = absolute(localePath("de", path));
  return { canonical: absolute(localePath(locale, path)), languages };
}

/**
 * Complete page metadata: title, description, canonical, hreflang, Open
 * Graph and Twitter card. `path` is the canonical route ("/what-we-do").
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  index = true,
}: {
  locale: Locale;
  path: string;
  /** page title without the brand suffix; omit for the homepage */
  title?: string;
  description: string;
  index?: boolean;
}): Metadata {
  const d = getDictionary(locale);
  const full = title ? d.meta.titleTemplate.replace("%s", title) : d.meta.title;
  const url = absolute(localePath(locale, path));
  return {
    title: title ? title : { absolute: d.meta.title },
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: "website",
      url,
      siteName: "Luna Trading GmbH",
      title: full,
      description,
      locale: LOCALE_META[locale].og,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].og),
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [OG_IMAGE.url] },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

/**
 * Organization structured data: verified company facts only. Deliberately
 * no person (managing director), no ratings, founding date, staff numbers or
 * social profiles.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: LEGAL_ENTITY.name,
    legalName: LEGAL_ENTITY.name,
    url: absolute("/"),
    logo: absolute("/brand/luna-trading-logo.webp"),
    email: LEGAL_ENTITY.email,
    vatID: LEGAL_ENTITY.vatId,
    address: {
      "@type": "PostalAddress",
      streetAddress: LEGAL_ENTITY.street,
      postalCode: LEGAL_ENTITY.postalCode,
      addressLocality: LEGAL_ENTITY.city,
      addressCountry: LEGAL_ENTITY.countryCode,
    },
  };
}
