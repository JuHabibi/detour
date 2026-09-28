import type { EventItem } from "@/data/types";

/** Fenêtre macro affichée (mois civils Paris). */
export const EXPLORER_FRIEZE_WINDOW_MONTHS = 3;
/** Page fetch pour la frise (plafond API Explorer). */
export const EXPLORER_FRIEZE_PAGE_SIZE = 50;
/** Plafond dur cumulé (pagination client) — explicite pour le prototype. */
export const EXPLORER_FRIEZE_HARD_CAP = 150;
/** Au-delà, le jour se regroupe (ouvrable). */
export const EXPLORER_FRIEZE_DAY_PREVIEW = 2;

export type ExplorerFriezeWindow = {
  /** Premier jour inclus YYYY-MM-DD (Europe/Paris). */
  fromKey: string;
  /** Dernier jour inclus YYYY-MM-DD. */
  toKey: string;
  label: string;
};

export type ExplorerFriezeQuietGap = {
  kind: "quiet";
  id: string;
  fromKey: string;
  toKey: string;
  dayCount: number;
  label: string;
};

export type ExplorerFriezeDayCluster = {
  kind: "day";
  id: string;
  dateKey: string;
  weekdayLabel: string;
  dayNumber: string;
  monthShort: string;
  events: EventItem[];
};

export type ExplorerFriezeMonthChapter = {
  kind: "month";
  id: string;
  monthKey: string;
  title: string;
  yearLabel: string;
  items: Array<ExplorerFriezeQuietGap | ExplorerFriezeDayCluster>;
};

/** État de couverture pour la fenêtre / catégorie affichées. */
export type FriseCoverageStatus =
  | "pending"
  | "complete"
  | "truncated"
  | "error";

export type FriseSettledScope = {
  from: string;
  to: string;
  category: string;
  status: Exclude<FriseCoverageStatus, "pending">;
};

export type ExplorerFriezeModel = {
  window: ExplorerFriezeWindow;
  chapters: ExplorerFriezeMonthChapter[];
  /** Événements dont le début tombe dans la fenêtre. */
  eventCountInWindow: number;
  /** Total reçu du fetch (peut dépasser la fenêtre). */
  fetchedCount: number;
  hardCap: number;
  truncatedByCap: boolean;
  /**
   * Alignement données ↔ fenêtre affichée.
   * `complete` : seule valeur qui autorise « Aucune sortie ».
   */
  coverageStatus: FriseCoverageStatus;
};

/**
 * Associe la vue (fenêtre + catégorie) aux données déjà réglées.
 * Évite d’interpréter d’anciens événements comme un vide du nouveau trimestre.
 */
export function resolveFriseCoverageStatus(params: {
  viewFrom: string;
  viewTo: string;
  viewCategory: string;
  settled: FriseSettledScope | null;
}): FriseCoverageStatus {
  const { settled } = params;
  if (
    settled &&
    settled.from === params.viewFrom &&
    settled.to === params.viewTo &&
    settled.category === params.viewCategory
  ) {
    return settled.status;
  }
  return "pending";
}

function emptyMonthLabel(status: FriseCoverageStatus): string | null {
  if (status === "complete") return "Aucune sortie ce mois-ci";
  if (status === "truncated") return "Couverture incomplète pour ce mois";
  return null;
}

function parisParts(isoOrKey: string): {
  year: string;
  month: string;
  day: string;
  weekday: string;
  monthLong: string;
  monthShort: string;
} | null {
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey)
      ? new Date(`${isoOrKey}T12:00:00+02:00`)
      : new Date(isoOrKey);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);

  const shortParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    month: "short",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const monthLong = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const monthShort = (
    shortParts.find((p) => p.type === "month")?.value ?? ""
  ).replace(/\u202f/g, " ").trim();

  const keyParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = keyParts.find((p) => p.type === "year")?.value ?? "";
  const m = keyParts.find((p) => p.type === "month")?.value ?? "";
  const d = keyParts.find((p) => p.type === "day")?.value ?? "";

  return {
    year: y || year,
    month: m,
    day: d || day,
    weekday,
    monthLong,
    monthShort,
  };
}

