/**
 * Règles d’indexation Explorer (PR1 SEO).
 *
 * Seule l’URL propre `/explorer` (sans query) est indexable.
 * Les filtres (`when`, `q`, `city`, `category`, `audience`, `from`, `to`, …)
 * restent utiles côté produit : canonical vers `/explorer` + noindex,follow.
 */

import type { Metadata } from "next";
import {
  EXPLORER_SEO,
  INDEX_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
} from "@/config/seo";

export function isExplorerIndexableSearchParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  for (const value of Object.values(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.some((entry) => entry !== "")) return false;
      continue;
    }
    if (value !== "") return false;
  }
  return true;
}

export function buildExplorerMetadata(
  params: Record<string, string | string[] | undefined>,
): Metadata {
  const indexable = isExplorerIndexableSearchParams(params);

  return {
    title: EXPLORER_SEO.title,
    description: EXPLORER_SEO.description,
    alternates: {
      canonical: EXPLORER_SEO.canonicalPath,
    },
    robots: indexable ? INDEX_ROBOTS : NOINDEX_FOLLOW_ROBOTS,
    openGraph: {
      title: EXPLORER_SEO.title,
      description: EXPLORER_SEO.description,
      url: EXPLORER_SEO.canonicalPath,
    },
  };
}
