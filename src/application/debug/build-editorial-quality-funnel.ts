import {
  buildRadarEditorialAudit,
  type RadarEditorialAuditExport,
} from "@/application/debug/build-radar-editorial-audit";
import type { SourceIngestionStat } from "@/application/ingestion/source-ingestion-stats";
import type { AiShortlistInclusionReason } from "@/application/ai/build-ai-highlight-shortlist";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";
import type { EventDuplicate } from "@/domain/events/deduplicate-events";
import { isRadarEligibleAvailability } from "@/domain/events/event-availability";
import type { DetourEvent, EventRelevance } from "@/domain/events/event";
import { toSafeNextImageSrc } from "@/lib/safe-next-image";

const CULTURAL = new Set<EventRelevance>(["culture", "culture_leisure"]);

export type EditorialQualityFunnelLimits = {
  /**
   * Exclusions mapper/adapters (ex. multi_day_timed_range) hors port EventSource.
   * Non visibles ici — dry-run adapter requis.
   */
  adapterInternalExclusionsNotVisible: true;
  /**
   * `fetchedCount` sync ≠ actifs PG hors fenêtre ; ne pas comparer à
   * `previousActiveCount` comme même périmètre.
   */
  syncFetchedVsPreviousActiveDifferentScopes: true;
  /**
   * Explorer SQL (partition city/venue/dates/title) ≠ dédup EventService.
   * Sans slice Explorer fournie, section explorer = null.
   */
  explorerRequiresSeparateQuery: true;
  /**
   * Raisons d’exclusion shortlist→Radar IA absentes si sélection déterministe
   * (pas d’assessment) — on n’invente pas de motif.
   */
  radarDropReasonsOnlyWhenExposed: true;
};

export type EditorialQualityEventTrace = {
  id: string;
  title: string;
  afterFreshness: boolean;
  relevance: EventRelevance | null;
  relevanceReason: string | null;
  keptAfterDedup: boolean;
  duplicateOfId: string | null;
  radarAvailabilityEligible: boolean;
  /** Présent dans `rankDetourHighlightCandidates` (score déterministe > 0). */
  scoredForRadar: boolean;
  /**
   * Présent dans le pool shortlist IA (`buildAiHighlightShortlist`, cap 60).
   * Ce n’est **pas** une condition nécessaire pour apparaître au Radar final :
   * si la sélection IA est vide, le fallback déterministe pioche dans tout le
   * corpus radar-eligible (voir `radarSelectionPath`).
   */
  inAiShortlist: boolean;
  /**
   * Présent dans `highlights` (slots Radar finaux, ≤10).
   * Peut être true avec `inAiShortlist: false` en sélection déterministe.
   */
  selectedInRadar: boolean;
  /**
   * Chemin réel de sélection Radar pour cet ID.
   * - `via_ai_shortlist` : choisi parmi le shortlist IA
   * - `via_deterministic_fallback` : `selectDetourHighlights` sur le pool
   *   radar-eligible (cas typique du script funnel avec IA désactivée)
   * - `not_selected` : hors sélection finale
   */
  radarSelectionPath:
    | "via_ai_shortlist"
    | "via_deterministic_fallback"
    | "not_selected";
  /** null si Explorer non fourni. */
  explorerRepresentative: boolean | null;
};

