import type { Metadata } from "next";
import ServicesPage from "@/components/services/ServicesPage";
import { getDictionary, isLocale, LOCALES, LOCALE_META, localePath } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).services.meta;
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: localePath(lang, "/what-we-do"),
      languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, localePath(l, "/what-we-do")])),
    },
  };
}

export default function Page() {
  return <ServicesPage />;
}
