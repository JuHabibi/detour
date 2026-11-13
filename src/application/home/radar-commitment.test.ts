import { describe, expect, it, vi } from "vitest";
import { EventService } from "@/application/event.service";
import {
  createMemoryRadarCommitmentStore,
  hashPublicHomeSnapshot,
  isRadarAssessmentCommittable,
  projectRadarCommitment,
  toRadarCommitment,
} from "@/application/home/radar-commitment";
import {
  materializePublicHomeData,
  toPublicHomeSnapshotSlim,
} from "@/application/home/get-public-home-data";
import { createMemoryAiAssessmentCacheStore } from "@/application/ai/ai-assessment-cache";
import type { AiConfig } from "@/config/ai-config";
import type { DetourEvent } from "@/domain/events/event";
import type { EventSource } from "@/application/ports/event-source";
import type { HighlightAssessmentProvider } from "@/application/ports/highlight-assessment";
function event(id: string, overrides?: Partial<DetourEvent>): DetourEvent {
  return {
    id,
    title: `Spectacle avec Alice Moreau ${id}`,
    description: `Soirée avec Alice Moreau ${id}.`.padEnd(90, "."),
    imageUrl: null,
    startAt: "2026-11-20T20:00:00.000Z",
    endAt: "2026-11-20T22:00:00.000Z",
    venue: "MJC",
    city: "Olivet",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: "https://example.com",
    registrationUrl: "https://example.com/book",
    relevance: "culture",
    ...overrides,
  };
}

const autoConfig: AiConfig = {
  enabled: true,
  mode: "auto",
  displayMode: "auto",
};

function mockAssessor(
  impl?: HighlightAssessmentProvider["assess"],
): HighlightAssessmentProvider {
  return {
    cacheContext: {
      model: "gpt-4o-mini",
      promptVersion: "detour-ai-assess-v3.1",
      generation: { temperature: 0.2 },
    },
    assess:
      impl ??
      vi.fn().mockImplementation(async (input: DetourEvent[]) =>
        input.map((item, index) => ({
          eventId: item.id,
          appeal: 4 - (index % 2),
          missRisk: 3,
          localRarity: 2 + (index % 3),
          planningNeed: 3,
          likelyDemand: 2 + (index % 2),
          confidence: 0.85,
          reasons: ["test"],
        })),
      ),
  };
}

async function buildSnapshot(events: DetourEvent[]) {
  const source: EventSource = {
    fetchUpcomingEvents: async () => events,
  };
  const service = new EventService(source, mockAssessor(), {
    aiConfig: autoConfig,
    cacheStore: createMemoryAiAssessmentCacheStore(),
  });
  const pipeline = await service.buildUpcomingPipeline({
    from: new Date("2026-11-13T12:00:00.000Z"),
    to: new Date("2027-05-13T12:00:00.000Z"),
  });
  return {
    service,
    snapshot: toPublicHomeSnapshotSlim({
      events: pipeline.events,
      aiShortlist: pipeline.aiShortlist,
      exposeDebug: false,
    }),
  };
}

