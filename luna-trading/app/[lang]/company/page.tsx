import type { Metadata } from "next";
import CompanyPage from "@/components/company/CompanyPage";
import { getDictionary, isLocale, LOCALES, LOCALE_META, localePath } from "@/content/i18n";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).companyPage.meta;
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: localePath(lang, "/company"),
      languages: Object.fromEntries(LOCALES.map((l) => [LOCALE_META[l].htmlLang, localePath(l, "/company")])),
    },
  };
}

export default function Page() {
  return <CompanyPage />;
}
