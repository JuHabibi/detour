import type { DetourEvent } from "@/domain/events/event";
import {
  V1_COMMUNES,
  matchV1Commune,
  normalizeCityKey,
  type V1Commune,
} from "@/domain/geo/v1-communes";

export {
  V1_COMMUNES,
  matchV1Commune,
  normalizeCityKey,
  type V1Commune,
};

export type CityCoverageLevel = "good" | "weak" | "none";

export type CityCoverageRow = {
  commune: V1Commune;
  events: number;
  sources: number;
  topSources: string[];
  withImage: number;
  withBooking: number;
  withCoords: number;
  topCategories: string[];
  firstStartAt: string | null;
  lastStartAt: string | null;
  coverage: CityCoverageLevel;
  /** Variantes brutes vues dans le corpus pour cette commune. */
  rawCityVariants: string[];
};

export type V1CityCoverageReport = {
  windowDays: number;
  from: string;
  to: string;
  totalEventsInCorpus: number;
  totalEventsOnV1: number;
  distinctSourcesOnV1: number;
  communesNone: V1Commune[];
  communesWeak: V1Commune[];
  communesGood: V1Commune[];
  rows: CityCoverageRow[];
  /** Villes hors périmètre V1 (top) — info debug. */
  outsideV1Top: Array<{ city: string; events: number }>;
};

export function coverageLevel(eventCount: number): CityCoverageLevel {
  if (eventCount <= 0) return "none";
  if (eventCount <= 5) return "weak";
  return "good";
}

/**
 * Audit de couverture géographique V1 — debug uniquement.
 * Ne pilote aucune logique produit.
 */
export function buildV1CityCoverageReport(params: {
  events: DetourEvent[];
  from: Date;
  to: Date;
  windowDays?: number;
  topSourcesLimit?: number;
  topCategoriesLimit?: number;
}): V1CityCoverageReport {
  const topSourcesLimit = params.topSourcesLimit ?? 3;
  const topCategoriesLimit = params.topCategoriesLimit ?? 3;

  type Acc = {
    events: DetourEvent[];
    sources: Map<string, number>;
    categories: Map<string, number>;
    rawCities: Set<string>;
  };

  const byCommune = new Map<V1Commune, Acc>();
  for (const commune of V1_COMMUNES) {
    byCommune.set(commune, {
      events: [],
      sources: new Map(),
      categories: new Map(),
      rawCities: new Set(),
    });
  }

  const outside = new Map<string, number>();
  const v1Sources = new Set<string>();

  for (const event of params.events) {
    const matched = matchV1Commune(event.city);
    if (!matched) {
      const label = event.city?.trim() || "(sans ville)";
      outside.set(label, (outside.get(label) ?? 0) + 1);
      continue;
    }

    const acc = byCommune.get(matched)!;
    acc.events.push(event);
    if (event.city?.trim()) acc.rawCities.add(event.city.trim());

    const source = event.source?.trim();
    if (source) {
      acc.sources.set(source, (acc.sources.get(source) ?? 0) + 1);
      v1Sources.add(source);
    }

    const category = event.category?.trim();
    if (category) {
      acc.categories.set(category, (acc.categories.get(category) ?? 0) + 1);
    }
  }

  const rows: CityCoverageRow[] = V1_COMMUNES.map((commune) => {
    const acc = byCommune.get(commune)!;
    const starts = acc.events
      .map((event) => event.startAt)
      .filter(Boolean)
      .sort();

    return {
      commune,
      events: acc.events.length,
      sources: acc.sources.size,
      topSources: topEntries(acc.sources, topSourcesLimit),
      withImage: acc.events.filter((event) => Boolean(event.imageUrl)).length,
      withBooking: acc.events.filter((event) =>
        Boolean(event.registrationUrl),
      ).length,
      withCoords: acc.events.filter(
        (event) => event.latitude != null && event.longitude != null,
      ).length,
      topCategories: topEntries(acc.categories, topCategoriesLimit),
      firstStartAt: starts[0] ?? null,
      lastStartAt: starts[starts.length - 1] ?? null,
      coverage: coverageLevel(acc.events.length),
      rawCityVariants: [...acc.rawCities].sort((a, b) => a.localeCompare(b, "fr")),
    };
  });

  return {
    windowDays: params.windowDays ?? 180,
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    totalEventsInCorpus: params.events.length,
    totalEventsOnV1: rows.reduce((sum, row) => sum + row.events, 0),
    distinctSourcesOnV1: v1Sources.size,
    communesNone: rows.filter((row) => row.coverage === "none").map((row) => row.commune),
    communesWeak: rows.filter((row) => row.coverage === "weak").map((row) => row.commune),
    communesGood: rows.filter((row) => row.coverage === "good").map((row) => row.commune),
    rows,
    outsideV1Top: [...outside.entries()]
      .map(([city, events]) => ({ city, events }))
      .sort((a, b) => b.events - a.events || a.city.localeCompare(b.city, "fr"))
      .slice(0, 15),
  };
}

function topEntries(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, limit)
    .map(([label, count]) => `${label} (${count})`);
}
