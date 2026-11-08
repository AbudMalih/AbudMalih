import type { Metadata } from "next";
import {
  LOCALES,
  LOCALE_META,
  getDictionary,
  localePath,
  type Locale,
} from "@/content/i18n";

import { absolute, SITE_ORIGIN } from "./origin";
import { LEGAL_ENTITY } from "@/content/legal";
import { plainText } from "./richtext";
export { SITE_ORIGIN, SITE_HOST, INDEXING_ENABLED, absolute } from "./origin";

/** The corporate share image (one image, language-neutral). */
export const OG_IMAGE = {
  url: "/og/luna-trading.png",
  width: 1200,
  height: 630,
  alt: "Luna Trading GmbH",
};

/** canonical + hreflang (with x-default → German) for a canonical route. */
export function alternatesFor(
  locale: Locale,
  path: string,
): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES)
    languages[LOCALE_META[l].htmlLang] = absolute(localePath(l, path));
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
      alternateLocale: LOCALES.filter((l) => l !== locale).map(
        (l) => LOCALE_META[l].og,
      ),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [OG_IMAGE.url],
    },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

/* ------------------------------------------------------------------ JSON-LD
 * Structured data: verified company facts and the site's own content only.
 * Deliberately no person (managing director), no ratings, reviews, founding
 * date, staff numbers, certifications, prices or social profiles.
 */
const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;
const pageUrl = (locale: Locale, path: string) =>
  absolute(localePath(locale, path)).replace(/^(https:\/\/[^/]+)\/$/, "$1");

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Luna Trading",
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
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: LEGAL_ENTITY.email,
    },
    brand: { "@type": "Brand", name: "LUVISCENT" },
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: absolute("/"),
    name: "Luna Trading",
    inLanguage: LOCALES.map((l) => LOCALE_META[l].htmlLang),
    publisher: { "@id": ORG_ID },
  };
}

/** Home → page, in the page's language. */
export function breadcrumbJsonLd(locale: Locale, path: string, name: string) {
  const d = getDictionary(locale);
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: d.nav.home,
        item: pageUrl(locale, "/"),
      },
      { "@type": "ListItem", position: 2, name, item: pageUrl(locale, path) },
    ],
  };
}

/** A service described on the page itself (name and description are the page's own copy). */
export function serviceJsonLd(
  locale: Locale,
  path: string,
  name: string,
  description: string,
  fragment?: string,
) {
  return {
    "@type": "Service",
    name,
    description: plainText(description),
    url: pageUrl(locale, path) + (fragment ? `#${fragment}` : ""),
    provider: { "@id": ORG_ID },
    inLanguage: LOCALE_META[locale].htmlLang,
  };
}

/** One <script type="application/ld+json"> payload holding several nodes. */
export function jsonLdGraph(nodes: object[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes,
  }).replace(/</g, "\\u003c");
}

/* ------------------------------------------------------- knowledge section */

/** Canonical + hreflang limited to the given languages (x-default → German, else the first). */
export function alternatesAmong(
  locale: Locale,
  paths: Partial<Record<Locale, string>>,
): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES)
    if (paths[l]) languages[LOCALE_META[l].htmlLang] = pageUrl(l, paths[l]!);
  const def = paths.de ? "de" : (LOCALES.find((l) => paths[l]) as Locale);
  languages["x-default"] = pageUrl(def, paths[def]!);
  return { canonical: pageUrl(locale, paths[locale]!), languages };
}

/** Metadata for the knowledge listing or an article (og:type article when dates are given). */
export function insightsMetadata(opts: {
  locale: Locale;
  paths: Partial<Record<Locale, string>>;
  title: string;
  description: string;
  image?: { url: string; alt: string };
  article?: { published: string; updated: string; section: string };
}): Metadata {
  const { locale, paths, title, description, image, article } = opts;
  const d = getDictionary(locale);
  const full = d.meta.titleTemplate.replace("%s", title);
  const url = pageUrl(locale, paths[locale]!);
  const images = image
    ? [{ url: absolute(image.url), width: 1600, height: 1195, alt: image.alt }]
    : [OG_IMAGE];
  return {
    title,
    description,
    alternates: alternatesAmong(locale, paths),
    openGraph: {
      type: article ? "article" : "website",
      url,
      siteName: "Luna Trading GmbH",
      title: full,
      description,
      locale: LOCALE_META[locale].og,
      images,
      ...(article
        ? {
            publishedTime: article.published,
            modifiedTime: article.updated,
            authors: ["Luna Trading"],
            section: article.section,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [images[0].url],
    },
  };
}

/** Breadcrumb with any number of levels after Home: [{ name, path }]. */
export function breadcrumbTrailJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[],
) {
  const d = getDictionary(locale);
  const all = [{ name: d.nav.home, path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: all.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      item: pageUrl(locale, x.path),
    })),
  };
}

export function articleJsonLd(o: {
  locale: Locale;
  path: string;
  headline: string;
  description: string;
  image: string;
  published: string;
  updated: string;
  section: string;
}) {
  const url = pageUrl(o.locale, o.path);
  return {
    "@type": "Article",
    headline: o.headline,
    description: plainText(o.description),
    image: [absolute(o.image)],
    datePublished: o.published,
    dateModified: o.updated,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    inLanguage: LOCALE_META[o.locale].htmlLang,
    articleSection: o.section,
    mainEntityOfPage: url,
    url,
  };
}

export function collectionJsonLd(
  locale: Locale,
  path: string,
  name: string,
  description: string,
  items: { name: string; path: string }[],
) {
  return {
    "@type": "CollectionPage",
    name,
    description,
    url: pageUrl(locale, path),
    inLanguage: LOCALE_META[locale].htmlLang,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.name,
        url: pageUrl(locale, x.path),
      })),
    },
  };
}
