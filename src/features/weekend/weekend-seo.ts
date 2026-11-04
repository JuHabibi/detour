import type { Metadata } from "next";
import type { PublicWeekendPage } from "@/application/weekend/get-public-weekend-page";
import {
  INDEX_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  SITE_OPEN_GRAPH,
  WEEKEND_SEO,
} from "@/config/seo";

export function buildWeekendMetadata(page: PublicWeekendPage): Metadata {
  const hasContent = page.events.length > 0;
  const description = hasContent
    ? `${WEEKEND_SEO.description} ${capitalize(page.weekendLabel)}.`
    : WEEKEND_SEO.emptyDescription;

  return {
    title: WEEKEND_SEO.title,
    description,
    robots: hasContent ? INDEX_ROBOTS : NOINDEX_FOLLOW_ROBOTS,
    alternates: { canonical: WEEKEND_SEO.canonicalPath },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      title: WEEKEND_SEO.title,
      description,
      url: WEEKEND_SEO.canonicalPath,
    },
    twitter: {
      card: "summary_large_image",
      title: WEEKEND_SEO.title,
      description,
    },
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
