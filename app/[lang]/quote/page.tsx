import type { Metadata } from "next";
import QuotePage from "@/components/quote/QuotePage";
import { isLocale } from "@/content/i18n";
import { QUOTE_COPY } from "@/content/quotePage";
import { pageMetadata } from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = QUOTE_COPY[lang].meta;
  return pageMetadata({ locale: lang, path: "/quote", title: t.title, description: t.description });
}

export default function Page() {
  return <QuotePage />;
}
