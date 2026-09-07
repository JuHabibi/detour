/** Types du harness d’évaluation éditoriale offline (observation uniquement). */

export type GoldenLabel = "MUST" | "MAYBE" | "NO" | "UNJUDGEABLE";

export type GoldenAxisLevel = "strong" | "medium" | "weak" | "insufficient";

export type GoldenSetItem = {
  /** Identifiant canonique de l’unité éditoriale. */
  eventId: string;
  /**
   * Occurrences événementielles de la même découverte.
   * Si présent, un match sur n’importe quel id crédite une seule fois cette entrée.
   */
  eventIds?: string[];
  titleMatch: string;
  /** Préfixe de jour YYYY-MM-DD pour désambiguïser homonymes (legacy / v1). */
  startAtMatch?: string;
  /** Label Radar v2. */
  radarLabel?: GoldenLabel;
  /** Compat golden v1. */
  label?: GoldenLabel;
  desirability?: GoldenAxisLevel;
  anticipation?: GoldenAxisLevel;
  evidence?: string[];
  note?: string;
};

export type GoldenSetFile = {
  version: number;
  description?: string;
  source?: string;
  status?: string;
  items: GoldenSetItem[];
};

export type SnapshotHighlight = {
  title: string;
  slot?: string | null;
  city?: string | null;
  badge?: string | null;
  startAt?: string | null;
  eventId?: string | null;
  availabilityStatus?: string | null;
};

export type SnapshotRow = {
  title: string;
  city?: string | null;
  venue?: string | null;
  startAt?: string | null;
  finalSlot?: string | null;
  appeal?: number;
  missRisk?: number;
  planningNeed?: number;
  localRarity?: number;
  likelyDemand?: number;
  confidence?: number;
  aiReasons?: string[];
  eventId?: string | null;
  availabilityStatus?: string | null;
};

export type EditorialAuditSnapshot = {
  meta?: Record<string, unknown>;
  highlights: SnapshotHighlight[];
  rows: SnapshotRow[];
};

export type MatchedEvent = {
  title: string;
  startAt: string | null;
  eventId: string | null;
  slot: string | null;
  label: GoldenLabel | null;
  goldenEventId: string | null;
};

/** Résout le label effectif (v2 radarLabel prioritaire, sinon label v1). */
export function resolveGoldenLabel(item: GoldenSetItem): GoldenLabel | null {
  const raw = item.radarLabel ?? item.label ?? null;
  if (
    raw === "MUST" ||
    raw === "MAYBE" ||
    raw === "NO" ||
    raw === "UNJUDGEABLE"
  ) {
    return raw;
  }
  return null;
}

/** Labels qui entrent dans IDCG / précision qualité (pas UNJUDGEABLE). */
export function isJudgeableLabel(
  label: GoldenLabel | null | undefined,
): label is "MUST" | "MAYBE" | "NO" {
  return label === "MUST" || label === "MAYBE" || label === "NO";
}

export function goldenOccurrenceIds(item: GoldenSetItem): string[] {
  if (item.eventIds && item.eventIds.length > 0) {
    return [...new Set(item.eventIds)];
  }
  return [item.eventId];
}
