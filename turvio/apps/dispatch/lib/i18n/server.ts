import { cookies } from "next/headers";
import { createT, LANG_COOKIE, resolveLocale, type Locale } from "./index";

/** The language for server-rendered output: the user's choice (cookie, kept in sync with their saved preference), else English. */
export async function serverLocale(): Promise<Locale> {
  const jar = await cookies();
  return resolveLocale(jar.get(LANG_COOKIE)?.value);
}

export async function serverT() {
  const locale = await serverLocale();
  return { locale, t: createT(locale) };
}
