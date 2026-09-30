import type { Metadata } from "next";

/** Per-page metadata: title, description, canonical and a matching Open Graph block. */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "de_DE",
      siteName: "JARBOU Logistik GmbH",
      title: `${title} | JARBOU Logistik GmbH`,
      description,
      url: path,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "JARBOU Logistik GmbH" }],
    },
  };
}
