import { wallTimeToIso } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type { IngreMediathequeListingSession } from "./ingre-mediatheque.types";

export const INGRE_MEDIATHEQUE_ORIGIN =
  "https://mediatheque-ludotheque.ingre.fr";

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const WEEKDAY =
  "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche";

const SESSION_DATE_RE = new RegExp(
  `Le\\s+(?:${WEEKDAY})\\s+(\\d{1,2})\\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\\s+(\\d{4})\\s+de\\s+(\\d{1,2})h(\\d{2})\\s+[àa]\\s+(\\d{1,2})h(\\d{2})`,
  "gi",
);

const NID_HREF_RE = /\/node\/content\/nid\/(\d+)/g;

/**
 * Extrait les séances datées du listing agenda Decalog.
 * Le NID est le dernier `/node/content/nid/{id}` précédé dans ~1500 caractères.
 *
 * Même `startKey` + même nid (HTML Dupliqué Decalog) → une seule séance.
 * Même `startKey` + nids différents → erreur (collision, pas d’association arbitraire).
 */
export function parseIngreMediathequeListing(
  html: string,
  options?: { origin?: string },
): IngreMediathequeListingSession[] {
  const origin = options?.origin ?? INGRE_MEDIATHEQUE_ORIGIN;
  const byStartKey = new Map<string, IngreMediathequeListingSession>();

  for (const match of html.matchAll(SESSION_DATE_RE)) {
    const dateRaw = match[0]!;
    const idx = match.index ?? 0;
    const before = html.slice(Math.max(0, idx - 1500), idx);
    const nidMatches = [...before.matchAll(NID_HREF_RE)];
    const nid = nidMatches.at(-1)?.[1];
    if (!nid) continue;

    const day = Number(match[1]);
    const month = MONTHS[match[2]!.toLowerCase()];
    const year = Number(match[3]);
    const startHour = Number(match[4]);
    const startMinute = Number(match[5]);
    const endHour = Number(match[6]);
    const endMinute = Number(match[7]);
    if (!month || !year || !day) continue;

    const startAt = wallTimeToIso({
      year,
      month,
      day,
      hour: startHour,
      minute: startMinute,
      second: 0,
      timeZone: "Europe/Paris",
    });
    const endAt = wallTimeToIso({
      year,
      month,
      day,
      hour: endHour,
      minute: endMinute,
      second: 0,
      timeZone: "Europe/Paris",
    });
    if (!startAt) continue;

    const startKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;

    const existing = byStartKey.get(startKey);
    if (existing) {
      if (existing.nid === nid) continue;
      throw new Error(
        `Ingré médiathèque listing startKey collision: ${startKey} → nids ${existing.nid} vs ${nid}`,
      );
    }

    const detailPath = `/node/content/nid/${nid}`;
    byStartKey.set(startKey, {
      nid,
      detailPath,
      detailUrl: `${origin.replace(/\/$/, "")}${detailPath}`,
      startKey,
      endAt,
      dateRaw,
    });
  }

  return [...byStartKey.values()];
}
