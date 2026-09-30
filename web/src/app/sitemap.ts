import type { MetadataRoute } from "next";
import { getPublishedJobs } from "@/content/jobs";
import { imprint, privacyPolicy } from "@/content/legal";
import { site } from "@/content/site";

/** Indexable pages only. Legal placeholders stay out until their final text exists. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "monthly"],
    ["/unternehmen", 0.7, "yearly"],
    ["/leistungen", 0.8, "monthly"],
    ["/standorte", 0.7, "monthly"],
    ["/karriere", 0.9, "weekly"],
    ["/karriere/bewerben", 0.6, "monthly"],
    ["/karriere/initiativbewerbung", 0.6, "monthly"],
    ["/business", 0.8, "monthly"],
    ["/kontakt", 0.5, "yearly"],
    // Legal pages only once their final text is approved.
    ...(imprint.approved ? [["/impressum", 0.2, "yearly"] as [string, number, "yearly"]] : []),
    ...(privacyPolicy.approved ? [["/datenschutz", 0.2, "yearly"] as [string, number, "yearly"]] : []),
  ];
  return [
    ...pages.map(([path, priority, changeFrequency]) => ({ url: `${site.url}${path}`, priority, changeFrequency })),
    ...getPublishedJobs().map((j) => ({
      url: `${site.url}/karriere/jobs/${j.slug}`,
      lastModified: j.datePosted ? new Date(j.datePosted) : undefined,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
  ];
}
