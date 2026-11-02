import type { PublicEventPageData } from "@/application/events/get-public-event-page";
import { absoluteSiteUrl } from "@/config/site";
import { toParisDateKey } from "@/domain/time/when-filter";
import { plainEventText } from "@/features/event-page/event-page-seo";
import { eventPublicPath } from "@/lib/event-public-path";

export type EventJsonLd = {
  "@context": "https://schema.org";
  "@type": "Event";
  "@id": string;
  url: string;
  name: string;
  startDate: string;
  location: {
    "@type": "Place";
    name?: string;
    address?: {
      "@type": "PostalAddress";
      addressLocality: string;
    };
  };
  description?: string;
  endDate?: string;
  image?: string[];
};

/**
 * Construit un Event schema.org pour une fiche indexable non terminée.
 * Retourne null si titre, début valide ou localisation manquent — sans inventer
 * d’adresse complète, d’organisateur, d’offers ni de statut.
 *
 * Limite V1 : `PostalAddress` peut n’avoir que `addressLocality` (ville),
 * sans rue / code postal — les sources ne fournissent pas toujours plus.
 */
export function buildEventJsonLd(
  data: PublicEventPageData,
): EventJsonLd | null {
  if (data.isEnded) return null;

  const name = data.item.title?.trim() || "";
  if (!name) return null;

  const venue = data.item.venue?.trim() || "";
  const city = data.item.city?.trim() || "";
  if (!venue && !city) return null;

  const startDate = formatEventJsonLdStartDate(data);
  if (!startDate) return null;

  const canonicalPath = eventPublicPath(data.eventId);
  const url = absoluteSiteUrl(canonicalPath);
  const location: EventJsonLd["location"] = { "@type": "Place" };
  if (venue) location.name = venue;
  if (city) {
    location.address = {
      "@type": "PostalAddress",
      addressLocality: city,
    };
  }

  const jsonLd: EventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    url,
    name,
    startDate,
    location,
  };

  const description = plainEventText(data.item.description);
  if (description) jsonLd.description = description;

  const endDate = formatEventJsonLdEndDate(data);
  if (endDate) jsonLd.endDate = endDate;

  const image = resolveJsonLdImageUrl(data.item.image);
  if (image) jsonLd.image = [image];

  return jsonLd;
}

/** JSON-LD sûr dans un `<script>` : `<` → `\u003c` (bloque `</script>`). */
export function serializeJsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function formatEventJsonLdStartDate(
  data: PublicEventPageData,
): string | null {
  if (data.item.allDay) {
    const start = Date.parse(data.startAt);
    if (Number.isNaN(start)) return null;
    return toParisDateKey(new Date(start));
  }
  return formatTimedIso(data.startAt);
}

/**
 * All-day : `endAt` exclusif → dernier jour civil Paris **inclus**.
 * Horaire : ISO tel quel si `endAt` présent — pas d’heure inventée.
 */
export function formatEventJsonLdEndDate(
  data: Pick<PublicEventPageData, "startAt" | "endAt" | "item">,
): string | null {
  if (!data.endAt) return null;

  if (data.item.allDay) {
    return exclusiveEndAtToInclusiveParisDateKey(data.endAt);
  }
  return formatTimedIso(data.endAt);
}

/** Borne exclusive all-day → YYYY-MM-DD inclus (Europe/Paris). */
export function exclusiveEndAtToInclusiveParisDateKey(
  endAtIso: string,
): string | null {
  const endMs = Date.parse(endAtIso);
  if (Number.isNaN(endMs)) return null;
  const endKey = toParisDateKey(new Date(endMs));
  return shiftParisDateKey(endKey, -1);
}

function shiftParisDateKey(key: string, deltaDays: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Arithmétique civile (même approche que addParisDays du when-filter).
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = String(utc.getUTCFullYear()).padStart(4, "0");
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimedIso(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  // Conserve le littéral source s’il porte déjà un fuseau explicite.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(iso.trim())) return iso.trim();
  return new Date(ms).toISOString();
}

function resolveJsonLdImageUrl(image: string | undefined): string | undefined {
  const src = image?.trim();
  if (!src) return undefined;
  if (
    src.startsWith("/images/placeholders/") ||
    src.startsWith("/images/fallbacks/") ||
    src.startsWith("/placeholder/")
  ) {
    return undefined;
  }
  if (src.startsWith("https://") || src.startsWith("http://")) return src;
  return undefined;
}
