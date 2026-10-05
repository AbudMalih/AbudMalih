import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/content/i18n/config";

/**
 * Locale routing
 *  "/…"      German (rewritten internally to /de/…)
 *  "/en/…"   English, "/ar/…" Arabic
 *  "/de/…"   redirects to the unprefixed German URL
 * Opening the site always shows German: unprefixed URLs are German, with no
 * cookie or Accept-Language redirect. English and Arabic live under their
 * own prefixes and are one click away in the language selector.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const seg = pathname.split("/")[1];

  if (seg === "de") {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/de/, "") || "/";
    return NextResponse.redirect(url, 308);
  }
  if (isLocale(seg)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|api|brand|textures|sequences|icon|favicon|apple-touch-icon|site.webmanifest|robots.txt|sitemap.xml|.*\\.[a-z0-9]+$).*)"],
};
