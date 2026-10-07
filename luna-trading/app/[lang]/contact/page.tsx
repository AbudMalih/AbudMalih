import type { Metadata } from "next";
import ContactPage from "@/components/contact/ContactPage";
import { getDictionary, isLocale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).contactPage.meta;
  return pageMetadata({ locale: lang, path: "/contact", title: t.title, description: t.description });
}

export default function Page() {
  return <ContactPage />;
}
