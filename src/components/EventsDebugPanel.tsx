"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventItem, EventRelevance } from "@/data/types";
import { runAiHighlightAssessment } from "@/app/actions/run-ai-assessment";
import type { RadarEditorialAuditExport } from "@/application/debug/build-radar-editorial-audit";

const DEBUG_LIMIT = 100;

const RELEVANCE_FILTERS: Array<{ id: "all" | EventRelevance; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "culture", label: "culture" },
  { id: "culture_leisure", label: "culture_leisure" },
  { id: "uncertain", label: "uncertain" },
  { id: "out_of_scope", label: "out_of_scope" },
];

export type EventDuplicateDebug = {
  keptTitle: string;
  duplicateTitle: string;
  date: string;
  venue: string | null;
  city: string | null;
  reason: string;
};

export type HighlightDebug = {
  title: string;
  score: number;
  planningScore: number;
  reasons: string[];
  source: string | null;
  city: string | null;
  hasRegistration: boolean;
  rank?: number;
  slot?: string;
  selectionSource?: "ai" | "deterministic";
  deterministicRank?: number;
  aiRank?: number;
  /** Scores IA / formule du slot (debug). */
  scoresUsed?: string;
  editorialBadge?: string | null;
};

export type AiHighlightDebug = {
  eventId: string;
  title: string;
  deterministicRank?: number;
  appeal: number;
  missRisk: number;
  planningNeed: number;
  localRarity: number;
  likelyDemand: number;
  confidence: number;
  reasons: string[];
  combined: number;
  /** Rang debug : Σ des dimensions éditoriales. */
  aiRankTotal?: number;
  /** Rang debug « Détour » — même Σ pour l’instant (poids futurs). */
  aiRankDetour?: number;
};

export type PlanningEventDebug = {
  title: string;
  pool: "ai" | "deterministic-fallback";
  selectionSource: "ai" | "deterministic";
  planningValue: number | null;
  planningScore: number;
  selectionScore: number;
  rankInPool: number;
  date: string;
  city: string | null;
};

export type AiShortlistDebug = {
  eventId: string;
  title: string;
  rank: number;
  score: number;
  planningScore: number;
  city: string | null;
  inclusionReasons: string[];
};

export type EventsDebugMeta = {
  rawCount: number;
  dedupedCount: number;
  duplicateCount: number;
  scoredCandidatesCount?: number;
  duplicates: EventDuplicateDebug[];
  highlights?: HighlightDebug[];
  highlightCandidates?: HighlightDebug[];
  aiShortlist?: AiShortlistDebug[];
  aiShortlistBucketSizes?: {
    "deterministic-top": number;
    "planning-top": number;
    "booking-top": number;
    "peripheral-top": number;
    "future-top": number;
  };
  aiAssessments?: AiHighlightDebug[];
  planningEvents?: PlanningEventDebug[];
  sourceIngestion?: Array<{
    adapterId: string;
    sourceName: string;
    status: "ok" | "error";
    rawCount: number;
    classifiedCount: number;
    dedupedContribution: number;
    editorialContribution: number;
    duplicatesRemoved: number;
  }>;
  saranDuplicates?: Array<{
    saranTitle: string;
    keptTitle: string;
    keptSource: string | null;
    keptAdapterId: string | null;
    reason: string;
  }>;
  saranClassificationAudit?: {
    total: number;
    culture: number;
    cultureLeisure: number;
    outOfScope: number;
    uncertain: number;
    rows: Array<{
      eventId: string;
      title: string;
      relevance: string;
      relevanceReason: string | null;
      category: string | null;
      genre: string | null;
      venue: string | null;
      descriptionSnippet: string | null;
    }>;
  };
  aiRuntime?: {
    mode: "manual" | "auto" | "disabled";
    source: "fresh" | "cache" | "partial" | "fallback";
    /** @deprecated Cache per-event — souvent null. */
    cacheKeyShort: string | null;
    cacheHits?: number;
    cacheMisses?: number;
    assessedAt: string | null;
    canRunManual: boolean;
  };
  /** Export audit éditorial du AI candidate pool (faits + engine séparés). */
  radarEditorialAudit?: RadarEditorialAuditExport;
};

