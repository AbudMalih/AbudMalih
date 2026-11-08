import type { Metadata } from "next";
import ImportPage from "@/components/import/ImportPage";
import { isLocale } from "@/content/i18n";
import { IMPORT_COPY } from "@/content/importPage";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  pageMetadata,
  serviceJsonLd,
} from "@/lib/seo";

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = IMPORT_COPY[lang].meta;
  return pageMetadata({
    locale: lang,
    path: "/import",
    title: t.title,
    description: t.description,
  });
}

export default async function Page({ params }: P) {
  const { lang } = await params;
  const ld = isLocale(lang)
    ? jsonLdGraph([
        breadcrumbJsonLd(lang, "/import", IMPORT_COPY[lang].meta.title),
        serviceJsonLd(
          lang,
          "/import",
          IMPORT_COPY[lang].meta.title,
          IMPORT_COPY[lang].meta.description,
        ),
      ])
    : null;
  return (
    <>
      {ld && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ld }}
        />
      )}
      <ImportPage />
    </>
  );
}
