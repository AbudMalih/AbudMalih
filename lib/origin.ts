/* Dependency-free (safe for middleware / edge). Re-exported by lib/seo.ts. */
/**
 * The one public origin of the website. Every absolute URL in metadata,
 * canonical / hreflang, sitemap, robots and structured data is built from
 * it, so no preview or localhost address can leak into deployed output.
 */
export const SITE_ORIGIN = "https://luna-trading.de";
export const SITE_HOST = "luna-trading.de";

/**
 * Search indexing is OFF unless deliberately switched on for the launch:
 * the server-side environment variable SITE_INDEXING must be "on" (set in
 * Vercel for production when luna-trading.de goes live). Even then only the
 * luna-trading.de host is indexable (robots.txt / X-Robots-Tag check the
 * host), so *.vercel.app deployments never become the indexed site.
 */
export const INDEXING_ENABLED = process.env.SITE_INDEXING === "on";

export const absolute = (path: string) => `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
