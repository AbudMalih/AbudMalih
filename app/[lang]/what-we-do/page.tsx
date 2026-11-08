import type { Metadata } from "next";
import ServicesPage from "@/components/services/ServicesPage";
import { getDictionary, isLocale } from "@/content/i18n";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  pageMetadata,
  serviceJsonLd,
} from "@/lib/seo";

import type { ServiceId } from "@/content/i18n/services/types";

const SERVICE_IDS: ServiceId[] = [
  "sourcing",
  "trade",
  "development",
  "brand",
  "ecommerce",
  "distribution",
];

type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).services.meta;
  return pageMetadata({
    locale: lang,
    path: "/what-we-do",
    title: t.title,
    description: t.description,
  });
}

export default async function Page({ params }: P) {
  const { lang } = await params;
  const ld = isLocale(lang)
    ? jsonLdGraph([
        breadcrumbJsonLd(lang, "/what-we-do", getDictionary(lang).nav.whatWeDo),
        ...SERVICE_IDS.map((id) => {
          const c = getDictionary(lang).services.chapters[id];
          return serviceJsonLd(lang, "/what-we-do", c.title, c.body, id);
        }),
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
      <ServicesPage />
    </>
  );
}