describe("radar commitment — helpers", () => {
  it("isRadarAssessmentCommittable : cache/fresh complets seulement", () => {
    expect(
      isRadarAssessmentCommittable({
        source: "cache",
        assessmentCount: 10,
        shortlistSize: 10,
      }),
    ).toBe(true);
    expect(
      isRadarAssessmentCommittable({
        source: "fresh",
        assessmentCount: 10,
        shortlistSize: 10,
      }),
    ).toBe(true);
    expect(
      isRadarAssessmentCommittable({
        source: "partial",
        assessmentCount: 10,
        shortlistSize: 10,
      }),
    ).toBe(false);
    expect(
      isRadarAssessmentCommittable({
        source: "fallback",
        assessmentCount: 0,
        shortlistSize: 10,
      }),
    ).toBe(false);
    expect(
      isRadarAssessmentCommittable({
        source: "cache",
        assessmentCount: 5,
        shortlistSize: 10,
      }),
    ).toBe(false);
  });

  it("projectRadarCommitment : drop séance terminée sans refill ; dates à jour", () => {
    const multi = event("A", {
      title: "Concert Jazz Exceptionnel Centre",
      occurrences: [
        {
          startAt: "2026-11-13T18:00:00.000Z",
          endAt: "2026-11-13T19:30:00.000Z",
          allDay: false,
        },
        {
          startAt: "2026-11-20T20:00:00.000Z",
          endAt: "2026-11-20T22:00:00.000Z",
          allDay: false,
        },
      ],
      startAt: "2026-11-13T18:00:00.000Z",
      endAt: "2026-11-13T19:30:00.000Z",
    });
    const ending = event("X", {
      title: "Spectacle Unique Qui Finit",
      startAt: "2026-11-13T17:00:00.000Z",
      endAt: "2026-11-13T18:00:00.000Z",
      occurrences: [
        {
          startAt: "2026-11-13T17:00:00.000Z",
          endAt: "2026-11-13T18:00:00.000Z",
          allDay: false,
        },
      ],
    });
    const keep = event("B", {
      title: "Théâtre avec Marie Dupont",
      startAt: "2026-11-25T20:00:00.000Z",
      endAt: "2026-11-25T22:00:00.000Z",
    });

    const commitment = toRadarCommitment([
      {
        event: ending,
        score: 10,
        planningScore: 1,
        reasons: ["high-appeal"],
        selectionSource: "ai",
      },
      {
        event: multi,
        score: 9,
        planningScore: 1,
        reasons: ["high-appeal"],
        selectionSource: "ai",
      },
      {
        event: keep,
        score: 8,
        planningScore: 0,
        reasons: ["singular"],
        selectionSource: "deterministic",
      },
    ]);

    const before = projectRadarCommitment({
      commitment,
      events: [multi, ending, keep],
      now: new Date("2026-11-13T17:30:00.000Z"),
    });
    expect(before.map((item) => item.event.id)).toEqual(["X", "A", "B"]);
    expect(before[1]?.event.startAt).toBe("2026-11-13T18:00:00.000Z");

    const after = projectRadarCommitment({
      commitment,
      events: [multi, ending, keep],
      now: new Date("2026-11-13T19:31:00.000Z"),
    });
    expect(after.map((item) => item.event.id)).toEqual(["A", "B"]);
    expect(after[0]?.event.startAt).toBe("2026-11-20T20:00:00.000Z");
    expect(after.map((item) => item.event.id)).not.toContain("X");
  });
});

