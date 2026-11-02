import type { MetadataRoute } from "next";
import { publicSitemapEntries } from "@/config/seo";
import { absoluteSiteUrl } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const homeUrl = absoluteSiteUrl("/");
  return publicSitemapEntries().map((entry) => ({
    url: entry.url,
    changeFrequency: "daily" as const,
    priority: entry.url === homeUrl ? 1 : 0.8,
  }));
}
