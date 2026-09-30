import { breadcrumbJsonLd, jsonLdScript } from "@/lib/structured-data";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}

export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  return <JsonLd data={breadcrumbJsonLd(trail)} />;
}
