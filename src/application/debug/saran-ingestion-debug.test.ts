import { describe, expect, it } from "vitest";
import {
  buildSaranClassificationAudit,
  buildSaranDuplicateDebug,
} from "@/application/debug/saran-ingestion-debug";
import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import { deduplicateEvents } from "@/domain/deduplicate-events";
import type { DetourEvent } from "@/domain/event";

function baseEvent(
  overrides: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-09-12T20:00:00+02:00",
    endAt: null,
    venue: "Salle Jean Vilar",
    city: "Saran",
    latitude: null,
    longitude: null,
    category: "Spectacle",
    genre: null,
    conditions: null,
    source: "Agenda",
    sourceUrl: null,
    registrationUrl: null,
    ...overrides,
  };
}

function classifyAll(events: DetourEvent[]): DetourEvent[] {
  return events.map((event) => {
    const classification = classifyEventRelevance(event);
    return {
      ...event,
      relevance: classification.relevance,
      relevanceReason: classification.reason,
    };
  });
}

describe("Saran ingestion debug", () => {
  it("Saran classification audit : counts + tri out_of_scope d’abord", () => {
    const classified = classifyAll([
      baseEvent({ id: "saran:c", title: "Concert jazz" }),
      baseEvent({
        id: "saran:x",
        title: "Cours de yoga",
        category: "Sport",
        description: "Séance douce pour débutants dans le parc.",
      }),
      baseEvent({
        id: "saran:l",
        title: "Balade nature",
        category: "Loisirs",
        description: "Sortie familiale en forêt.",
      }),
      baseEvent({ id: "oa-1", title: "Concert Orléans" }),
    ]);

    const audit = buildSaranClassificationAudit({
      classifiedEvents: classified,
      adapterByEventId: new Map([
        ["saran:c", "saran"],
        ["saran:x", "saran"],
        ["saran:l", "saran"],
        ["oa-1", "orleans"],
      ]),
    });

    expect(audit.total).toBe(3);
    expect(audit.culture).toBe(1);
    expect(audit.outOfScope).toBeGreaterThanOrEqual(1);
    expect(audit.rows[0]?.relevance).toBe("out_of_scope");
    expect(audit.rows.some((row) => row.eventId === "oa-1")).toBe(false);
    expect(
      audit.rows.find((row) => row.eventId === "saran:x")?.descriptionSnippet,
    ).toContain("Séance douce");
  });

  it("Saran duplicates après dédup cross-source", () => {
    const sharedStart = "2026-09-20T20:00:00+02:00";
    const sharedVenue = "Espace culturel";
    const sharedCity = "Saran";

    const orleansEvent = baseEvent({
      id: "oa-dup",
      title: "Festival des arts vivants",
      startAt: sharedStart,
      venue: sharedVenue,
      city: sharedCity,
      source: "Ville d'Orléans",
      description: "Programme riche OpenAgenda.",
      imageUrl: "https://example.com/img.jpg",
      registrationUrl: "https://example.com/book",
      category: "Festival",
    });
    const saranDup = baseEvent({
      id: "saran:dup",
      title: "Festival des arts vivants",
      startAt: sharedStart,
      venue: sharedVenue,
      city: sharedCity,
      source: "Ville de Saran",
    });
    const saranUnique = baseEvent({
      id: "saran:new",
      title: "Concert chorale locale",
      startAt: "2026-09-21T20:00:00+02:00",
      source: "Ville de Saran",
    });

    const classified = classifyAll([orleansEvent, saranDup, saranUnique]);
    const { duplicates } = deduplicateEvents(classified);

    const saranRows = buildSaranDuplicateDebug({
      duplicates,
      classifiedEvents: classified,
      adapterByEventId: new Map([
        ["oa-dup", "orleans"],
        ["saran:dup", "saran"],
        ["saran:new", "saran"],
      ]),
    });
    expect(saranRows).toHaveLength(1);
    expect(saranRows[0]).toMatchObject({
      saranTitle: "Festival des arts vivants",
      keptTitle: "Festival des arts vivants",
      keptSource: "Ville d'Orléans",
      keptAdapterId: "orleans",
      reason: "same-time-place-similar-title",
    });
  });
});
