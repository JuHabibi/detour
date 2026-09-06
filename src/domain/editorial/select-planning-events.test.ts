import { describe, expect, it } from "vitest";
import type { AiHighlightAssessment } from "@/domain/editorial/highlight-assessment";
import type { DetourEvent } from "@/domain/events/event";
import { selectPlanningEvents } from "@/domain/editorial/select-planning-events";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";

const NOW = new Date("2026-09-04T12:00:00+02:00");

function event(
  id: string,
  overrides: Partial<DetourEvent> = {},
): DetourEvent {
  return {
    id,
    title: overrides.title ?? `Event ${id}`,
    description: overrides.description ?? "Description culturelle assez longue.".padEnd(80, "."),
    imageUrl: null,
    startAt: overrides.startAt ?? "2026-11-12T20:00:00+02:00",
    endAt: null,
    venue: overrides.venue ?? `Venue ${id}`,
    city: overrides.city ?? "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: overrides.source ?? `Source ${id}`,
    sourceUrl: null,
    registrationUrl: overrides.registrationUrl ?? "https://example.com/book",
    relevance: overrides.relevance ?? "culture",
  };
}

function assessment(
  eventId: string,
  scores: Partial<AiHighlightAssessment>,
): AiHighlightAssessment {
  return {
    eventId,
    appeal: scores.appeal ?? 0,
    missRisk: scores.missRisk ?? 0,
    planningNeed: scores.planningNeed ?? 0,
    localRarity: scores.localRarity ?? 0,
    likelyDemand: scores.likelyDemand ?? 0,
    confidence: scores.confidence ?? 0.8,
    reasons: scores.reasons ?? ["ok"],
  };
}

function candidate(
  id: string,
  planningScore: number,
  score = 4,
): EventHighlight {
  return {
    event: event(id),
    score,
    planningScore,
    reasons: ["headline-appeal", "booking-available"],
  };
}