export type EditorialQualityFunnelReport = {
  generatedAt: string;
  window: { from: string; to: string };
  limits: EditorialQualityFunnelLimits;
  corpus: {
    ingestedBeforeFreshness: number;
    afterFreshness: number;
    droppedByFreshness: number;
    byAdapter: Array<{
      adapterId: string;
      sourceName: string;
      rawCount: number;
      classifiedCulturalCount: number;
      dedupedContribution: number;
      editorialContribution: number;
      duplicatesRemoved: number;
    }>;
    byCity: Record<string, number>;
    missingVenue: number;
    missingCity: number;
    missingEndAt: number;
    noImageUrl: number;
    imageUrlRejectedByAllowlist: number;
    imageUrlRenderable: number;
  };
  classification: {
    culture: number;
    culture_leisure: number;
    uncertain: number;
    out_of_scope: number;
    /** Compteurs par `relevanceReason` (pipeline réel). */
    reasons: Record<string, number>;
  };
  radar: {
    afterDedup: number;
    duplicatesRemoved: number;
    availabilityEligible: number;
    excludedSoldOut: number;
    scoredCandidates: number;
    /** Candidats culturels scorable qui n’ont obtenu aucune reason déterministe. */
    notScoredDespiteCultural: number;
    shortlistSize: number;
    selectedFinal: number;
    /**
     * Origine des `highlights` finaux (EventService.composeResult) :
     * - `ai` : `selectAiDetourHighlights(aiShortlist, …)` non vide
     * - `deterministic` : fallback `selectDetourHighlights(radarEligiblePool)`
     *   — les IDs sélectionnés ne sont **pas** limités au shortlist IA
     * - `mixed` : sources hétérogènes (rare)
     * - `empty` : aucun highlight
     */
    selectionSource: "ai" | "deterministic" | "mixed" | "empty";
    /**
     * Parmi les highlights finaux, combien sont hors shortlist IA.
     * Attendu > 0 uniquement si `selectionSource === "deterministic"`
     * (fallback hors pool 60).
     */
    selectedOutsideAiShortlist: number;
    /** Audit pool shortlist existant — réutilisé tel quel. */
    shortlistAudit: RadarEditorialAuditExport;
  };
  explorer: {
    totalRepresentatives: number;
    representativesListed: number;
    representativesComplete: boolean;
    relevanceDiagnostic: {
      culture: number;
      culture_leisure: number;
      uncertain: number;
      out_of_scope: number;
      unknown: number;
    };
    nonCulturalVolume: number;
    /** IDs en Explorer mais absents du Radar final. */
    inExplorerNotInRadarSelection: string[];
    /** IDs Radar sélectionnés absents des représentants Explorer listés. */
    inRadarSelectionNotInExplorerListed: string[];
    note: string;
  } | null;
  /** Traces demandées (IDs) ou échantillon utile. */
  traces: EditorialQualityEventTrace[];
};

export type EditorialQualityFunnelInput = {
  window: { from: Date; to: Date };
  generatedAt?: string;
  /** Avant `filterStillActiveEvents`. */
  ingestedBeforeFreshness: number;
  /** Après fraîcheur, avant/après classif (même ensemble). */
  classifiedEvents: DetourEvent[];
  afterDedup: DetourEvent[];
  duplicates: EventDuplicate[];
  rankedCandidates: EventHighlight[];
  aiShortlist: EventHighlight[];
  aiShortlistInclusion: Record<string, AiShortlistInclusionReason[]>;
  highlights: EventHighlight[];
  sourceIngestion: SourceIngestionStat[];
  /**
   * Représentants Explorer (même fenêtre idéalement).
   * `null` / omis → section explorer absente (limite documentée).
   */
  explorer?: {
    totalRepresentatives: number;
    representativeEvents: DetourEvent[];
    representativesComplete: boolean;
  } | null;
  /** IDs à tracer ; défaut = échantillon des points de rupture. */
  traceEventIds?: string[];
};

const LIMITS: EditorialQualityFunnelLimits = {
  adapterInternalExclusionsNotVisible: true,
  syncFetchedVsPreviousActiveDifferentScopes: true,
  explorerRequiresSeparateQuery: true,
  radarDropReasonsOnlyWhenExposed: true,
};

/**
 * Funnel éditorial lecture seule — agrège le pipeline EventService réel
 * (+ slice Explorer optionnelle). N’applique aucune règle métier nouvelle.
 */
