import type { Metadata } from "next";
import BrandsPage from "@/components/brands/BrandsPage";
import { getDictionary, isLocale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).brandsPage.meta;
  return pageMetadata({ locale: lang, path: "/brands", title: t.title, description: t.description });
}

export default function Page() {
  return <BrandsPage />;
}
