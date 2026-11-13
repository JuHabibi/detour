import type { Metadata } from "next";
import type { PublicEventPageData } from "@/application/events/get-public-event-page";
import {
  INDEX_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  SITE_NAME,
  SITE_OPEN_GRAPH,
} from "@/config/seo";
import { eventPublicPath } from "@/lib/event-public-path";

const DESCRIPTION_MAX = 160;

/** Texte plat pour meta / affichage — pas de HTML brut. */
export function plainEventText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildEventSeoDescription(
  data: PublicEventPageData,
): string {
  const fromBody = plainEventText(data.item.description);
  if (fromBody) {
    if (fromBody.length <= DESCRIPTION_MAX) return fromBody;
    return `${fromBody.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
  }

  const when = data.item.dateLabel?.trim() || null;
  const city = data.item.city?.trim() || null;
  const parts = [data.item.title.trim()];
  if (when) parts.push(when);
  if (city) parts.push(city);
  return parts.join(" — ");
}

export function buildEventPageMetadata(
  data: PublicEventPageData,
): Metadata {
  const title = data.item.title.trim() || "Événement";
  const description = buildEventSeoDescription(data);
  const canonicalPath = eventPublicPath(data.eventId);
  const image = data.item.image?.trim() || null;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    robots: data.isEnded || data.item.occurrences?.length === 0 ? NOINDEX_FOLLOW_ROBOTS : INDEX_ROBOTS,
    openGraph: {
      ...SITE_OPEN_GRAPH,
      type: "website",
      title,
      description,
      url: canonicalPath,
      ...(image
        ? {
            images: [
              {
                url: image,
                alt: data.item.imageAlt?.trim() || title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${title} · ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
