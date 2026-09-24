import type { DetourEvent } from "@/domain/events/event";
import { wallTimeToIso } from "@/infrastructure/sources/saran/saran-ical.mapper";
import type {
  SjlbDetail,
  SjlbExclusion,
} from "./saint-jean-le-blanc.types";

export const SJLB_SOURCE_NAME = "Ville de Saint-Jean-le-Blanc";
export const SJLB_CITY = "Saint-Jean-le-Blanc";
export const SJLB_TIMEZONE = "Europe/Paris";

export type SjlbMapResult =
  | { ok: true; event: DetourEvent }
  | { ok: false; exclusion: SjlbExclusion };

/**
 * Mappe une fiche SJLB → DetourEvent.
 * Une seule occurrence = Infos pratiques Date (+ Horaires si présents).
 * Ne crée jamais d’occurrence supplémentaire depuis le texte libre.
 */
export function mapSjlbDetailToDetourEvent(detail: SjlbDetail): SjlbMapResult {
  if (!detail.resourceId) {
    return {
      ok: false,
      exclusion: {
        resourceId: null,
        detailPath: detail.detailPath,
        title: detail.title,
        reason: "missing_resource_id",
      },
    };
  }

  if (!detail.title.trim()) {
    return {
      ok: false,
      exclusion: {
        resourceId: detail.resourceId,
        detailPath: detail.detailPath,
        title: detail.title,
        reason: "missing_title",
      },
    };
  }

  const bounds = resolveEventBounds(detail);
  if (!bounds) {
    return {
      ok: false,
      exclusion: {
        resourceId: detail.resourceId,
        detailPath: detail.detailPath,
        title: detail.title,
        reason: "unparseable_date",
        detail: detail.dateRaw ?? undefined,
      },
    };
  }

  return {
    ok: true,
    event: {
      id: `saint-jean-le-blanc:${detail.resourceId}`,
      title: detail.title.trim(),
      description: detail.descriptionText,
      imageUrl: detail.imageUrl,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      ...(bounds.allDay ? { allDay: true as const } : {}),
      venue: detail.lieu,
      city: SJLB_CITY,
      latitude: null,
      longitude: null,
      category: detail.theme,
      genre: null,
      conditions: buildConditions(detail),
      source: SJLB_SOURCE_NAME,
      sourceUrl: detail.detailUrl,
      registrationUrl: detail.bookingUrl,
    },
  };
}

export function sjlbEventIntersectsWindow(
  event: DetourEvent,
  from: Date,
  to: Date,
): boolean {
  const start = Date.parse(event.startAt);
  if (Number.isNaN(start)) return false;
  const end = event.endAt ? Date.parse(event.endAt) : Number.NaN;
  const exclusiveEnd = Number.isNaN(end) ? start + 1 : end;
  return start < to.getTime() && exclusiveEnd > from.getTime();
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
};

function resolveEventBounds(detail: SjlbDetail): {
  startAt: string;
  endAt: string | null;
  allDay: boolean;
} | null {
  const date = parseFrSlashDate(detail.dateRaw);
  if (!date) return null;

  const times = parseHoraires(detail.horairesRaw);
  if (!times) {
    const startParts: WallParts = {
      ...date,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: SJLB_TIMEZONE,
    };
    const startAt = wallTimeToIso(startParts);
    if (!startAt) return null;
    const endParts: WallParts = {
      ...date,
      hour: 23,
      minute: 59,
      second: 59,
      timeZone: SJLB_TIMEZONE,
    };
    const endAt = wallTimeToIso(endParts);
    return { startAt, endAt, allDay: true };
  }

  const startParts: WallParts = {
    ...date,
    hour: times.startHour,
    minute: times.startMinute,
    second: 0,
    timeZone: SJLB_TIMEZONE,
  };
  const startAt = wallTimeToIso(startParts);
  if (!startAt) return null;

  let endAt: string | null = null;
  if (times.endHour != null && times.endMinute != null) {
    const endParts: WallParts = {
      ...date,
      hour: times.endHour,
      minute: times.endMinute,
      second: 0,
      timeZone: SJLB_TIMEZONE,
    };
    endAt = wallTimeToIso(endParts);
  }

  return { startAt, endAt, allDay: false };
}

/** jj/mm/aaaa uniquement — pas d’invention ; rejette les dates impossibles (ex. 31/02). */
export function parseFrSlashDate(
  raw: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Parse « 20H00 », « 8H45 », « 16H », éventuellement « 20H00-22H30 ».
 * Retourne null si absent / illisible — n’invente pas.
 */
export function parseHoraires(raw: string | null | undefined): {
  startHour: number;
  startMinute: number;
  endHour: number | null;
  endMinute: number | null;
} | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\s+/g, "");
  const re =
    /^(\d{1,2})[hH](\d{2})?(?:[-–—àa]+(\d{1,2})[hH](\d{2})?)?$/i;
  const m = normalized.match(re);
  if (!m) return null;
  const startHour = Number(m[1]);
  const startMinute = m[2] ? Number(m[2]) : 0;
  if (startHour > 23 || startMinute > 59) return null;

  let endHour: number | null = null;
  let endMinute: number | null = null;
  if (m[3] != null) {
    endHour = Number(m[3]);
    endMinute = m[4] ? Number(m[4]) : 0;
    if (endHour > 23 || endMinute > 59) return null;
  }

  return { startHour, startMinute, endHour, endMinute };
}

function buildConditions(detail: SjlbDetail): string | null {
  const parts: string[] = [];
  if (detail.horairesRaw) parts.push(`Horaires: ${detail.horairesRaw}`);
  if (detail.adresse) parts.push(`Adresse: ${detail.adresse}`);
  if (detail.organisateurMention) parts.push("Organisateur mentionné");
  return parts.length > 0 ? parts.join(" · ") : null;
}