describe("materializePublicHomeData — commitment-first (pipeline réel)", () => {
  const corpus = [
    event("star", {
      title: "Concert Alice Moreau headliner",
      description: "Grande soirée avec Alice Moreau connue.".padEnd(100, "."),
      startAt: "2026-11-20T20:00:00.000Z",
      endAt: "2026-11-20T22:00:00.000Z",
    }),
    event("gem", {
      title: "Atelier local rare médiathèque",
      city: "St Jean de Braye",
      venue: "Médiathèque",
      startAt: "2026-11-18T18:00:00.000Z",
      endAt: "2026-11-18T20:00:00.000Z",
      registrationUrl: null,
    }),
    event("plan", {
      title: "Festival à anticiper Orléans",
      startAt: "2026-12-20T20:00:00.000Z",
      endAt: "2026-12-20T23:00:00.000Z",
    }),
    event("other", {
      title: "Spectacle de quartier humour",
      startAt: "2026-11-22T20:00:00.000Z",
      endAt: "2026-11-22T22:00:00.000Z",
    }),
    event("cine", {
      title: "Projection cinéma rare Saran",
      category: "Cinéma",
      city: "Saran",
      venue: "Médiathèque",
      startAt: "2026-11-16T18:30:00.000Z",
      endAt: "2026-11-16T20:30:00.000Z",
      registrationUrl: null,
    }),
    event("dance", {
      title: "Danse contemporaine Compagnie Nova",
      startAt: "2026-11-19T20:00:00.000Z",
      endAt: "2026-11-19T21:30:00.000Z",
    }),
  ];

  it("même snapshot + commitment → mêmes IDs/ordre ; partial ne réécrit pas", async () => {
    const { service, snapshot } = await buildSnapshot(corpus);
    const store = createMemoryRadarCommitmentStore();
    const now = new Date("2026-11-13T12:00:00.000Z");
    let finalizeCalls = 0;

    const finalize = async (
      pipeline: Parameters<EventService["finalizeUpcomingWithAutoAi"]>[0],
    ) => {
      finalizeCalls += 1;
      return service.finalizeUpcomingWithAutoAi(pipeline);
    };

    const first = await materializePublicHomeData(snapshot, {
      now,
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: finalize,
    });
    const idsFirst = first.highlights.map((item) => item.id);
    expect(idsFirst.length).toBeGreaterThan(0);
    expect(finalizeCalls).toBe(1);

    const stored = await store.read(hashPublicHomeSnapshot(snapshot));
    expect(stored?.items.map((item) => item.eventId)).toEqual(idsFirst);

    // Second materialize : HIT commitment → skip finalize / IA
    const second = await materializePublicHomeData(snapshot, {
      now,
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: async () => {
        finalizeCalls += 1;
        throw new Error("finalize must not run on commitment HIT");
      },
    });
    expect(second.highlights.map((item) => item.id)).toEqual(idsFirst);
    expect(finalizeCalls).toBe(1);

    // Partial path : simulate finalize that would reshuffle — must not run
    const third = await materializePublicHomeData(snapshot, {
      now: new Date("2026-11-13T15:00:00.000Z"),
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: async () => {
        throw new Error("partial finalize must not run");
      },
    });
    expect(third.highlights.map((item) => item.id)).toEqual(idsFirst);
  });

  it("IA indisponible au premier chargement → Home OK, pas de commitment persistant", async () => {
    const { snapshot } = await buildSnapshot(corpus);
    const store = createMemoryRadarCommitmentStore();
    const now = new Date("2026-11-13T12:00:00.000Z");

    const failingSource: EventSource = {
      fetchUpcomingEvents: async () => corpus,
    };
    const failingService = new EventService(
      failingSource,
      mockAssessor(async () => {
        throw new Error("provider down");
      }),
      {
        aiConfig: autoConfig,
        cacheStore: createMemoryAiAssessmentCacheStore(),
      },
    );

    const ephemeral = await materializePublicHomeData(snapshot, {
      now,
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: (pipeline) =>
        failingService.finalizeUpcomingWithAutoAi(pipeline),
    });
    expect(ephemeral.highlights.length).toBeGreaterThan(0);
    expect(await store.read(hashPublicHomeSnapshot(snapshot))).toBeNull();

    // Nouvelle évaluation complete → commitment créé
    const { service } = await buildSnapshot(corpus);
    const committed = await materializePublicHomeData(snapshot, {
      now,
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: (pipeline) =>
        service.finalizeUpcomingWithAutoAi(pipeline),
    });
    const stored = await store.read(hashPublicHomeSnapshot(snapshot));
    expect(stored).not.toBeNull();
    expect(stored?.items.map((item) => item.eventId)).toEqual(
      committed.highlights.map((item) => item.id),
    );
  });

  it("appels concurrents complete : un seul commitment, lecture stable ensuite", async () => {
    const { service, snapshot } = await buildSnapshot(corpus);
    const store = createMemoryRadarCommitmentStore();
    const now = new Date("2026-11-13T12:00:00.000Z");
    const hash = hashPublicHomeSnapshot(snapshot);

    const results = await Promise.all([
      materializePublicHomeData(snapshot, {
        now,
        commitmentStore: store,
        finalizeUpcomingWithAutoAi: (pipeline) =>
          service.finalizeUpcomingWithAutoAi(pipeline),
      }),
      materializePublicHomeData(snapshot, {
        now,
        commitmentStore: store,
        finalizeUpcomingWithAutoAi: (pipeline) =>
          service.finalizeUpcomingWithAutoAi(pipeline),
      }),
    ]);

    const stored = await store.read(hash);
    expect(stored).not.toBeNull();
    const committedIds = stored!.items.map((item) => item.eventId);

    // Les deux courses ont pu écrire ; le store garde le dernier write.
    // Après coup, tout materialize doit coller au commitment stocké.
    for (const result of results) {
      // Pendant la course, chaque résultat est une sélection complete valide ;
      // la stabilité stricte s’applique après commitment.
      expect(result.highlights.length).toBeGreaterThan(0);
    }

    const after = await materializePublicHomeData(snapshot, {
      now,
      commitmentStore: store,
      finalizeUpcomingWithAutoAi: async () => {
        throw new Error("must use commitment");
      },
    });
    expect(after.highlights.map((item) => item.id)).toEqual(committedIds);
  });
});
