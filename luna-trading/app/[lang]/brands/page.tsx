import type { Metadata } from "next";
import BrandsPage from "@/components/brands/BrandsPage";
import { getDictionary, isLocale, LOCALES, LOCALE_META, localePath } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).brandsPage.meta;
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: localePath(lang, "/brands"),
      languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, localePath(l, "/brands")])),
    },
  };
}

export default function Page() {
  return <BrandsPage />;
}
