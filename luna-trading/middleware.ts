import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, SLUGS, isLocale, localePath, type Locale } from "@/content/i18n/config";

/**
 * Locale routing
 *  "/…"      German (rewritten internally to /de/…)
 *  "/en/…"   English, "/ar/…" Arabic
 *  "/de/…"   redirects to the unprefixed German URL
 * Opening the site always shows German: unprefixed URLs are German, with no
 * cookie or Accept-Language redirect. English and Arabic live under their
 * own prefixes and are one click away in the language selector.
 */
/** Localized slug → canonical route for this locale, or a redirect if a canonical path was requested. */
function route(req: NextRequest, locale: Locale, rest: string) {
  for (const [canon, map] of Object.entries(SLUGS)) {
    const slug = map[locale];
    const match = (p: string) => rest === p || rest.startsWith(p + "/");
    if (slug !== canon && match(canon)) {
      // old / canonical address → the localized one
      const url = req.nextUrl.clone();
      url.pathname = localePath(locale, canon + rest.slice(canon.length));
      return NextResponse.redirect(url, 308);
    }
    if (match(slug)) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}${canon}${rest.slice(slug.length)}`;
      return NextResponse.rewrite(url);
    }
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const seg = pathname.split("/")[1];

  if (seg === "de") {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/de/, "") || "/";
    return NextResponse.redirect(url, 308);
  }
  if (isLocale(seg)) {
    const rest = pathname.slice(seg.length + 1) || "/";
    return route(req, seg, rest) ?? NextResponse.next();
  }

  const localized = route(req, DEFAULT_LOCALE, pathname);
  if (localized) return localized;
  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|brand/|textures|sequences|icon|favicon|apple-touch-icon|site.webmanifest|robots.txt|sitemap.xml|.*\\.[a-z0-9]+$).*)"],
};
