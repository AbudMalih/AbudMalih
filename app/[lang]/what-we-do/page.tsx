import type { Metadata } from "next";
import ServicesPage from "@/components/services/ServicesPage";
import { getDictionary, isLocale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).services.meta;
  return pageMetadata({ locale: lang, path: "/what-we-do", title: t.title, description: t.description });
}

export default function Page() {
  return <ServicesPage />;
}