export function buildEditorialQualityFunnel(
  input: EditorialQualityFunnelInput,
): EditorialQualityFunnelReport {
  const classified = input.classifiedEvents;
  const afterFreshness = classified.length;
  const droppedByFreshness = Math.max(
    0,
    input.ingestedBeforeFreshness - afterFreshness,
  );

  const byCity = countBy(
    classified.map((e) => (e.city?.trim() ? e.city.trim() : "(missing)")),
  );

  let noImageUrl = 0;
  let imageUrlRejectedByAllowlist = 0;
  let imageUrlRenderable = 0;
  let missingVenue = 0;
  let missingCity = 0;
  let missingEndAt = 0;

  for (const event of classified) {
    if (!event.venue?.trim()) missingVenue += 1;
    if (!event.city?.trim()) missingCity += 1;
    if (!event.endAt) missingEndAt += 1;

    if (!event.imageUrl?.trim()) {
      noImageUrl += 1;
    } else if (toSafeNextImageSrc(event.imageUrl)) {
      imageUrlRenderable += 1;
    } else {
      imageUrlRejectedByAllowlist += 1;
    }
  }

  const relevanceCounts = {
    culture: 0,
    culture_leisure: 0,
    uncertain: 0,
    out_of_scope: 0,
  };
  const reasons: Record<string, number> = {};
  for (const event of classified) {
    const rel = event.relevance;
    if (rel && rel in relevanceCounts) {
      relevanceCounts[rel as keyof typeof relevanceCounts] += 1;
    }
    const reason = event.relevanceReason?.trim();
    if (reason) {
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    }
  }

  const availabilityEligible = input.afterDedup.filter((e) =>
    isRadarEligibleAvailability(e.availabilityStatus),
  );
  const excludedSoldOut = input.afterDedup.length - availabilityEligible.length;

  const scoredIds = new Set(input.rankedCandidates.map((c) => c.event.id));
  const culturalAfterDedup = availabilityEligible.filter(
    (e) => e.relevance && CULTURAL.has(e.relevance),
  );
  const notScoredDespiteCultural = culturalAfterDedup.filter(
    (e) => !scoredIds.has(e.id),
  ).length;

  const shortlistAudit = buildRadarEditorialAudit({
    generatedAt: input.generatedAt,
    aiShortlist: input.aiShortlist,
    aiShortlistInclusion: input.aiShortlistInclusion,
    highlights: input.highlights,
    aiAssessments: [],
  });

  const selectionSources = new Set(
    input.highlights.map((h) => h.selectionSource ?? "deterministic"),
  );
  let selectionSource: EditorialQualityFunnelReport["radar"]["selectionSource"] =
    "empty";
  if (input.highlights.length > 0) {
    if (selectionSources.size > 1) selectionSource = "mixed";
    else if (selectionSources.has("ai")) selectionSource = "ai";
    else selectionSource = "deterministic";
  }

  const shortlistIdSet = new Set(input.aiShortlist.map((c) => c.event.id));
  const selectedOutsideAiShortlist = input.highlights.filter(
    (h) => !shortlistIdSet.has(h.event.id),
  ).length;

  const explorer = buildExplorerSection(input);
  const traces = buildTraces(input, selectionSource);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    window: {
      from: input.window.from.toISOString(),
      to: input.window.to.toISOString(),
    },
    limits: LIMITS,
    corpus: {
      ingestedBeforeFreshness: input.ingestedBeforeFreshness,
      afterFreshness,
      droppedByFreshness,
      byAdapter: input.sourceIngestion.map((s) => ({
        adapterId: s.adapterId,
        sourceName: s.sourceName,
        rawCount: s.rawCount,
        classifiedCulturalCount: s.classifiedCount,
        dedupedContribution: s.dedupedContribution,
        editorialContribution: s.editorialContribution,
        duplicatesRemoved: s.duplicatesRemoved,
      })),
      byCity,
      missingVenue,
      missingCity,
      missingEndAt,
      noImageUrl,
      imageUrlRejectedByAllowlist,
      imageUrlRenderable,
    },
    classification: {
      ...relevanceCounts,
      reasons: sortCountMap(reasons),
    },
    radar: {
      afterDedup: input.afterDedup.length,
      duplicatesRemoved: input.duplicates.length,
      availabilityEligible: availabilityEligible.length,
      excludedSoldOut,
      scoredCandidates: input.rankedCandidates.length,
      notScoredDespiteCultural,
      shortlistSize: input.aiShortlist.length,
      selectedFinal: input.highlights.length,
      selectionSource,
      selectedOutsideAiShortlist,
      shortlistAudit,
    },
    explorer,
    traces,
  };
}

