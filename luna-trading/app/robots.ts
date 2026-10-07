import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { INDEXING_ENABLED, SITE_HOST, SITE_ORIGIN } from "@/lib/seo";

/**
 * Crawling is allowed only on the launched production host: SITE_INDEXING
 * must be "on" AND the request must come to luna-trading.de. Every other host
 * (luna-trading-preview.vercel.app, deployment URLs, localhost) is disallowed.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  if (!(INDEXING_ENABLED && host === SITE_HOST)) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_ORIGIN}/sitemap.xml`, host: SITE_ORIGIN };
}
