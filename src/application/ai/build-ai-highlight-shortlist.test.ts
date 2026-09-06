import { describe, expect, it } from "vitest";
import {
  AI_SHORTLIST_DETERMINISTIC_TOP,
  buildAiHighlightShortlist,
} from "@/application/ai/build-ai-highlight-shortlist";
import type { DetourEvent } from "@/domain/events/event";
import type { EventHighlight } from "@/domain/editorial/select-detour-highlights";
import { AI_HIGHLIGHT_SHORTLIST_SIZE } from "@/application/ai/build-ai-highlight-shortlist";

function event(
  id: string,
  overrides: Partial<DetourEvent> = {},
): DetourEvent {
  return {
    id,
    title: overrides.title ?? `Event ${id}`,
    description: overrides.description ?? "Description culturelle.".padEnd(90, "."),
    imageUrl: null,
    startAt: overrides.startAt ?? "2026-10-01T20:00:00+02:00",
    endAt: null,
    venue: overrides.venue ?? "Salle",
    city: overrides.city ?? "Orléans",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: "https://example.com",
    registrationUrl:
      overrides.registrationUrl === undefined
        ? null
        : overrides.registrationUrl,
    relevance: "culture",
  };
}

function candidate(
  id: string,
  opts: {
    score?: number;
    planningScore?: number;
    city?: string;
    startAt?: string;
    registrationUrl?: string | null;
    title?: string;
    description?: string;
  } = {},
): EventHighlight {
  return {
    event: event(id, {
      city: opts.city,
      startAt: opts.startAt,
      registrationUrl: opts.registrationUrl,
      title: opts.title,
      description: opts.description,
    }),
    score: opts.score ?? 5,
    planningScore: opts.planningScore ?? 0,
    reasons: ["high-appeal"],
  };
}

/** Events Orléans sans booking, score décroissant, dates croissantes. */
function baseOrleansRanked(count = 40): EventHighlight[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const start = new Date(Date.UTC(2026, 9, 1 + index, 18, 0, 0));
    return candidate(`det-${n}`, {
      score: Math.max(1, 40 - index),
      planningScore: 0,
      city: "Orléans",
      startAt: start.toISOString(),
      registrationUrl: null,
    });
  });
}

describe("buildAiHighlightShortlist", () => {
  it("pool <= 60 et aucun doublon", () => {
    const ranked = [
      ...baseOrleansRanked(35),
      ...Array.from({ length: 40 }, (_, index) =>
        candidate(`extra-${index}`, {
          score: 3,
          planningScore: index % 4,
          city: index % 2 === 0 ? "Chécy" : "Saran",
          startAt: `2027-0${(index % 9) + 1}-15T20:00:00+01:00`,
          registrationUrl:
            index % 3 === 0 ? `https://book.example/${index}` : null,
        }),
      ),
    ];

    const { shortlist } = buildAiHighlightShortlist(ranked);

    expect(shortlist.length).toBeLessThanOrEqual(AI_HIGHLIGHT_SHORTLIST_SIZE);
    expect(shortlist.length).toBeLessThanOrEqual(60);
    expect(new Set(shortlist.map((item) => item.event.id)).size).toBe(
      shortlist.length,
    );
  });

  it("top deterministic toujours représenté en tête", () => {
    const ranked = baseOrleansRanked(40);
    const { shortlist, inclusionById } = buildAiHighlightShortlist(ranked);

    const expectedTop = ranked
      .slice(0, AI_SHORTLIST_DETERMINISTIC_TOP)
      .map((item) => item.event.id);

    expect(shortlist.slice(0, expectedTop.length).map((item) => item.event.id)).toEqual(
      expectedTop,
    );

    for (const id of expectedTop) {
      expect(inclusionById.get(id)).toContain("deterministic-top");
    }
  });

  it("un événement planning fort peut entrer hors top 30 global", () => {
    const ranked = [
      ...baseOrleansRanked(30),
      candidate("plan-late", {
        score: 2,
        planningScore: 3,
        city: "Orléans",
        startAt: "2026-11-01T20:00:00+01:00",
        registrationUrl: "https://book.example/plan",
      }),
    ];

    const { shortlist, inclusionById } = buildAiHighlightShortlist(ranked);
    const ids = shortlist.map((item) => item.event.id);

    expect(ids).toContain("plan-late");
    expect(inclusionById.get("plan-late")).toContain("planning-top");
    expect(ids.indexOf("plan-late")).toBeGreaterThanOrEqual(30);
  });

  it("un événement périphérique peut entrer hors top 30 global", () => {
    const ranked = [
      ...baseOrleansRanked(30),
      candidate("checy-gem", {
        score: 4,
        planningScore: 0,
        city: "Chécy",
        startAt: "2026-11-05T20:00:00+01:00",
        registrationUrl: null,
        title: "LE BOURGEOIS GENTILHOMME - SAISON CULTURELLE 26/27",
        description: "Jean-Paul Rouve n’a qu’un objectif, nous faire rire.",
      }),
    ];

    const { shortlist, inclusionById } = buildAiHighlightShortlist(ranked);
    expect(shortlist.map((item) => item.event.id)).toContain("checy-gem");
    expect(inclusionById.get("checy-gem")).toContain("peripheral-top");
  });

  it("un événement futur lointain peut entrer", () => {
    const ranked = [
      ...baseOrleansRanked(30),
      candidate("far-future", {
        score: 2,
        planningScore: 0,
        city: "Orléans",
        startAt: "2027-02-28T20:00:00+01:00",
        registrationUrl: null,
      }),
    ];

    const { shortlist, inclusionById } = buildAiHighlightShortlist(ranked);
    expect(shortlist.map((item) => item.event.id)).toContain("far-future");
    expect(inclusionById.get("far-future")).toContain("future-top");
  });

  it("ordre stable / déterministe entre deux appels", () => {
    const ranked = [
      ...baseOrleansRanked(30),
      candidate("a", {
        score: 4,
        planningScore: 3,
        city: "Saran",
        startAt: "2027-01-10T20:00:00+01:00",
        registrationUrl: "https://book.example/a",
      }),
      candidate("b", {
        score: 4,
        planningScore: 2,
        city: "Chécy",
        startAt: "2027-01-20T20:00:00+01:00",
        registrationUrl: null,
      }),
    ];

    const first = buildAiHighlightShortlist(ranked).shortlist.map(
      (item) => item.event.id,
    );
    const second = buildAiHighlightShortlist(ranked).shortlist.map(
      (item) => item.event.id,
    );

    expect(first).toEqual(second);
  });

  it("cumule plusieurs raisons d’inclusion", () => {
    const ranked = [
      candidate("multi", {
        score: 10,
        planningScore: 3,
        city: "Chécy",
        startAt: "2027-03-01T20:00:00+01:00",
        registrationUrl: "https://book.example/multi",
      }),
      ...baseOrleansRanked(20),
    ];

    const { inclusionById } = buildAiHighlightShortlist(ranked);
    const reasons = inclusionById.get("multi") ?? [];

    expect(reasons).toContain("deterministic-top");
    expect(reasons).toEqual(
      expect.arrayContaining([
        "deterministic-top",
        "planning-top",
        "booking-top",
        "peripheral-top",
        "future-top",
      ]),
    );
  });

  it("bucketSizes reflète les sous-sélections avant cap", () => {
    const ranked = baseOrleansRanked(40);
    const { bucketSizes, shortlist } = buildAiHighlightShortlist(ranked);

    expect(bucketSizes["deterministic-top"]).toBe(30);
    expect(shortlist.length).toBeLessThanOrEqual(60);
  });
});