/**
 * Trace un ID dans un rapport déjà construit (lookup).
 */
export function findEventTrace(
  report: EditorialQualityFunnelReport,
  eventId: string,
): EditorialQualityEventTrace | null {
  return report.traces.find((t) => t.id === eventId) ?? null;
}

function buildExplorerSection(
  input: EditorialQualityFunnelInput,
): EditorialQualityFunnelReport["explorer"] {
  if (input.explorer == null) return null;

  const listed = input.explorer.representativeEvents;
  const relevanceDiagnostic = {
    culture: 0,
    culture_leisure: 0,
    uncertain: 0,
    out_of_scope: 0,
    unknown: 0,
  };

  const classifiedById = new Map(
    input.classifiedEvents.map((e) => [e.id, e] as const),
  );

  for (const event of listed) {
    const classified = classifiedById.get(event.id) ?? event;
    const rel = classified.relevance;
    if (rel === "culture") relevanceDiagnostic.culture += 1;
    else if (rel === "culture_leisure") relevanceDiagnostic.culture_leisure += 1;
    else if (rel === "uncertain") relevanceDiagnostic.uncertain += 1;
    else if (rel === "out_of_scope") relevanceDiagnostic.out_of_scope += 1;
    else relevanceDiagnostic.unknown += 1;
  }

  const nonCulturalVolume =
    relevanceDiagnostic.uncertain +
    relevanceDiagnostic.out_of_scope +
    relevanceDiagnostic.unknown;

  const explorerIds = new Set(listed.map((e) => e.id));
  const radarSelectedIds = new Set(input.highlights.map((h) => h.event.id));

  const inExplorerNotInRadarSelection = [...explorerIds].filter(
    (id) => !radarSelectedIds.has(id),
  );
  const inRadarSelectionNotInExplorerListed = [...radarSelectedIds].filter(
    (id) => !explorerIds.has(id),
  );

  return {
    totalRepresentatives: input.explorer.totalRepresentatives,
    representativesListed: listed.length,
    representativesComplete: input.explorer.representativesComplete,
    relevanceDiagnostic,
    nonCulturalVolume,
    inExplorerNotInRadarSelection,
    inRadarSelectionNotInExplorerListed,
    note:
      "Relevance Explorer = classifyEventRelevance à titre diagnostique uniquement. " +
      "Explorer SQL ne filtre pas sur relevance. Dédup Explorer ≠ EventService.",
  };
}

