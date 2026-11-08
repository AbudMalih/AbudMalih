import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

/** The 404 has its own title in the server HTML (not the homepage title) and is never indexed. */
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return { robots: { index: false, follow: true } };
  const d = getDictionary(lang);
  return {
    title: {
      absolute: d.meta.titleTemplate.replace("%s", d.pages.notFound.eyebrow),
    },
    robots: { index: false, follow: true },
  };
}

/** Any unknown path inside a locale renders the localized not-found page. */
export default function CatchAll() {
  notFound();
}
