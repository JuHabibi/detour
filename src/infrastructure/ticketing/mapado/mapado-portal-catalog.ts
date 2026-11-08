import { normalizeMapadoMatchText } from "@/infrastructure/ticketing/mapado/mapado-title-normalize";

export type MapadoCatalogEntry = {
  path: string;
  /** URL absolue dérivée de `portalUrl` + path. */
  eventUrl: string;
  ticketingId: string;
  title: string;
  /** Jour calendaire YYYY-MM-DD (Europe/Paris / label FR portail). */
  day: string;
  dateLabel: string | null;
};

const MONTHS: Record<string, number> = {
  janv: 1,
  janvier: 1,
  fevr: 2,
  fevrier: 2,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  juillet: 7,
  aout: 8,
  sept: 9,
  septembre: 9,
  oct: 10,
  octobre: 10,
  nov: 11,
  novembre: 11,
  dec: 12,
  decembre: 12,
};

/** Ancien markup (TicketingItem) et markup actuel (mpd-card / styled-components). */
const EVENT_ANCHOR_RE =
  /<a\b[^>]*\bhref="(\/event\/\d+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

export type ParseMapadoPortalCatalogOptions = {
  /** Titres SSR locaux à ignorer (fournis par le tenant). */
  ignoredCatalogTitles?: readonly string[];
};

/**
 * Parse le catalogue SSR du portail Mapado (cartes événement).
 * `portalUrl` sert à résoudre les URLs événement ; le matching reste sur path/titre/jour.
 * Ne lit pas availabilityStatus ici (trop ambigu sur la home).
 */
export function parseMapadoPortalCatalog(
  html: string,
  portalUrl: string,
  options?: ParseMapadoPortalCatalogOptions,
): MapadoCatalogEntry[] {
  if (!html.includes("/event/")) {
    return [];
  }

  const ignoredCatalogTitles = options?.ignoredCatalogTitles ?? [];
  const entries: MapadoCatalogEntry[] = [];
  const seenPaths = new Set<string>();

  for (const match of html.matchAll(EVENT_ANCHOR_RE)) {
    const path = match[1];
    const body = match[2] ?? "";
    if (!path || seenPaths.has(path)) continue;

    const idMatch = /^\/event\/(\d+)-/.exec(path);
    if (!idMatch) continue;

    const dateMatch = /((?:Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\.[^<]{5,80}\d{4}[^<]{0,50})/.exec(
      body,
    );
    const dateLabel = dateMatch
      ? decodeHtmlEntities(dateMatch[1]!.trim())
      : null;
    const day = parseFrenchPortalDay(dateLabel);
    if (!day) continue;

    const title = extractCardTitle(body, ignoredCatalogTitles);
    if (!title) continue;

    seenPaths.add(path);
    entries.push({
      path,
      eventUrl: new URL(path, portalUrl).toString(),
      ticketingId: idMatch[1]!,
      title,
      day,
      dateLabel,
    });
  }

  return entries;
}

export function parseFrenchPortalDay(
  label: string | null | undefined,
): string | null {
  if (!label) return null;
  const match = /(\d{1,2})\s+([A-Za-zéûôà.]+)\s+(\d{4})/.exec(label);
  if (!match) return null;

  const day = Number(match[1]);
  const year = Number(match[3]);
  const monthRaw = match[2]!
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .toLowerCase();
  const month =
    MONTHS[monthRaw] ??
    MONTHS[
      Object.keys(MONTHS).find((key) => monthRaw.startsWith(key.slice(0, 4))) ??
        ""
    ];

  if (!month || !day || !year) return null;
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/** Bruits SSR génériques Mapado (badges billetterie / lieux non-titre). */
const GENERIC_IGNORED_CATALOG_TITLES = [
  "ESPACE GEORGE SAND",
  "- SALLE MOLIERE",
  "Complet sur Internet",
  "Complet",
] as const;

function extractCardTitle(
  body: string,
  ignoredCatalogTitles: readonly string[],
): string | null {
  const h3Match = /<h3\b[^>]*>([^<]{2,120})<\/h3>/i.exec(body);
  if (h3Match) {
    const h3Title = decodeHtmlEntities(h3Match[1]!.trim());
    if (h3Title && normalizeMapadoMatchText(h3Title)) {
      return h3Title;
    }
  }

  const texts = [...body.slice(0, 1400).matchAll(/>([^<]{2,120})</g)]
    .map((m) => decodeHtmlEntities(m[1]!.trim()))
    .filter(Boolean);

  const skip = new Set<string>([
    ...GENERIC_IGNORED_CATALOG_TITLES,
    ...ignoredCatalogTitles,
  ]);

  for (const text of texts) {
    if (skip.has(text)) continue;
    if (/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\./.test(text)) continue;
    if (text.startsWith("- ")) continue;
    if (!normalizeMapadoMatchText(text)) continue;
    return text;
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
