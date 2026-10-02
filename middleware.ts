import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/content/i18n/config";

/**
 * Locale routing
 *  "/…"      German (rewritten internally to /de/…)
 *  "/en/…"   English, "/ar/…" Arabic
 *  "/de/…"   redirects to the unprefixed German URL
 * A language the visitor picked explicitly (cookie) is respected on
 * unprefixed URLs. There is no Accept-Language auto-detection: German is
 * the default and an explicit choice is never overridden.
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

  const chosen = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen) && chosen !== DEFAULT_LOCALE) {
    const url = req.nextUrl.clone();
    url.pathname = `/${chosen}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, 307);
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|api|brand|textures|sequences|icon|favicon|robots.txt|sitemap.xml|.*\\.[a-z0-9]+$).*)"],
};
