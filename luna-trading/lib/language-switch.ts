import { localePath, type Locale } from "../content/i18n/config";

/**
 * Where the language selector leads from a page.
 *
 * `path` is the canonical path of the current page (e.g. "/what-we-do",
 * "/insights/<slug>"). Every regular page exists in every language, so the
 * switch keeps the page. In the knowledge section an article leads to its
 * translation; without one it leads to the listing in that language, and
 * without a section in that language to its homepage.
 *
 * `samePage` tells whether the target is the same page in another language.
 * Only then may the selector keep the scroll position: on a different page
 * (a fallback) the visitor must start at the top, otherwise they land in the
 * middle of an unrelated page, which looks as if the switch had failed.
 */
export function languageTarget(
  path: string,
  from: Locale,
  to: Locale,
  insights: readonly Locale[],
  insightSlugs: Record<string, Partial<Record<Locale, string>>>,
): { href: string; samePage: boolean } {
  if (path !== "/insights" && !path.startsWith("/insights/"))
    return { href: localePath(to, path), samePage: true };
  if (!insights.includes(to))
    return { href: localePath(to, "/"), samePage: false };
  const slug = path.slice("/insights/".length);
  if (!slug) return { href: localePath(to, "/insights"), samePage: true };
  const entry = Object.values(insightSlugs).find((m) => m[from] === slug);
  return entry?.[to]
    ? { href: localePath(to, `/insights/${entry[to]}`), samePage: true }
    : { href: localePath(to, "/insights"), samePage: false };
}