function buildTraces(
  input: EditorialQualityFunnelInput,
  selectionSource: EditorialQualityFunnelReport["radar"]["selectionSource"],
): EditorialQualityEventTrace[] {
  const classifiedById = new Map(
    input.classifiedEvents.map((e) => [e.id, e] as const),
  );
  const afterDedupIds = new Set(input.afterDedup.map((e) => e.id));
  const duplicateOf = new Map(
    input.duplicates.map((d) => [d.duplicateId, d.keptId] as const),
  );
  const scoredIds = new Set(input.rankedCandidates.map((c) => c.event.id));
  const shortlistIds = new Set(input.aiShortlist.map((c) => c.event.id));
  const selectedIds = new Set(input.highlights.map((h) => h.event.id));
  const explorerIds =
    input.explorer != null
      ? new Set(input.explorer.representativeEvents.map((e) => e.id))
      : null;

  const ids =
    input.traceEventIds ??
    pickDefaultTraceIds({
      classified: input.classifiedEvents,
      duplicates: input.duplicates,
      ranked: input.rankedCandidates,
      highlights: input.highlights,
      shortlistIds,
      explorerIds,
    });

  const seen = new Set<string>();
  const traces: EditorialQualityEventTrace[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const event = classifiedById.get(id);
    const afterFreshness = event != null || duplicateOf.has(id);
    const title = event?.title ?? `(absent après fraîcheur: ${id})`;
    const inAiShortlist = shortlistIds.has(id);
    const selectedInRadar = selectedIds.has(id);

    traces.push({
      id,
      title,
      afterFreshness,
      relevance: event?.relevance ?? null,
      relevanceReason: event?.relevanceReason ?? null,
      keptAfterDedup: afterDedupIds.has(id),
      duplicateOfId: duplicateOf.get(id) ?? null,
      radarAvailabilityEligible: event
        ? isRadarEligibleAvailability(event.availabilityStatus)
        : false,
      scoredForRadar: scoredIds.has(id),
      inAiShortlist,
      selectedInRadar,
      radarSelectionPath: resolveRadarSelectionPath({
        selectedInRadar,
        inAiShortlist,
        selectionSource,
      }),
      explorerRepresentative: explorerIds ? explorerIds.has(id) : null,
    });
  }

  return traces;
}

function resolveRadarSelectionPath(params: {
  selectedInRadar: boolean;
  inAiShortlist: boolean;
  selectionSource: EditorialQualityFunnelReport["radar"]["selectionSource"];
}): EditorialQualityEventTrace["radarSelectionPath"] {
  if (!params.selectedInRadar) return "not_selected";
  // La source de sélection du run prime sur la présence dans le shortlist.
  if (params.selectionSource === "ai") return "via_ai_shortlist";
  if (params.selectionSource === "deterministic") {
    return "via_deterministic_fallback";
  }
  // mixed / empty (empty ne devrait pas arriver si selected)
  return params.inAiShortlist ? "via_ai_shortlist" : "via_deterministic_fallback";
}

function pickDefaultTraceIds(params: {
  classified: DetourEvent[];
  duplicates: EventDuplicate[];
  ranked: EventHighlight[];
  highlights: EventHighlight[];
  shortlistIds: Set<string>;
  explorerIds: Set<string> | null;
}): string[] {
  const ids: string[] = [];
  for (const h of params.highlights.slice(0, 3)) ids.push(h.event.id);
  // Exemple explicite sélection déterministe hors shortlist (si présent).
  const outsideShortlist = params.highlights.find(
    (h) => !params.shortlistIds.has(h.event.id),
  );
  if (outsideShortlist) ids.push(outsideShortlist.event.id);
  for (const d of params.duplicates.slice(0, 3)) {
    ids.push(d.duplicateId);
    ids.push(d.keptId);
  }
  const outOfScope = params.classified.find((e) => e.relevance === "out_of_scope");
  if (outOfScope) ids.push(outOfScope.id);
  const uncertain = params.classified.find((e) => e.relevance === "uncertain");
  if (uncertain) ids.push(uncertain.id);
  const culturalNotSelected = params.ranked.find(
    (c) => !params.highlights.some((h) => h.event.id === c.event.id),
  );
  if (culturalNotSelected) ids.push(culturalNotSelected.event.id);

  if (params.explorerIds) {
    for (const id of params.explorerIds) {
      if (!params.highlights.some((h) => h.event.id === id)) {
        ids.push(id);
        break;
      }
    }
  }

  return ids;
}

function countBy(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of items) {
    out[key] = (out[key] ?? 0) + 1;
  }
  return sortCountMap(out);
}

function sortCountMap(map: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}
