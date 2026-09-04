import { describe, expect, it } from "vitest";
import type { AiHighlightAssessment } from "@/domain/ai-highlight-assessment";
import type { DetourEvent } from "@/domain/event";
import {
  localGemScore,
  selectAiDetourHighlights,
  strongEventScore,
  worthPlanningScore,
} from "@/domain/select-ai-detour-highlights";
import type { EventHighlight } from "@/domain/select-detour-highlights";

function event(id: string, title = id): DetourEvent {
  return {
    id,
    title,
    description: null,
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: "Salle",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: null,
    registrationUrl: "https://example.com/book",
    relevance: "culture",
  };
}

function candidate(id: string, title?: string): EventHighlight {
  return {
    event: event(id, title),
    score: 5,
    planningScore: 1,
    reasons: ["headline-appeal"],
  };
}

function assessment(
  eventId: string,
  scores: Partial<
    Pick<
      AiHighlightAssessment,
      | "appeal"
      | "discoveryValue"
      | "planningValue"
      | "recognition"
      | "confidence"
    >
  >,
): AiHighlightAssessment {
  return {
    eventId,
    appeal: scores.appeal ?? 0,
    discoveryValue: scores.discoveryValue ?? 0,
    planningValue: scores.planningValue ?? 0,
    recognition: scores.recognition ?? 0,
    confidence: scores.confidence ?? 0.8,
    reasons: ["test"],
  };
}

describe("selectAiDetourHighlights", () => {
  it("appeal + recognition élevés → strong-event", () => {
    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("local"),
        candidate("plan"),
        candidate("wild"),
      ],
      [
        assessment("star", { appeal: 5, recognition: 5, planningValue: 2 }),
        assessment("local", { appeal: 2, discoveryValue: 5, recognition: 0 }),
        assessment("plan", { appeal: 2, planningValue: 5, recognition: 1 }),
        assessment("wild", { appeal: 3, discoveryValue: 3, planningValue: 3, recognition: 1 }),
      ],
      { limit: 4 },
    );

    expect(highlights[0]?.slot).toBe("strong-event");
    expect(highlights[0]?.event.id).toBe("star");
    expect(highlights[0]?.selectionSource).toBe("ai");
    expect(highlights[0]?.score).toBe(
      strongEventScore(
        assessment("star", { appeal: 5, recognition: 5, planningValue: 2 }),
      ),
    );
  });

  it("discovery très élevée + peu de recognition → local-gem", () => {
    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("gem"),
        candidate("plan"),
        candidate("wild"),
      ],
      [
        assessment("star", { appeal: 5, recognition: 5, planningValue: 1 }),
        assessment("gem", { appeal: 4, discoveryValue: 5, recognition: 0 }),
        assessment("plan", { appeal: 2, planningValue: 5, recognition: 1 }),
        assessment("wild", { appeal: 3, discoveryValue: 2, planningValue: 2, recognition: 1 }),
      ],
      { limit: 4 },
    );

    const localGem = highlights.find((item) => item.slot === "local-gem");
    expect(localGem?.event.id).toBe("gem");
    expect(localGem?.score).toBe(
      localGemScore(assessment("gem", { appeal: 4, discoveryValue: 5 })),
    );
  });

  it("planningValue élevé → worth-planning", () => {
    const highlights = selectAiDetourHighlights(
      [
        candidate("star"),
        candidate("gem"),
        candidate("plan"),
        candidate("wild"),
      ],
      [
        assessment("star", { appeal: 5, recognition: 5, planningValue: 1 }),
        assessment("gem", { appeal: 3, discoveryValue: 5, recognition: 0 }),
        assessment("plan", { appeal: 3, planningValue: 5, recognition: 3 }),
        assessment("wild", { appeal: 2, discoveryValue: 2, planningValue: 2, recognition: 1 }),
      ],
      { limit: 4 },
    );

    const planning = highlights.find((item) => item.slot === "worth-planning");
    expect(planning?.event.id).toBe("plan");
    expect(planning?.score).toBe(
      worthPlanningScore(
        assessment("plan", { appeal: 3, planningValue: 5, recognition: 3 }),
      ),
    );
  });

  it("aucun doublon entre slots", () => {
    const highlights = selectAiDetourHighlights(
      [
        candidate("a"),
        candidate("b"),
        candidate("c"),
        candidate("d"),
      ],
      [
        assessment("a", { appeal: 5, recognition: 5, discoveryValue: 5, planningValue: 5 }),
        assessment("b", { appeal: 4, recognition: 4, discoveryValue: 4, planningValue: 4 }),
        assessment("c", { appeal: 3, recognition: 3, discoveryValue: 3, planningValue: 3 }),
        assessment("d", { appeal: 2, recognition: 2, discoveryValue: 2, planningValue: 2 }),
      ],
      { limit: 4 },
    );

    const ids = highlights.map((item) => item.event.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(highlights.map((item) => item.slot)).toEqual([
      "strong-event",
      "local-gem",
      "worth-planning",
      "wildcard",
    ]);
  });

  it("aucun assessment → [] (fallback appelant)", () => {
    expect(
      selectAiDetourHighlights([candidate("a")], [], { limit: 4 }),
    ).toEqual([]);
  });

  it("ignore les candidats sans assessment", () => {
    const highlights = selectAiDetourHighlights(
      [candidate("only"), candidate("missing")],
      [assessment("only", { appeal: 4, recognition: 4, planningValue: 2 })],
      { limit: 4 },
    );

    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.event.id).toBe("only");
    expect(highlights[0]?.slot).toBe("strong-event");
  });

});
