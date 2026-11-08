import type { Metadata } from "next";
import { getDictionary, isLocale } from "@/content/i18n";
import {
  jsonLdGraph,
  organizationJsonLd,
  websiteJsonLd,
  pageMetadata,
} from "@/lib/seo";
import Hero from "@/components/sections/Hero";
import HomeSections from "@/components/sections/HomeSections";
import Atmosphere from "@/components/chrome/Atmosphere";
import Loader from "@/components/chrome/Loader";
import GlobeLayer from "@/components/stage/GlobeLayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return pageMetadata({
    locale: lang,
    path: "/",
    description: getDictionary(lang).meta.description,
  });
}

/**
 * HOME: one cinematic opening (the globe over the port), then calm sections
 * in the site's style: what we do, the import lane, the e-commerce scene
 * (the one film chapter kept), LUVISCENT,
 * why Luna Trading, contact. The globe's Three.js code is an async chunk.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdGraph([organizationJsonLd(), websiteJsonLd()]),
        }}
      />
      <Atmosphere />
      <GlobeLayer />
      <Loader />
      <Hero />
      <HomeSections />
    </>
  );
}