describe("selectPlanningEvents", () => {
  it("candidat IA éligible prioritaire sur fallback déterministe (même score numérique plus haut)", () => {
    const result = selectPlanningEvents({
      events: [event("ai-low"), event("det-high")],
      now: NOW,
      limit: 1,
      aiAssessments: [
        assessment("ai-low", { planningNeed: 3, appeal: 0, likelyDemand: 0 }),
      ],
      deterministicCandidates: [
        candidate("ai-low", 0, 0),
        // score déterministe 3*5+3+5 = 23 > score IA 9
        candidate("det-high", 3, 5),
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.event.id).toBe("ai-low");
    expect(result[0]?.pool).toBe("ai");
    expect(result[0]?.rankInPool).toBe(1);
  });

  it("fallback utilisé si moins de 4 candidats IA", () => {
    const result = selectPlanningEvents({
      events: [event("ai1"), event("ai2"), event("d1"), event("d2"), event("d3")],
      now: NOW,
      limit: 4,
      aiAssessments: [
        assessment("ai1", { planningNeed: 4, appeal: 2, likelyDemand: 1 }),
        assessment("ai2", { planningNeed: 3, appeal: 1, likelyDemand: 1 }),
      ],
      deterministicCandidates: [
        candidate("ai1", 1),
        candidate("ai2", 1),
        candidate("d1", 3),
        candidate("d2", 2),
        candidate("d3", 2),
      ],
    });

    expect(result).toHaveLength(4);
    expect(result.filter((item) => item.pool === "ai")).toHaveLength(2);
    expect(result.filter((item) => item.pool === "deterministic-fallback")).toHaveLength(
      2,
    );
    expect(result.slice(0, 2).every((item) => item.pool === "ai")).toBe(true);
  });

  it("aucun assessment IA → comportement déterministe actuel", () => {
    const result = selectPlanningEvents({
      events: [event("weak"), event("strong")],
      now: NOW,
      aiAssessments: [],
      deterministicCandidates: [
        candidate("weak", 2, 2),
        candidate("strong", 3, 4),
      ],
    });

    expect(result[0]?.event.id).toBe("strong");
    expect(result.every((item) => item.pool === "deterministic-fallback")).toBe(
      true,
    );
  });

  it("exclut un événement à moins de 30 jours", () => {
    const near = event("near", {
      startAt: "2026-09-20T20:00:00+02:00",
    });
    const far = event("far", {
      startAt: "2026-11-12T20:00:00+02:00",
    });

    const result = selectPlanningEvents({
      events: [near, far],
      now: NOW,
      limit: 4,
      deterministicCandidates: [
        candidate("near", 3),
        candidate("far", 2),
      ],
    });

    expect(result.map((item) => item.event.id)).toEqual(["far"]);
  });

  it("exclut les événements déjà dans Faites un détour", () => {
    const result = selectPlanningEvents({
      events: [event("a"), event("b")],
      excludedEventIds: ["a"],
      now: NOW,
      aiAssessments: [
        assessment("a", { planningNeed: 5, appeal: 5, likelyDemand: 5 }),
        assessment("b", { planningNeed: 3, appeal: 1, likelyDemand: 0 }),
      ],
    });

    expect(result.map((item) => item.event.id)).toEqual(["b"]);
  });

  it("planningNeed 2 → exclu du pool IA ; planningNeed 3 → éligible", () => {
    const result = selectPlanningEvents({
      events: [event("pv2"), event("pv3")],
      now: NOW,
      aiAssessments: [
        assessment("pv2", { planningNeed: 2, appeal: 5, likelyDemand: 5 }),
        assessment("pv3", { planningNeed: 3, appeal: 1, likelyDemand: 0 }),
      ],
      deterministicCandidates: [candidate("pv2", 3), candidate("pv3", 0)],
    });

    // pv2 a un assessment → pas de fallback déterministe malgré planningScore 3
    expect(result.map((item) => item.event.id)).toEqual(["pv3"]);
    expect(result[0]?.pool).toBe("ai");
  });

  it("planningScore 1 → exclu ; planningScore 2 → éligible (fallback)", () => {
    const result = selectPlanningEvents({
      events: [event("ps1"), event("ps2")],
      now: NOW,
      aiAssessments: [],
      deterministicCandidates: [
        candidate("ps1", 1, 5),
        candidate("ps2", 2, 2),
      ],
    });

    expect(result.map((item) => item.event.id)).toEqual(["ps2"]);
  });

  it("diversité venue toujours respectée dans le pool IA", () => {
    const result = selectPlanningEvents({
      events: [
        event("a", { venue: "Même salle", source: "S1" }),
        event("b", { venue: "Même salle", source: "S2" }),
        event("c", { venue: "Autre", source: "S3" }),
      ],
      now: NOW,
      limit: 3,
      aiAssessments: [
        assessment("a", { planningNeed: 5, appeal: 3, likelyDemand: 2 }),
        assessment("b", { planningNeed: 4, appeal: 3, likelyDemand: 2 }),
        assessment("c", { planningNeed: 3, appeal: 3, likelyDemand: 2 }),
      ],
    });

    const venues = result.map((item) => item.event.venue);
    expect(venues.filter((venue) => venue === "Même salle")).toHaveLength(1);
    expect(result.map((item) => item.event.id)).toContain("c");
  });

  it("pas de doublon et limit respectée", () => {
    const events = ["a", "b", "c", "d", "e"].map((id) => event(id));
    const result = selectPlanningEvents({
      events,
      now: NOW,
      limit: 4,
      aiAssessments: events.map((item, index) =>
        assessment(item.id, {
          planningNeed: 5 - Math.min(index, 2),
          appeal: 3,
          likelyDemand: 2,
        }),
      ),
    });

    expect(result).toHaveLength(4);
    expect(new Set(result.map((item) => item.event.id)).size).toBe(4);
    expect(result.every((item) => item.pool === "ai")).toBe(true);
  });
});
