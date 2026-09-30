import type { MetadataRoute } from "next";
import { site } from "@/content/site";

/** Only routes with finished content are listed. Phase-2 pages are added when built. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.url}/`, changeFrequency: "monthly", priority: 1 }];
}
