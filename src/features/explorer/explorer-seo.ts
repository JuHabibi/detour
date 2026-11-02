/**
 * Règles d’indexation Explorer (PR1 SEO).
 *
 * Indexable : URL propre, ou query limitée aux paramètres de suivi
 * (utm_*, gclid, …) — le contenu reste celui des défauts Explorer.
 * Filtres / recherche qui modifient le contenu : noindex,follow, sans
 * canonical vers `/explorer`.
 */

import type { Metadata } from "next";
import {
  EXPLORER_SEO,
  INDEX_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  SITE_OPEN_GRAPH,
} from "@/config/seo";
import {
  parseExplorerUrlState,
  serializeExplorerUrlState,
} from "@/features/explorer/explorer-url-state";

export function isExplorerIndexableSearchParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  return serializeExplorerUrlState(parseExplorerUrlState(params)) === "";
}

export function buildExplorerMetadata(
  params: Record<string, string | string[] | undefined>,
): Metadata {
  const indexable = isExplorerIndexableSearchParams(params);

  const metadata: Metadata = {
    title: EXPLORER_SEO.title,
    description: EXPLORER_SEO.description,
    robots: indexable ? INDEX_ROBOTS : NOINDEX_FOLLOW_ROBOTS,
    openGraph: {
      ...SITE_OPEN_GRAPH,
      title: EXPLORER_SEO.title,
      description: EXPLORER_SEO.description,
      ...(indexable ? { url: EXPLORER_SEO.canonicalPath } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: EXPLORER_SEO.title,
      description: EXPLORER_SEO.description,
    },
  };

  if (indexable) {
    metadata.alternates = { canonical: EXPLORER_SEO.canonicalPath };
  }

  return metadata;
}
