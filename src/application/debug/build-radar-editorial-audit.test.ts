import { describe, expect, it } from "vitest";
import {
  buildRadarEditorialAudit,
  type RadarEditorialAuditEvent,
} from "@/application/debug/build-radar-editorial-audit";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";
import type { DetourEvent } from "@/domain/events/event";

function event(
  overrides: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-10-01T20:00:00+02:00",
    endAt: null,
    venue: null,
    city: null,
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...overrides,
  };
}

function candidate(
  item: DetourEvent,
  overrides: Partial<EventHighlight> = {},
): EventHighlight {
  return {
    event: item,
    score: 5,
    planningScore: 2,
    reasons: ["high-appeal"],
    ...overrides,
  };
}

describe("buildRadarEditorialAudit", () => {
  it("exporte le pool avec faits source séparés du bloc engine", () => {
    const factual = event({
      id: "openagenda:1",
      title: "Concert",
      description: "Une soirée",
      venue: "Astrolabe",
      city: "Orléans",
      category: "Musique",
      genre: "Jazz",
      conditions: "12 €",
      source: "OpenAgenda",
      sourceUrl: "https://example.test/1",
      registrationUrl: "https://example.test/book",
      endAt: "2026-10-01T22:00:00+02:00",
    });

    const export_ = buildRadarEditorialAudit({
      generatedAt: "2026-09-07T12:00:00.000Z",
      aiShortlist: [candidate(factual, { score: 7, planningScore: 3 })],
      aiShortlistInclusion: {
        "openagenda:1": ["deterministic-top", "booking-top"],
      },
      highlights: [
        {
          ...candidate(factual, {
            score: 9,
            slot: "strong-event",
            selectionSource: "ai",
            aiSelection: {
              formula: "strong",
              slotScore: 12,
              appeal: 4,
              missRisk: 3,
              planningNeed: 2,
              localRarity: 3,
              likelyDemand: 2,
              confidence: 4,
              aiReasons: ["live-show"],
            },
          }),
        },
      ],
      aiAssessments: [
        {
          eventId: "openagenda:1",
          appeal: 4,
          missRisk: 3,
          planningNeed: 2,
          localRarity: 3,
          likelyDemand: 2,
          confidence: 4,
          reasons: ["live-show"],
        },
      ],
    });

    expect(export_.poolSize).toBe(1);
    expect(export_.generatedAt).toBe("2026-09-07T12:00:00.000Z");

    const row = export_.events[0] as RadarEditorialAuditEvent;
    expect(row).toMatchObject({
      id: "openagenda:1",
      title: "Concert",
      description: "Une soirée",
      startAt: "2026-10-01T20:00:00+02:00",
      endAt: "2026-10-01T22:00:00+02:00",
      venue: "Astrolabe",
      city: "Orléans",
      category: "Musique",
      genre: "Jazz",
      conditions: "12 €",
      source: "OpenAgenda",
      sourceUrl: "https://example.test/1",
      registrationUrl: "https://example.test/book",
    });
    expect(Object.keys(row).sort()).toEqual(
      [
        "category",
        "city",
        "conditions",
        "description",
        "endAt",
        "engine",
        "genre",
        "id",
        "registrationUrl",
        "source",
        "sourceUrl",
        "startAt",
        "title",
        "venue",
      ].sort(),
    );
    expect(row.engine).toEqual({
      deterministicRank: 1,
      deterministicScore: 7,
      planningScore: 3,
      candidatePoolInclusionReasons: ["deterministic-top", "booking-top"],
      aiAssessment: {
        appeal: 4,
        missRisk: 3,
        planningNeed: 2,
        localRarity: 3,
        likelyDemand: 2,
        confidence: 4,
        reasons: ["live-show"],
      },
      selectedInRadar: true,
      radarRank: 1,
      slot: "strong-event",
      editorialBadge: null,
    });
  });

  it("met null pour les absences et hors radar", () => {
    const sparse = event({
      id: "saran:2",
      title: "Atelier",
    });

    const export_ = buildRadarEditorialAudit({
      generatedAt: "2026-09-07T12:00:00.000Z",
      aiShortlist: [candidate(sparse)],
      aiShortlistInclusion: {},
      highlights: [],
      aiAssessments: [],
    });

    const row = export_.events[0]!;
    expect(row.description).toBeNull();
    expect(row.endAt).toBeNull();
    expect(row.venue).toBeNull();
    expect(row.city).toBeNull();
    expect(row.category).toBeNull();
    expect(row.engine.aiAssessment).toBeNull();
    expect(row.engine.selectedInRadar).toBe(false);
    expect(row.engine.radarRank).toBeNull();
    expect(row.engine.slot).toBeNull();
    expect(row.engine.editorialBadge).toBeNull();
    expect(row.engine.candidatePoolInclusionReasons).toEqual([]);
  });

  it("couvre tout le shortlist dans l’ordre du pool", () => {
    const a = event({ id: "a", title: "A" });
    const b = event({ id: "b", title: "B" });
    const export_ = buildRadarEditorialAudit({
      aiShortlist: [candidate(a), candidate(b)],
      aiShortlistInclusion: { a: ["future-top"], b: ["planning-top"] },
      highlights: [],
      aiAssessments: [],
    });
    expect(export_.events.map((item) => item.id)).toEqual(["a", "b"]);
    expect(export_.events.map((item) => item.engine.deterministicRank)).toEqual([
      1, 2,
    ]);
  });
});
