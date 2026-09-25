import type { IngreMediathequeRssItem } from "./ingre-mediatheque.types";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const ITEM_RE = /<item>([\s\S]*?)<\/item>/gi;

/**
 * Parse le RSS agenda Decalog Ingré.
 * Contrat vérifié : `pubDate` = début de séance (pas la date de publication HTML).
 */
export function parseIngreMediathequeRss(xml: string): IngreMediathequeRssItem[] {
  const items: IngreMediathequeRssItem[] = [];

  for (const match of xml.matchAll(ITEM_RE)) {
    const block = match[1] ?? "";
    const title = decodeRssText(
      extractTag(block, "title") ?? "",
    ).trim();
    const descriptionRaw = extractTag(block, "description");
    const description = descriptionRaw
      ? stripHtml(decodeRssText(descriptionRaw)).trim() || null
      : null;
    const pubDateRaw = (extractTag(block, "pubDate") ?? "").trim();
    const startAt = parseRssPubDateToIso(pubDateRaw);
    if (!startAt) {
      items.push({
        title,
        description,
        pubDateRaw,
        startAt: "",
        startKey: "",
      });
      continue;
    }
    items.push({
      title,
      description,
      pubDateRaw,
      startAt,
      startKey: startKeyFromIso(startAt),
    });
  }

  return items;
}

export function parseRssPubDateToIso(pubDate: string): string | null {
  const m = pubDate.match(
    /^[A-Za-z]{3},\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{2})(\d{2})$/,
  );
  if (!m) return null;

  const day = Number(m[1]);
  const month = MONTHS[m[2]!.toLowerCase()];
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (!month || !year || !day) return null;

  const offsetHours = Number(m[7]);
  const offsetMinutes = Number(m[8]);
  if (
    !Number.isFinite(offsetHours) ||
    !Number.isFinite(offsetMinutes) ||
    Math.abs(offsetHours) > 14 ||
    offsetMinutes > 59
  ) {
    return null;
  }

  // Offset explicite dans le flux → ISO direct (pas d’invention de TZ).
  const sign = m[7]!.startsWith("-") ? "-" : "+";
  const absH = String(Math.abs(offsetHours)).padStart(2, "0");
  const absM = String(offsetMinutes).padStart(2, "0");
  const y = String(year).padStart(4, "0");
  const mo = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  const s = String(second).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${absH}:${absM}`;
}

/** Clé de jointure murale (composants locaux de l’ISO offsetté). */
export function startKeyFromIso(iso: string): string {
  const m = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  );
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}

function extractTag(block: string, tag: string): string | null {
  const cdata = block.match(
    new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"),
  );
  if (cdata) return cdata[1] ?? null;
  const plain = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return plain?.[1] ?? null;
}

function decodeRssText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&agrave;/gi, "à")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&rsquo;/gi, "'")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCharCode(Number(n)),
    );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