type EventsDebugPanelProps = {
  events: EventItem[];
  meta?: EventsDebugMeta;
  /** Après Run AI manual : met à jour highlights + planning + meta debug. */
  onManualAiResult?: (result: {
    highlights: EventItem[];
    planningEvents: EventItem[];
    debugMeta: EventsDebugMeta;
  }) => void;
};

/** Panneau temporaire pour inspecter la qualité des données Orléans. */
export function EventsDebugPanel({
  events,
  meta: initialMeta,
  onManualAiResult,
}: EventsDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [relevanceFilter, setRelevanceFilter] = useState<"all" | EventRelevance>(
    "all",
  );
  const [meta, setMeta] = useState(initialMeta);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasRunAi, setHasRunAi] = useState(
    Boolean(initialMeta?.aiAssessments?.length),
  );
  const [auditCopyState, setAuditCopyState] = useState<
    "idle" | "copied" | "error"
  >("idle");

  // Sync si la page serveur renvoie un nouveau meta (refresh).
  useEffect(() => {
    setMeta(initialMeta);
    setHasRunAi(Boolean(initialMeta?.aiAssessments?.length));
    setAiError(null);
    setAuditCopyState("idle");
  }, [initialMeta]);

  async function handleCopyRadarAudit() {
    const audit = meta?.radarEditorialAudit;
    if (!audit || audit.events.length === 0) {
      setAuditCopyState("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(audit, null, 2));
      setAuditCopyState("copied");
    } catch {
      setAuditCopyState("error");
    }
  }

  async function handleRunAi(force: boolean) {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await runAiHighlightAssessment({ force });
      if (!result.ok) {
        setAiError(result.error);
        return;
      }
      setMeta(result.debugMeta);
      setHasRunAi(true);
      onManualAiResult?.({
        highlights: result.highlights,
        planningEvents: result.planningEvents,
        debugMeta: result.debugMeta,
      });
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Évaluation IA impossible.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  const relevanceCounts = useMemo(() => {
    const counts: Record<EventRelevance, number> = {
      culture: 0,
      culture_leisure: 0,
      uncertain: 0,
      out_of_scope: 0,
    };

    for (const event of events) {
      const key = event.relevance ?? "uncertain";
      counts[key] += 1;
    }

    return counts;
  }, [events]);

  const filtered = useMemo(() => {
    if (relevanceFilter === "all") return events;
    return events.filter(
      (event) => (event.relevance ?? "uncertain") === relevanceFilter,
    );
  }, [events, relevanceFilter]);

  const sample = useMemo(() => filtered.slice(0, DEBUG_LIMIT), [filtered]);

  const stats = useMemo(() => {
    let withImage = 0;
    let withRegistration = 0;
    let withConditions = 0;
    let withCity = 0;
    let withVenue = 0;

    for (const event of sample) {
      if (event.image) withImage += 1;
      if (event.registrationUrl) withRegistration += 1;
      if (event.conditions) withConditions += 1;
      if (event.city) withCity += 1;
      if (event.venue) withVenue += 1;
    }

    return {
      shown: sample.length,
      filtered: filtered.length,
      total: events.length,
      withImage,
      withRegistration,
      withConditions,
      withCity,
      withVenue,
    };
  }, [events.length, filtered.length, sample]);

  return (
    <section className="border-t border-dashed border-line bg-foam/40 px-5 py-8 md:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-sand">
              Temporaire
            </p>
            <h2 className="mt-1 font-display text-xl tracking-tight">
              Debug données Orléans
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink transition-colors hover:border-ink/25"
          >
            {open ? "Masquer" : `Inspecter (${stats.total})`}
          </button>
        </div>

        {open ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm text-cream-dim">
              Affiche jusqu’à {DEBUG_LIMIT} événements après classification et
              déduplication conservatrice — pour vérification manuelle.
            </p>

            {meta ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Brut chargé" value={meta.rawCount} />
                <Stat label="Après dédup" value={meta.dedupedCount} />
                <Stat label="Doublons détectés" value={meta.duplicateCount} />
                <Stat
                  label="Candidats scorés"
                  value={meta.scoredCandidatesCount ?? "—"}
                />
              </dl>
            ) : null}

            {meta?.sourceIngestion && meta.sourceIngestion.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Source ingestion
                </h3>
                <p className="text-sm text-cream-dim">
                  Compteurs par adapter technique (pas par libellé
                  OpenAgenda). Relevant = culture / culture_leisure ;
                  Relevant final = relevant encore présents après dédup.
                </p>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Source</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Raw</th>
                        <th className="px-3 py-2.5 font-medium">
                          Relevant
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          Relevant final
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          Duplicates removed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.sourceIngestion.map((row) => (
                        <tr
                          key={row.adapterId}
                          className="border-b border-line/70 last:border-b-0"
                        >
                          <td className="max-w-[20rem] px-3 py-2.5 font-medium text-ink">
                            {row.sourceName}
                            <span className="mt-0.5 block font-mono text-[10px] text-sand">
                              {row.adapterId}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {row.status}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {row.rawCount}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {row.classifiedCount}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {row.editorialContribution}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {row.duplicatesRemoved}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta?.saranDuplicates && meta.saranDuplicates.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Saran duplicates
                </h3>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">
                          Titre Saran
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          Titre conservé
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          Source conservée
                        </th>
                        <th className="px-3 py-2.5 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.saranDuplicates.map((row, index) => (
                        <tr
                          key={`${row.saranTitle}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[14rem] px-3 py-2.5 font-medium text-ink">
                            {row.saranTitle}
                          </td>
                          <td className="max-w-[14rem] px-3 py-2.5 text-cream-dim">
                            {row.keptTitle}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                            {row.keptSource || "—"}
                            {row.keptAdapterId ? (
                              <span className="mt-0.5 block font-mono text-[10px] text-sand">
                                {row.keptAdapterId}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {row.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta?.saranClassificationAudit &&
            meta.saranClassificationAudit.total > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Saran classification audit
                </h3>
                <p className="text-sm text-cream-dim">
                  Audit temporaire — Saran iCal sans category/genre fiables.
                  Sans signal textuel le classifieur renvoie surtout{" "}
                  <span className="font-mono">uncertain</span> (pas
                  out_of_scope). Tri : out_of_scope → uncertain →
                  culture_leisure → culture.
                </p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat
                    label="Total Saran"
                    value={meta.saranClassificationAudit.total}
                  />
                  <Stat
                    label="culture"
                    value={meta.saranClassificationAudit.culture}
                  />
                  <Stat
                    label="culture_leisure"
                    value={meta.saranClassificationAudit.cultureLeisure}
                  />
                  <Stat
                    label="out_of_scope"
                    value={meta.saranClassificationAudit.outOfScope}
                  />
                  <Stat
                    label="uncertain"
                    value={meta.saranClassificationAudit.uncertain}
                  />
                </dl>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Title</th>
                        <th className="px-3 py-2.5 font-medium">
                          Relevance
                        </th>
                        <th className="px-3 py-2.5 font-medium">Reason</th>
                        <th className="px-3 py-2.5 font-medium">
                          Category
                        </th>
                        <th className="px-3 py-2.5 font-medium">Genre</th>
                        <th className="px-3 py-2.5 font-medium">Venue</th>
                        <th className="px-3 py-2.5 font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.saranClassificationAudit.rows.map((row) => (
                        <tr
                          key={row.eventId}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[14rem] px-3 py-2.5 font-medium text-ink">
                            {row.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-ink">
                            {row.relevance}
                          </td>
                          <td className="max-w-[10rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {row.relevanceReason || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-cream-dim">
                            {row.category || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-cream-dim">
                            {row.genre || "—"}
                          </td>
                          <td className="max-w-[10rem] px-3 py-2.5 text-cream-dim">
                            {row.venue || "—"}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 text-cream-dim">
                            {row.descriptionSnippet || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta?.aiRuntime ? (
              <div className="space-y-3 rounded-xl border border-line bg-paper p-4">
                <h3 className="font-display text-lg tracking-tight">
                  AI runtime
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="AI mode" value={meta.aiRuntime.mode} />
                  <Stat label="AI source" value={meta.aiRuntime.source} />
                  <Stat
                    label="Cache hits"
                    value={String(meta.aiRuntime.cacheHits ?? 0)}
                  />
                  <Stat
                    label="Cache misses"
                    value={String(meta.aiRuntime.cacheMisses ?? 0)}
                  />
                  <Stat
                    label="Last assessment"
                    value={
                      meta.aiRuntime.assessedAt
                        ? formatDebugDate(meta.aiRuntime.assessedAt)
                        : "—"
                    }
                  />
                </dl>
                {meta.aiRuntime.canRunManual ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleRunAi(hasRunAi)}
                      className="rounded-full border border-line bg-ink px-4 py-2 text-sm text-paper transition-opacity disabled:opacity-50"
                    >
                      {aiLoading
                        ? "Running…"
                        : hasRunAi
                          ? "Re-run AI assessment"
                          : "Run AI assessment"}
                    </button>
                    {aiLoading ? (
                      <span className="text-sm text-cream-dim">loading</span>
                    ) : null}
                  </div>
                ) : null}
                {aiError ? (
                  <p className="text-sm text-coral">{aiError}</p>
                ) : null}
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="culture" value={relevanceCounts.culture} />
              <Stat
                label="culture_leisure"
                value={relevanceCounts.culture_leisure}
              />
              <Stat label="uncertain" value={relevanceCounts.uncertain} />
              <Stat label="out_of_scope" value={relevanceCounts.out_of_scope} />
            </dl>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Affichés"
                value={`${stats.shown} / ${stats.filtered}`}
              />
              <Stat label="Liste courante" value={stats.total} />
              <Stat label="Avec image" value={stats.withImage} />
              <Stat label="Avec réservation" value={stats.withRegistration} />
              <Stat label="Avec conditions" value={stats.withConditions} />
              <Stat label="Avec ville" value={stats.withCity} />
            </dl>

            <div className="flex flex-wrap gap-2">
              {RELEVANCE_FILTERS.map((item) => {
                const active = relevanceFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRelevanceFilter(item.id)}
                    className={
                      active
                        ? "rounded-full bg-ink px-3 py-1.5 text-xs text-paper"
                        : "rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink hover:border-ink/25"
                    }
                  >
                    {item.label}
                    {item.id !== "all" ? (
                      <span className="ml-1 opacity-70">
                        {relevanceCounts[item.id]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {meta && meta.highlights && meta.highlights.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Highlights « Faites un détour »
                </h3>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Slot</th>
                        <th className="px-3 py-2.5 font-medium">Sel.</th>
                        <th className="px-3 py-2.5 font-medium">Badge</th>
                        <th className="px-3 py-2.5 font-medium">Titre</th>
                        <th className="px-3 py-2.5 font-medium">Score</th>
                        <th className="px-3 py-2.5 font-medium">Det. rank</th>
                        <th className="px-3 py-2.5 font-medium">AI rank</th>
                        <th className="px-3 py-2.5 font-medium">Scores used</th>
                        <th className="px-3 py-2.5 font-medium">Planning</th>
                        <th className="px-3 py-2.5 font-medium">Reasons</th>
                        <th className="px-3 py-2.5 font-medium">Ville</th>
                        <th className="px-3 py-2.5 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.highlights.map((highlight, index) => (
                        <tr
                          key={`${highlight.title}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-ink">
                            {highlight.slot ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-sand">
                            {highlight.selectionSource ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-ink">
                            {highlight.editorialBadge ?? "—"}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                            {highlight.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink">
                            {highlight.score}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sand">
                            {highlight.deterministicRank ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sand">
                            {highlight.aiRank ?? "—"}
                          </td>
                          <td className="max-w-[18rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {highlight.scoresUsed ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink">
                            {highlight.planningScore}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {highlight.reasons.join(", ")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                            {highlight.city || "—"}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                            {highlight.source || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta &&
            meta.highlightCandidates &&
            meta.highlightCandidates.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Top scored candidates (20)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Rank</th>
                        <th className="px-3 py-2.5 font-medium">Titre</th>
                        <th className="px-3 py-2.5 font-medium">Score</th>
                        <th className="px-3 py-2.5 font-medium">Planning</th>
                        <th className="px-3 py-2.5 font-medium">Reasons</th>
                        <th className="px-3 py-2.5 font-medium">Ville</th>
                        <th className="px-3 py-2.5 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.highlightCandidates.map((candidate, index) => (
                        <tr
                          key={`candidate-${candidate.title}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {candidate.rank ?? index + 1}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                            {candidate.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink">
                            {candidate.score}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink">
                            {candidate.planningScore}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {candidate.reasons.join(", ")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                            {candidate.city || "—"}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                            {candidate.source || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta && meta.planningEvents && meta.planningEvents.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Planning events
                </h3>
                <p className="text-sm text-cream-dim">
                  Section « À prévoir » — pool IA d’abord, fallback déterministe
                  ensuite. &gt;30 jours, hors Faites un détour.
                </p>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Titre</th>
                        <th className="px-3 py-2.5 font-medium">Pool</th>
                        <th className="px-3 py-2.5 font-medium">
                          Rank in pool
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          planningValue
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          planningScore
                        </th>
                        <th className="px-3 py-2.5 font-medium">Final score</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Ville</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.planningEvents.map((item, index) => (
                        <tr
                          key={`${item.title}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                            {item.title}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-sand">
                            {item.pool}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {item.rankInPool}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {item.planningValue ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {item.planningScore}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {item.selectionScore}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                            {formatDebugDate(item.date)}
                          </td>
                          <td className="px-3 py-2.5 text-cream-dim">
                            {item.city || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta && meta.aiShortlist && meta.aiShortlist.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg tracking-tight">
                      AI candidate pool
                    </h3>
                    <p className="mt-1 text-sm text-cream-dim">
                      Union de buckets (max 60) : deterministic-top, planning-top,
                      booking-top, peripheral-top, future-top.
                      {meta.aiShortlistBucketSizes
                        ? ` Buckets bruts : det=${meta.aiShortlistBucketSizes["deterministic-top"]}, plan=${meta.aiShortlistBucketSizes["planning-top"]}, book=${meta.aiShortlistBucketSizes["booking-top"]}, peri=${meta.aiShortlistBucketSizes["peripheral-top"]}, fut=${meta.aiShortlistBucketSizes["future-top"]}.`
                        : ""}{" "}
                      Pool final : {meta.aiShortlist.length}.
                    </p>
                  </div>
                  {meta.radarEditorialAudit &&
                  meta.radarEditorialAudit.events.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyRadarAudit}
                        className="rounded-full border border-line bg-foam px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink/25"
                      >
                        Copier audit JSON
                      </button>
                      {auditCopyState === "copied" ? (
                        <span className="text-xs text-cream-dim">
                          Copié ({meta.radarEditorialAudit.poolSize})
                        </span>
                      ) : null}
                      {auditCopyState === "error" ? (
                        <span className="text-xs text-coral">
                          Copie impossible
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">#</th>
                        <th className="px-3 py-2.5 font-medium">Titre</th>
                        <th className="px-3 py-2.5 font-medium">Score</th>
                        <th className="px-3 py-2.5 font-medium">Planning</th>
                        <th className="px-3 py-2.5 font-medium">Ville</th>
                        <th className="px-3 py-2.5 font-medium">Inclusion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.aiShortlist.map((item) => (
                        <tr
                          key={item.eventId}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {item.rank}
                          </td>
                          <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                            {item.title}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {item.score}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {item.planningScore}
                          </td>
                          <td className="px-3 py-2.5 text-cream-dim">
                            {item.city || "—"}
                          </td>
                          <td className="max-w-[18rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {item.inclusionReasons.join(" · ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta && meta.aiAssessments && meta.aiAssessments.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  AI highlight assessment
                </h3>
                <p className="text-sm text-cream-dim">
                  Shortlist déterministe évaluée par l’IA — debug. Σ = appeal +
                  missRisk + planningNeed + localRarity + likelyDemand.
                </p>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Titre</th>
                        <th className="px-3 py-2.5 font-medium">Det. rank</th>
                        <th className="px-3 py-2.5 font-medium">
                          AI rank — total
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          AI rank — Détour
                        </th>
                        <th className="px-3 py-2.5 font-medium">Appeal</th>
                        <th className="px-3 py-2.5 font-medium">Miss risk</th>
                        <th className="px-3 py-2.5 font-medium">Planning</th>
                        <th className="px-3 py-2.5 font-medium">Local rarity</th>
                        <th className="px-3 py-2.5 font-medium">Likely demand</th>
                        <th className="px-3 py-2.5 font-medium">Conf.</th>
                        <th className="px-3 py-2.5 font-medium">Σ</th>
                        <th className="px-3 py-2.5 font-medium">Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.aiAssessments.map((assessment) => (
                        <tr
                          key={assessment.eventId}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                            {assessment.title}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {assessment.deterministicRank ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {assessment.aiRankTotal ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sand">
                            {assessment.aiRankDetour ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.appeal}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.missRisk}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.planningNeed}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.localRarity}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.likelyDemand}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-cream-dim">
                            {assessment.confidence.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-ink">
                            {assessment.combined}
                          </td>
                          <td className="max-w-[18rem] px-3 py-2.5 text-[10px] text-cream-dim">
                            {assessment.reasons.join(" · ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {meta && meta.duplicates.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg tracking-tight">
                  Doublons détectés
                </h3>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Conservé</th>
                        <th className="px-3 py-2.5 font-medium">Doublon</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Lieu</th>
                        <th className="px-3 py-2.5 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.duplicates.map((duplicate, index) => (
                        <tr
                          key={`${duplicate.keptTitle}-${duplicate.duplicateTitle}-${index}`}
                          className="border-b border-line/70 align-top last:border-b-0"
                        >
                          <td className="max-w-[14rem] px-3 py-2.5 font-medium text-ink">
                            {duplicate.keptTitle}
                          </td>
                          <td className="max-w-[14rem] px-3 py-2.5 text-cream-dim">
                            {duplicate.duplicateTitle}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                            {formatDebugDate(duplicate.date)}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                            {[duplicate.venue, duplicate.city]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                            {duplicate.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-line bg-paper">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-line bg-foam/60 text-[10px] uppercase tracking-[0.14em] text-sand">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Pertinence</th>
                    <th className="px-3 py-2.5 font-medium">Reason</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Titre</th>
                    <th className="px-3 py-2.5 font-medium">Catégorie brute</th>
                    <th className="px-3 py-2.5 font-medium">Ville</th>
                    <th className="px-3 py-2.5 font-medium">Lieu</th>
                    <th className="px-3 py-2.5 font-medium">Image</th>
                    <th className="px-3 py-2.5 font-medium">Résa</th>
                    <th className="px-3 py-2.5 font-medium">Source</th>
                    <th className="px-3 py-2.5 font-medium">Conditions</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-line/70 align-top last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <RelevanceBadge
                          relevance={event.relevance ?? "uncertain"}
                        />
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 font-mono text-[10px] text-cream-dim">
                        {event.relevanceReason ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                        <div>{event.dateLabel}</div>
                        {event.time ? <div>{event.time}</div> : null}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2.5 font-medium text-ink">
                        {event.sourceUrl || event.registrationUrl ? (
                          <a
                            href={event.registrationUrl ?? event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-line underline-offset-2 hover:decoration-ink"
                          >
                            {event.title}
                          </a>
                        ) : (
                          event.title
                        )}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2.5 text-cream-dim">
                        {event.genre || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-cream-dim">
                        {event.city || "—"}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                        {event.venue || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag ok={Boolean(event.image)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag ok={Boolean(event.registrationUrl)} />
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-cream-dim">
                        {event.source || "—"}
                        {event.sourceUrl ? (
                          <div className="mt-1 truncate text-[10px] text-sand">
                            OpenAgenda
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 text-cream-dim">
                        {event.conditions || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatDebugDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-sand">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function Flag({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full bg-mint/30 px-2 py-0.5 text-[10px] font-medium text-ink"
          : "rounded-full bg-line/60 px-2 py-0.5 text-[10px] text-sand"
      }
    >
      {ok ? "oui" : "non"}
    </span>
  );
}

function RelevanceBadge({ relevance }: { relevance: EventRelevance }) {
  const styles: Record<EventRelevance, string> = {
    culture: "bg-mint/35 text-ink",
    culture_leisure: "bg-sky/25 text-ink",
    uncertain: "bg-sun/30 text-ink",
    out_of_scope: "bg-line text-sand",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[relevance]}`}
    >
      {relevance}
    </span>
  );
}
