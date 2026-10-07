import type { Metadata } from "next";
import CompanyPage from "@/components/company/CompanyPage";
import { getDictionary, isLocale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).companyPage.meta;
  return pageMetadata({ locale: lang, path: "/company", title: t.title, description: t.description });
}

export default function Page() {
  return <CompanyPage />;
}
