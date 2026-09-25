import { describe, expect, it, vi } from "vitest";
import {
  buildEditorialQualityFunnel,
  findEventTrace,
} from "@/application/debug/build-editorial-quality-funnel";
import { EventService } from "@/application/event.service";
import { createMemoryAiAssessmentCacheStore } from "@/application/ai/ai-assessment-cache";
import { buildSourceIngestionStats } from "@/application/ingestion/source-ingestion-stats";
import type { AiConfig } from "@/config/ai-config";
import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import type { HighlightAssessmentProvider } from "@/application/ports/highlight-assessment";
import type { IngestingEventSource } from "@/application/ports/event-source";
import { ingestionFromPlainEvents } from "@/application/ingestion/event-ingestion-result";

const disabledAi: AiConfig = {
  enabled: false,
  mode: "auto",
  displayMode: "disabled",
};

const NOW = new Date("2026-09-25T10:00:00+02:00");
const FROM = NOW;
const TO = new Date("2027-03-24T10:00:00+02:00");

function baseEvent(
  overrides: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-10-15T20:00:00+02:00",
    endAt: "2026-10-15T22:00:00+02:00",
    venue: "Salle Test",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: "Test",
    sourceUrl: "https://example.test/e",
    registrationUrl: null,
    ...overrides,
  };
}

/** Culturel scorable (reasons déterministes). */
function culturalRelevant(): DetourEvent {
  return baseEvent({
    id: "test:cultural",
    title: "Concert jazz avec Alice Moreau",
    description:
      "Soirée concert jazz exceptionnelle avec la chanteuse Alice Moreau en live.".padEnd(
        100,
        ".",
      ),
    category: "Concert",
    registrationUrl: "https://example.test/book",
    venue: "Astrolabe",
    city: "Orléans",
    imageUrl: "https://img.openagenda.com/u/test.jpg",
  });
}

/** Doublon éditorial du culturel (même soirée, moins riche). */
function culturalDuplicate(): DetourEvent {
  return baseEvent({
    id: "test:cultural-dup",
    title: "Concert jazz avec Alice Moreau",
    description: "Doublon.",
    category: "Concert",
    venue: "Astrolabe",
    city: "Orléans",
    sourceUrl: "https://example.test/e",
  });
}

function outOfScopeSport(): DetourEvent {
  return baseEvent({
    id: "test:sport",
    title: "Match de football local",
    description: "Rencontre sportive du week-end.",
    category: "Sport",
    city: "Ingré",
    venue: "Stade",
  });
}

function uncertainVenueOnly(): DetourEvent {
  return baseEvent({
    id: "test:uncertain",
    title: "Rendez-vous du mardi",
    description: "Séance hebdomadaire.",
    category: null,
    venue: "Médiathèque La Parenthèse",
    city: "Ingré",
  });
}

function noopAssessor(): HighlightAssessmentProvider {
  return {
    cacheContext: {
      model: "noop",
      promptVersion: "noop",
      generation: { temperature: 0 },
    },
    assess: vi.fn().mockResolvedValue([]),
  };
}

function mockIngestingSource(
  events: DetourEvent[],
): EventSource & IngestingEventSource {
  return {
    fetchUpcomingEvents: async () => events,
    ingestUpcomingEvents: async () => {
      const byAdapter = new Map<string, string>();
      for (const event of events) {
        const adapterId = event.id.startsWith("test:sport")
          ? "ingre-agenda"
          : event.id.includes("uncertain")
            ? "ingre-agenda"
            : "orleans";
        byAdapter.set(event.id, adapterId);
      }
      const base = ingestionFromPlainEvents(events, "orleans");
      return {
        ...base,
        adapterByEventId: byAdapter,
        adapterOrder: ["orleans", "ingre-agenda"],
        statusByAdapter: new Map([
          ["orleans", "ok"],
          ["ingre-agenda", "ok"],
        ]),
        sourceNameByAdapter: new Map([
          ["orleans", "Orléans / OpenAgenda"],
          ["ingre-agenda", "Ville d'Ingré (agenda)"],
        ]),
        rawCountByAdapter: new Map([
          [
            "orleans",
            events.filter((e) => byAdapter.get(e.id) === "orleans").length,
          ],
          [
            "ingre-agenda",
            events.filter((e) => byAdapter.get(e.id) === "ingre-agenda")
              .length,
          ],
        ]),
      };
    },
  };
}

