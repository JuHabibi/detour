import type { MetadataRoute } from "next";
import { listPublicEventSitemapEntries } from "@/application/events/list-public-event-sitemap-entries";
import { publicSitemapEntries } from "@/config/seo";
import { absoluteSiteUrl } from "@/config/site";
import { getCachedActiveEventSitemapRows } from "@/infrastructure/next-public-event-cache";

/**
 * Sitemap dynamique : le filtrage « non terminé » utilise l’horloge de la
 * requête (hors Data Cache). Une panne DB remonte — pas de corpus tronqué
 * présenté comme succès.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const homeUrl = absoluteSiteUrl("/");
  const staticEntries: MetadataRoute.Sitemap = publicSitemapEntries().map(
    (entry) => ({
      url: entry.url,
      changeFrequency: "daily" as const,
      priority: entry.url === homeUrl ? 1 : 0.8,
    }),
  );

  const rows = await getCachedActiveEventSitemapRows();
  const eventEntries: MetadataRoute.Sitemap =
    listPublicEventSitemapEntries(rows).map((entry) => ({
      url: entry.url,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  return [...staticEntries, ...eventEntries];
}
