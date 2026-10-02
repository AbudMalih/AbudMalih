import type { MetadataRoute } from "next";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/what-we-do", "/brands", "/company", "/contact"].map((p) => ({ url: `${SITE}${p}`, changeFrequency: "monthly" }));
}
