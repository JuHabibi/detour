/**
 * Challenger offline : ranking éditorial global (pas le selector production).
 * editorialScore = 2*appeal + missRisk + planningNeed + localRarity
 * (likelyDemand ignoré pour cette expérience uniquement)
 */
import {
  AI_DETOUR_MAX_PER_CITY,
  AI_DETOUR_MAX_PER_DISCOVERY,
  AI_DETOUR_MAX_PER_VENUE,
  buildRadarDiscoveryKey,
} from "@/domain/editorial/select-ai-detour-highlights";
import type { DetourEvent } from "@/domain/events/event";
import type { SnapshotRow } from "@/application/debug/editorial-eval/types";

export type ChallengerExplainAxis =
  | "easy-to-miss"
  | "worth-planning"
  | "rare-local"
  | "strong/editorial";

export type ChallengerCandidate = {
  row: SnapshotRow;
  index: number;
  editorialScore: number;
  discoveryKey: string;
  explainAxis: ChallengerExplainAxis;
};

export function editorialScoreChallenger(row: {
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
}): number {
  return (
    2 * row.appeal + row.missRisk + row.planningNeed + row.localRarity
  );
}

/** Classification post-hoc — n’influence pas le ranking. */
export function explainAxisForRow(row: {
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
}): ChallengerExplainAxis {
  const max = Math.max(row.missRisk, row.planningNeed, row.localRarity);
  if (max === 0) return "strong/editorial";
  if (row.missRisk === max && row.missRisk >= row.planningNeed && row.missRisk >= row.localRarity) {
    if (row.missRisk >= 3) return "easy-to-miss";
  }
  if (row.planningNeed === max && row.planningNeed >= row.missRisk && row.planningNeed >= row.localRarity) {
    if (row.planningNeed >= 3) return "worth-planning";
  }
  if (row.localRarity === max && row.localRarity >= row.missRisk && row.localRarity >= row.planningNeed) {
    if (row.localRarity >= 3) return "rare-local";
  }
  // Plus fort axe relatif si plusieurs égaux : priorité miss > plan > rare, sinon editorial
  if (row.missRisk >= 3 && row.missRisk >= row.planningNeed && row.missRisk >= row.localRarity) {
    return "easy-to-miss";
  }
  if (row.planningNeed >= 3 && row.planningNeed >= row.localRarity) {
    return "worth-planning";
  }
  if (row.localRarity >= 3) return "rare-local";
  return "strong/editorial";
}

function toMinimalEvent(row: SnapshotRow, index: number): DetourEvent {
  return {
    id: row.eventId ?? `snapshot:${index}:${row.title}`,
    title: row.title,
    description: null,
    imageUrl: null,
    startAt: row.startAt ?? "",
    endAt: null,
    venue: row.venue ?? null,
    city: row.city ?? null,
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    relevance: "culture",
  };
}

function normalizePlace(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ranking global + diversité (discovery hard, venue/city soft = skip si plafond atteint).
 * Pas de quotas de slots / floors.
 */
export function selectChallengerGlobalTop10(
  rows: SnapshotRow[],
  limit = 10,
): ChallengerCandidate[] {
  const ranked = rows
    .map((row, index) => {
      const appeal = row.appeal ?? 0;
      const missRisk = row.missRisk ?? 0;
      const planningNeed = row.planningNeed ?? 0;
      const localRarity = row.localRarity ?? 0;
      const event = toMinimalEvent(row, index);
      return {
        row,
        index,
        editorialScore: editorialScoreChallenger({
          appeal,
          missRisk,
          planningNeed,
          localRarity,
        }),
        discoveryKey: buildRadarDiscoveryKey(event),
        explainAxis: explainAxisForRow({
          appeal,
          missRisk,
          planningNeed,
          localRarity,
        }),
        event,
      };
    })
    .sort((a, b) => {
      if (b.editorialScore !== a.editorialScore) {
        return b.editorialScore - a.editorialScore;
      }
      const confDiff = (b.row.confidence ?? 0) - (a.row.confidence ?? 0);
      if (confDiff !== 0) return confDiff;
      return a.index - b.index;
    });

  const selected: ChallengerCandidate[] = [];
  const discoveryCounts = new Map<string, number>();

  for (const candidate of ranked) {
    if (selected.length >= limit) break;

    const discoveryCount = discoveryCounts.get(candidate.discoveryKey) ?? 0;
    if (discoveryCount >= AI_DETOUR_MAX_PER_DISCOVERY) {
      continue;
    }

    const venueKey = normalizePlace(candidate.row.venue);
    if (venueKey) {
      const venueCount = selected.filter(
        (item) => normalizePlace(item.row.venue) === venueKey,
      ).length;
      if (venueCount >= AI_DETOUR_MAX_PER_VENUE) {
        continue;
      }
    }

    const cityKey = normalizePlace(candidate.row.city);
    if (cityKey) {
      const cityCount = selected.filter(
        (item) => normalizePlace(item.row.city) === cityKey,
      ).length;
      if (cityCount >= AI_DETOUR_MAX_PER_CITY) {
        continue;
      }
    }

    selected.push({
      row: candidate.row,
      index: candidate.index,
      editorialScore: candidate.editorialScore,
      discoveryKey: candidate.discoveryKey,
      explainAxis: candidate.explainAxis,
    });
    discoveryCounts.set(candidate.discoveryKey, discoveryCount + 1);
  }

  return selected;
}