describe("buildEditorialQualityFunnel", () => {
  it("distingue culture / hors périmètre / uncertain / doublon / Explorer≠Radar", async () => {
    const events = [
      culturalRelevant(),
      culturalDuplicate(),
      outOfScopeSport(),
      uncertainVenueOnly(),
    ];

    const source = mockIngestingSource(events);

    const service = new EventService(source, noopAssessor(), {
      aiConfig: disabledAi,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    });

    const pipeline = await service.buildUpcomingPipeline({ from: FROM, to: TO });
    const result = await service.getUpcomingEvents({ from: FROM, to: TO });

    const sourceIngestion = buildSourceIngestionStats({
      ingestion: pipeline.ingestion,
      classifiedEvents: pipeline.classifiedEvents,
      dedupedEvents: pipeline.events,
      duplicates: pipeline.duplicates,
    });

    const explorerRepresentatives = pipeline.classifiedEvents.filter(
      (e) =>
        e.id === "test:cultural" ||
        e.id === "test:sport" ||
        e.id === "test:uncertain",
    );

    const report = buildEditorialQualityFunnel({
      window: { from: FROM, to: TO },
      generatedAt: "2026-09-25T10:00:00.000Z",
      ingestedBeforeFreshness: pipeline.ingestion.events.length,
      classifiedEvents: pipeline.classifiedEvents,
      afterDedup: pipeline.events,
      duplicates: pipeline.duplicates,
      rankedCandidates: pipeline.rankedCandidates,
      aiShortlist: pipeline.aiShortlist,
      aiShortlistInclusion: pipeline.aiShortlistInclusion,
      highlights: result.highlights,
      sourceIngestion,
      explorer: {
        totalRepresentatives: explorerRepresentatives.length,
        representativeEvents: explorerRepresentatives,
        representativesComplete: true,
      },
      traceEventIds: [
        "test:cultural",
        "test:cultural-dup",
        "test:sport",
        "test:uncertain",
      ],
    });

    expect(report.corpus.afterFreshness).toBe(4);
    expect(report.corpus.droppedByFreshness).toBe(0);
    expect(report.corpus.imageUrlRenderable).toBeGreaterThanOrEqual(1);

    expect(report.classification.culture + report.classification.culture_leisure).toBeGreaterThanOrEqual(1);
    expect(report.classification.out_of_scope).toBeGreaterThanOrEqual(1);
    expect(Object.keys(report.classification.reasons).length).toBeGreaterThan(0);

    expect(report.radar.duplicatesRemoved).toBeGreaterThanOrEqual(1);
    expect(report.radar.afterDedup).toBe(report.corpus.afterFreshness - report.radar.duplicatesRemoved);
    expect(report.radar.selectedFinal).toBeGreaterThanOrEqual(1);
    expect(report.radar.shortlistAudit.poolSize).toBe(report.radar.shortlistSize);

    expect(report.explorer).not.toBeNull();
    expect(report.explorer!.nonCulturalVolume).toBeGreaterThanOrEqual(1);
    expect(report.explorer!.inExplorerNotInRadarSelection).toEqual(
      expect.arrayContaining(["test:sport", "test:uncertain"]),
    );

    const cultural = findEventTrace(report, "test:cultural");
    expect(cultural?.keptAfterDedup).toBe(true);
    expect(cultural?.selectedInRadar).toBe(true);
    expect(cultural?.explorerRepresentative).toBe(true);

    const dup = findEventTrace(report, "test:cultural-dup");
    expect(dup?.keptAfterDedup).toBe(false);
    expect(dup?.duplicateOfId).toBe("test:cultural");
    expect(dup?.selectedInRadar).toBe(false);

    const sport = findEventTrace(report, "test:sport");
    expect(sport?.relevance).toBe("out_of_scope");
    expect(sport?.scoredForRadar).toBe(false);
    expect(sport?.selectedInRadar).toBe(false);
    expect(sport?.explorerRepresentative).toBe(true);

    const uncertain = findEventTrace(report, "test:uncertain");
    expect(uncertain?.relevance).toBe("uncertain");
    expect(uncertain?.selectedInRadar).toBe(false);
    expect(uncertain?.explorerRepresentative).toBe(true);

    expect(report.limits.adapterInternalExclusionsNotVisible).toBe(true);
  });

  it("diagnostic: selectedInRadar hors shortlist = fallback déterministe (pas un bug)", () => {
    const kept = culturalRelevant();
    const alsoSelected = baseEvent({
      id: "test:outside-shortlist",
      title: "Exposition photo rare avec billetterie",
      description:
        "Grande exposition photographique exceptionnelle à ne pas manquer.".padEnd(
          100,
          ".",
        ),
      category: "Exposition",
      registrationUrl: "https://example.test/expo",
      venue: "Musée",
      city: "Orléans",
      startAt: "2026-11-01T15:00:00+01:00",
      endAt: "2026-11-01T18:00:00+01:00",
    });

    const shortlistCandidate = {
      event: kept,
      score: 10,
      planningScore: 2,
      reasons: ["high-appeal" as const],
    };
    const highlights = [
      {
        ...shortlistCandidate,
        selectionSource: "deterministic" as const,
      },
      {
        event: alsoSelected,
        score: 8,
        planningScore: 1,
        reasons: ["high-appeal" as const],
        selectionSource: "deterministic" as const,
      },
    ];

    const report = buildEditorialQualityFunnel({
      window: { from: FROM, to: TO },
      generatedAt: "2026-09-25T10:00:00.000Z",
      ingestedBeforeFreshness: 2,
      classifiedEvents: [
        { ...kept, relevance: "culture", relevanceReason: "cultural-keyword:concert" },
        {
          ...alsoSelected,
          relevance: "culture",
          relevanceReason: "strong-category:exposition",
        },
      ],
      afterDedup: [
        { ...kept, relevance: "culture", relevanceReason: "cultural-keyword:concert" },
        {
          ...alsoSelected,
          relevance: "culture",
          relevanceReason: "strong-category:exposition",
        },
      ],
      duplicates: [],
      rankedCandidates: highlights,
      aiShortlist: [shortlistCandidate],
      aiShortlistInclusion: { [kept.id]: ["deterministic-top"] },
      highlights,
      sourceIngestion: [],
      traceEventIds: [kept.id, alsoSelected.id],
    });

    expect(report.radar.selectionSource).toBe("deterministic");
    expect(report.radar.selectedOutsideAiShortlist).toBe(1);

    const inside = findEventTrace(report, kept.id);
    expect(inside?.inAiShortlist).toBe(true);
    expect(inside?.selectedInRadar).toBe(true);
    expect(inside?.radarSelectionPath).toBe("via_deterministic_fallback");

    const outside = findEventTrace(report, alsoSelected.id);
    expect(outside?.inAiShortlist).toBe(false);
    expect(outside?.selectedInRadar).toBe(true);
    expect(outside?.radarSelectionPath).toBe("via_deterministic_fallback");
  });

  it("sans slice Explorer → explorer null (limite explicite)", async () => {
    const source: EventSource = {
      fetchUpcomingEvents: async () => [culturalRelevant()],
    };
    const service = new EventService(source, noopAssessor(), {
      aiConfig: disabledAi,
      cacheStore: createMemoryAiAssessmentCacheStore(),
    });
    const pipeline = await service.buildUpcomingPipeline({ from: FROM, to: TO });
    const result = await service.getUpcomingEvents({ from: FROM, to: TO });

    const report = buildEditorialQualityFunnel({
      window: { from: FROM, to: TO },
      ingestedBeforeFreshness: pipeline.ingestion.events.length,
      classifiedEvents: pipeline.classifiedEvents,
      afterDedup: pipeline.events,
      duplicates: pipeline.duplicates,
      rankedCandidates: pipeline.rankedCandidates,
      aiShortlist: pipeline.aiShortlist,
      aiShortlistInclusion: pipeline.aiShortlistInclusion,
      highlights: result.highlights,
      sourceIngestion: result.sourceIngestion,
    });

    expect(report.explorer).toBeNull();
    expect(report.limits.explorerRequiresSeparateQuery).toBe(true);
  });
});
