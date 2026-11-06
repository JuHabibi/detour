import type { Metadata } from "next";
import {
  CONFIDENTIALITE_SEO,
  MENTIONS_LEGALES_SEO,
} from "@/config/legal";
import { INDEX_ROBOTS, SITE_OPEN_GRAPH } from "@/config/seo";

function buildLegalMetadata(page: {
  title: string;
  description: string;
  canonicalPath: string;
}): Metadata {
  return {
    title: page.title,
    description: page.description,
    robots: INDEX_ROBOTS,
    alternates: { canonical: page.canonicalPath },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      title: page.title,
      description: page.description,
      url: page.canonicalPath,
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description,
    },
  };
}

export function buildMentionsLegalesMetadata(): Metadata {
  return buildLegalMetadata(MENTIONS_LEGALES_SEO);
}

export function buildConfidentialiteMetadata(): Metadata {
  return buildLegalMetadata(CONFIDENTIALITE_SEO);
}
