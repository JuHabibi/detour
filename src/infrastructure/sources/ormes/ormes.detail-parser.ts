import {
  absoluteOrmesUrl,
  decodeHtmlEntities,
  slugFromEventUrl,
} from "./ormes.list-parser";
import type { OrmesDetail } from "./ormes.types";

/**
 * Parse une fiche Events Manager `/events/<slug>/`.
 * Fail-soft sur champs optionnels ; title / id requis côté mapper.
 */
export function parseOrmesDetail(html: string, pageUrl: string): OrmesDetail {
  const slug =
    slugFromEventUrl(pageUrl) ??
    slugFromEventUrl(
      metaContent(html, "og:url") ?? extractCanonical(html) ?? pageUrl,
    ) ??
    "unknown";

  const emId = html.match(/\bem-event-(\d+)\b/)?.[1] ?? null;
  const postId = html.match(/\bpostid-(\d+)\b/)?.[1] ?? null;
  const eventId = emId ?? postId ?? slug;

  const title =
    firstHeading(html) ??
    cleanTitle(metaContent(html, "og:title")) ??
    slug;

  const dateBlock = extractLabeledBlock(html, "Date/heure");
  const { dateStartLabel, dateEndLabel, startTime, endTime } =
    parseDateBlock(dateBlock);

  const venueBlock = extractLabeledBlock(html, "Emplacement");
  const venue = venueFromBlock(venueBlock);

  const categories = [
    ...html.matchAll(
      /<ul class="event-categories">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ].map((m) => collapseWs(decodeHtmlEntities(stripTags(m[1]!))));

  const coords = extractCoords(html);
  const imageUrl =
    pickEventImage(html) ?? metaContent(html, "og:image") ?? null;

  const bodyText = extractBodyText(html);
  const registrationUrl = findRegistrationUrl(html, pageUrl);
  const conditions = extractConditions(bodyText);

  return {
    eventId,
    slug,
    title: collapseWs(decodeHtmlEntities(title)),
    canonicalUrl: absoluteOrmesUrl(
      metaContent(html, "og:url") ?? extractCanonical(html) ?? pageUrl,
    ),
    bodyText,
    imageUrl,
    venue,
    categories: categories.filter(Boolean),
    latitude: coords.lat,
    longitude: coords.lng,
    registrationUrl,
    conditions,
    dateRaw: dateBlock,
    dateStartLabel,
    dateEndLabel,
    startTime,
    endTime,
  };
}

function parseDateBlock(block: string | null): {
  dateStartLabel: string | null;
  dateEndLabel: string | null;
  startTime: string | null;
  endTime: string | null;
} {
  if (!block) {
    return {
      dateStartLabel: null,
      dateEndLabel: null,
      startTime: null,
      endTime: null,
    };
  }

  const text = collapseWs(decodeHtmlEntities(stripTags(block)));
  // « Date(s) - 27 septembre 2026 » ou « Date(s) - 19 septembre 2026 - 17 juillet 2027 »
  const dates = text.match(
    /Date\(s\)\s*-\s*(\d{1,2}\s+\p{L}+\s+\d{4})(?:\s*-\s*(\d{1,2}\s+\p{L}+\s+\d{4}))?/u,
  );
  const times = text.match(
    /(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})/i,
  );

  return {
    dateStartLabel: dates?.[1] ?? null,
    dateEndLabel: dates?.[2] ?? null,
    startTime: times
      ? `${pad2(Number(times[1]))}:${times[2]}`
      : null,
    endTime: times
      ? `${pad2(Number(times[3]))}:${times[4]}`
      : null,
  };
}

function extractLabeledBlock(html: string, label: string): string | null {
  const re = new RegExp(
    `<p>\\s*<strong>${label}<\\/strong><br\\s*\\/?>([\\s\\S]*?)<\\/p>`,
    "i",
  );
  const match = html.match(re);
  return match?.[1]?.trim() ?? null;
}

function venueFromBlock(block: string | null): string | null {
  if (!block) return null;
  const link = block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  const raw = link?.[1] ?? block;
  const text = collapseWs(decodeHtmlEntities(stripTags(raw)));
  return text || null;
}

function extractCoords(html: string): { lat: number | null; lng: number | null } {
  const block = html.match(
    /em-location-map-coords[^>]*>[\s\S]*?<span class="lat">\s*([^<]+)\s*<\/span>[\s\S]*?<span class="lng">\s*([^<]+)\s*<\/span>/i,
  );
  if (!block) return { lat: null, lng: null };
  const lat = Number.parseFloat(block[1]!.trim());
  const lng = Number.parseFloat(block[2]!.trim());
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function pickEventImage(html: string): string | null {
  const eventBlock = html.match(
    /em-event-single[\s\S]{0,2500}?<img[^>]+src="([^"]+)"/i,
  );
  if (eventBlock?.[1] && !/logo|icon|avatar/i.test(eventBlock[1])) {
    return decodeHtmlEntities(eventBlock[1]);
  }
  return null;
}

function extractBodyText(html: string): string | null {
  const afterCats = html.match(
    /<ul class="event-categories">[\s\S]*?<\/ul>\s*<\/p>\s*<br[^>]*>\s*([\s\S]*?)(?:<\/div>\s*<div class="em |<footer\b|data-elementor-type="footer"|<\/body>)/i,
  );
  if (!afterCats) return null;
  const text = collapseWs(decodeHtmlEntities(stripTags(afterCats[1]!)));
  return text || null;
}

function findRegistrationUrl(html: string, pageUrl: string): string | null {
  const anchors = [
    ...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  ];
  for (const match of anchors) {
    const href = decodeHtmlEntities(match[1]!);
    const text = collapseWs(decodeHtmlEntities(stripTags(match[2]!)));
    const hay = `${href} ${text}`;
    if (/passeports|cartes.d.?identit/i.test(hay)) continue;
    if (/\/locations\//i.test(href)) continue;
    if (/ville-ormes\.fr\/vos-demarches\/reservations-en-ligne\/?$/i.test(href)) {
      continue;
    }
    if (
      /linscription\.com|helloasso\.com|billetweb|weezevent|digitick/i.test(
        href,
      ) ||
      (/r[ée]serv(er|ation)|billet|places?/i.test(text) &&
        /linscription|places-de-spectacles|booking|ticket/i.test(href))
    ) {
      return absoluteOrmesUrl(href, pageUrl);
    }
  }
  return null;
}

function extractConditions(bodyText: string | null): string | null {
  if (!bodyText) return null;
  if (/entr[ée]e offerte/i.test(bodyText)) return "Entrée offerte";
  if (/\bgratuit\b/i.test(bodyText)) return "Gratuit";
  const tarif = bodyText.match(/tarif[s]?\s*[:：]\s*([^.]{3,80})/i);
  return tarif ? collapseWs(tarif[1]!) : null;
}

function firstHeading(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? collapseWs(decodeHtmlEntities(stripTags(match[1]!))) : null;
}

function cleanTitle(value: string | null): string | null {
  if (!value) return null;
  return collapseWs(
    decodeHtmlEntities(value).replace(/\s*-\s*Ville d.Ormes.*$/i, ""),
  );
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property="${property}"[^>]+content="([^"]*)"`,
    "i",
  );
  const match = html.match(re);
  return match ? decodeHtmlEntities(match[1]!) : null;
}

function extractCanonical(html: string): string | null {
  const match = html.match(
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i,
  );
  return match ? decodeHtmlEntities(match[1]!) : null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