export function toParisDateKey(iso: string): string | null {
  const p = parisParts(iso);
  if (!p?.year || !p.month || !p.day) return null;
  return `${p.year}-${p.month}-${p.day}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function addParisMonths(fromKey: string, months: number): string {
  const [y, m] = fromKey.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function lastDayOfParisMonth(year: number, month: number): number {
  // Midi UTC approx OK for civil last day via Date.UTC trick
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function endKeyOfMonth(monthStartKey: string): string {
  const [y, m] = monthStartKey.split("-").map(Number);
  const last = lastDayOfParisMonth(y, m);
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T12:00:00.000Z`);
  const b = Date.parse(`${toKey}T12:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

function addDaysToKey(key: string, days: number): string {
  const ms = Date.parse(`${key}T12:00:00.000Z`) + days * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Insère des respirations calmes, découpées aux frontières de mois. */
function pushQuietRange(
  ensureChapter: (monthKey: string) => ExplorerFriezeMonthChapter,
  fromKey: string,
  toKey: string,
) {
  if (compareKeys(fromKey, toKey) > 0) return;
  let cursor = fromKey;
  while (compareKeys(cursor, toKey) <= 0) {
    const monthKey = cursor.slice(0, 7);
    const monthEnd = endKeyOfMonth(`${monthKey}-01`);
    const segmentEnd = compareKeys(monthEnd, toKey) < 0 ? monthEnd : toKey;
    const dayCount = daysBetweenKeys(cursor, segmentEnd) + 1;
    if (dayCount >= 1) {
      const chapter = ensureChapter(monthKey);
      const fromP = parisParts(cursor);
      const toP = parisParts(segmentEnd);
      chapter.items.push({
        kind: "quiet",
        id: `quiet-${cursor}-${segmentEnd}`,
        fromKey: cursor,
        toKey: segmentEnd,
        dayCount,
        label:
          dayCount === 1
            ? `Respiration · ${fromP?.day ?? ""} ${fromP?.monthShort ?? ""}`
            : `Respiration · ${fromP?.day ?? ""}–${toP?.day ?? ""} ${toP?.monthShort ?? ""}`,
      });
    }
    cursor = addDaysToKey(segmentEnd, 1);
  }
}

/** Ancre = 1er jour du mois civil Paris contenant `now`. */
export function resolveFriezeWindow(
  anchorMonthStartKey: string,
  windowMonths = EXPLORER_FRIEZE_WINDOW_MONTHS,
): ExplorerFriezeWindow {
  const fromKey = anchorMonthStartKey.endsWith("-01")
    ? anchorMonthStartKey
    : `${anchorMonthStartKey.slice(0, 7)}-01`;
  const lastMonthStart = addParisMonths(fromKey, windowMonths - 1);
  const toKey = endKeyOfMonth(lastMonthStart);
  const fromP = parisParts(fromKey);
  const toP = parisParts(toKey);
  const sameYear = fromP?.year === toP?.year;
  const label = sameYear
    ? `${capitalize(fromP?.monthLong ?? "")} – ${capitalize(toP?.monthLong ?? "")} ${fromP?.year ?? ""}`
    : `${capitalize(fromP?.monthLong ?? "")} ${fromP?.year ?? ""} – ${capitalize(toP?.monthLong ?? "")} ${toP?.year ?? ""}`;

  return { fromKey, toKey, label: label.trim() };
}

export function parisMonthStartKey(now = new Date()): string {
  const key = toParisDateKey(now.toISOString());
  if (!key) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  return `${key.slice(0, 7)}-01`;
}

/**
 * Construit la frise à partir d’événements déjà chargés.
 * Ne crée aucun événement ; les jours calmes n’apparaissent que comme
 * respirations entre clusters (pas une grille jour par jour).
 */
export function buildExplorerFrieze(params: {
  events: EventItem[];
  window: ExplorerFriezeWindow;
  fetchedCount: number;
  truncatedByCap: boolean;
  /** Défaut `complete` pour les tests / appels legacy explicites. */
  coverageStatus?: FriseCoverageStatus;
}): ExplorerFriezeModel {
  const { window, fetchedCount, truncatedByCap } = params;
  const coverageStatus = params.coverageStatus ?? "complete";
  const emptyLabel = emptyMonthLabel(coverageStatus);

  const inWindow: EventItem[] = [];
  for (const event of params.events) {
    const key = toParisDateKey(event.startAt || `${event.date}T12:00:00`);
    if (!key) continue;
    if (compareKeys(key, window.fromKey) < 0) continue;
    if (compareKeys(key, window.toKey) > 0) continue;
    inWindow.push(event);
  }

  inWindow.sort((a, b) => {
    const ka = toParisDateKey(a.startAt || a.date) ?? "";
    const kb = toParisDateKey(b.startAt || b.date) ?? "";
    if (ka !== kb) return compareKeys(ka, kb);
    return a.id.localeCompare(b.id);
  });

  const byDay = new Map<string, EventItem[]>();
  for (const event of inWindow) {
    const key = toParisDateKey(event.startAt || event.date);
    if (!key) continue;
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }

  const dayKeys = [...byDay.keys()].sort(compareKeys);
  const chapters: ExplorerFriezeMonthChapter[] = [];

  let cursor = window.fromKey;
  let dayIndex = 0;

  const ensureChapter = (monthKey: string): ExplorerFriezeMonthChapter => {
    let chapter = chapters.find((c) => c.monthKey === monthKey);
    if (!chapter) {
      const start = `${monthKey}-01`;
      const p = parisParts(start);
      chapter = {
        kind: "month",
        id: `month-${monthKey}`,
        monthKey,
        title: capitalize(p?.monthLong ?? monthKey),
        yearLabel: p?.year ?? "",
        items: [],
      };
      chapters.push(chapter);
    }
    return chapter;
  };

  while (dayIndex < dayKeys.length) {
    const dateKey = dayKeys[dayIndex]!;
    if (compareKeys(dateKey, cursor) > 0) {
      const gapEnd = addDaysToKey(dateKey, -1);
      if (compareKeys(gapEnd, cursor) >= 0) {
        pushQuietRange(ensureChapter, cursor, gapEnd);
      }
    }

    const p = parisParts(dateKey);
    const monthKey = dateKey.slice(0, 7);
    const chapter = ensureChapter(monthKey);
    chapter.items.push({
      kind: "day",
      id: `day-${dateKey}`,
      dateKey,
      weekdayLabel: capitalize(p?.weekday ?? ""),
      dayNumber: p?.day ?? "",
      monthShort: p?.monthShort ?? "",
      events: byDay.get(dateKey) ?? [],
    });

    cursor = addDaysToKey(dateKey, 1);
    dayIndex += 1;
  }

  if (compareKeys(cursor, window.toKey) <= 0) {
    pushQuietRange(ensureChapter, cursor, window.toKey);
  }

  // Garantit un chapitre par mois civil de la fenêtre (y compris totalement calmes).
  {
    let monthStart = `${window.fromKey.slice(0, 7)}-01`;
    const endMonth = `${window.toKey.slice(0, 7)}-01`;
    const ensured: ExplorerFriezeMonthChapter[] = [];
    while (compareKeys(monthStart, endMonth) <= 0) {
      const monthKey = monthStart.slice(0, 7);
      const existing = chapters.find((c) => c.monthKey === monthKey);
      if (existing) {
        const hasDay = existing.items.some((i) => i.kind === "day");
        if (
          !hasDay &&
          existing.items.length > 0 &&
          existing.items.every((i) => i.kind === "quiet")
        ) {
          if (emptyLabel) {
            existing.items = [
              {
                kind: "quiet",
                id: `quiet-empty-${monthKey}`,
                fromKey: monthStart,
                toKey: endKeyOfMonth(monthStart),
                dayCount:
                  daysBetweenKeys(monthStart, endKeyOfMonth(monthStart)) + 1,
                label: emptyLabel,
              },
            ];
          } else {
            // pending / error : pas de faux « Aucune sortie ».
            existing.items = [];
          }
        }
        ensured.push(existing);
      } else if (emptyLabel) {
        const p = parisParts(monthStart);
        const monthEnd = endKeyOfMonth(monthStart);
        ensured.push({
          kind: "month",
          id: `month-${monthKey}`,
          monthKey,
          title: capitalize(p?.monthLong ?? ""),
          yearLabel: p?.year ?? "",
          items: [
            {
              kind: "quiet",
              id: `quiet-empty-${monthKey}`,
              fromKey: monthStart,
              toKey: monthEnd,
              dayCount: daysBetweenKeys(monthStart, monthEnd) + 1,
              label: emptyLabel,
            },
          ],
        });
      } else {
        const p = parisParts(monthStart);
        ensured.push({
          kind: "month",
          id: `month-${monthKey}`,
          monthKey,
          title: capitalize(p?.monthLong ?? ""),
          yearLabel: p?.year ?? "",
          items: [],
        });
      }
      monthStart = addParisMonths(monthStart, 1);
    }
    chapters.length = 0;
    chapters.push(...ensured);
  }

  return {
    window,
    chapters,
    eventCountInWindow: inWindow.length,
    fetchedCount,
    hardCap: EXPLORER_FRIEZE_HARD_CAP,
    truncatedByCap,
    coverageStatus,
  };
}

export function shiftFriezeAnchor(
  anchorMonthStartKey: string,
  deltaMonths: number,
): string {
  return addParisMonths(
    anchorMonthStartKey.endsWith("-01")
      ? anchorMonthStartKey
      : `${anchorMonthStartKey.slice(0, 7)}-01`,
    deltaMonths,
  );
}
