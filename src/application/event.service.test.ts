import { describe, expect, it, vi } from "vitest";
import { EventService } from "@/application/event.service";
import type { DetourEvent } from "@/domain/event";
import type { EventSourceAdapter } from "@/infrastructure/event-source.adapter";
import type { HighlightAssessmentProvider } from "@/infrastructure/ai/highlight-assessment.provider";

function event(id: string, title?: string): DetourEvent {
  return {
    id,
    title: title ?? `Spectacle avec Alice Moreau ${id}`,
    description: `Soirée avec Alice Moreau ${id}.`.padEnd(90, "."),
    imageUrl: null,
    startAt: "2026-11-12T20:00:00+02:00",
    endAt: null,
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
  };
}

describe("EventService AI resilience", () => {
  it("fallback déterministe si le provider IA échoue", async () => {
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };
    const assessor: HighlightAssessmentProvider = {
      assess: vi.fn().mockRejectedValue(new Error("provider down")),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await new EventService(source, assessor).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(result.highlights.length).toBeGreaterThan(0);
    expect(result.aiAssessments).toEqual([]);
    expect(result.highlights.every((item) => item.selectionSource === "deterministic")).toBe(
      true,
    );
    expect(assessor.assess).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("fallback déterministe si aucun assessment IA", async () => {
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => [event("a"), event("b")],
    };
    const assessor: HighlightAssessmentProvider = {
      assess: vi.fn().mockResolvedValue([]),
    };

    const result = await new EventService(source, assessor).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(result.highlights.length).toBeGreaterThan(0);
    expect(
      result.highlights.every((item) => item.selectionSource === "deterministic"),
    ).toBe(true);
  });

  it("utilise la sélection IA quand des assessments sont présents", async () => {
    const events = [
      event("star", "Grande tête d’affiche"),
      event("gem", "Découverte locale"),
      event("plan", "À noter tôt"),
      event("wild", "Wildcard culturel"),
    ];
    const source: EventSourceAdapter = {
      fetchUpcomingEvents: async () => events,
    };
    const assessor: HighlightAssessmentProvider = {
      assess: vi.fn().mockImplementation(async (input: DetourEvent[]) =>
        input.map((item) => {
          if (item.id === "star") {
            return {
              eventId: "star",
              appeal: 5,
              discoveryValue: 2,
              planningValue: 2,
              recognition: 5,
              confidence: 0.9,
              reasons: ["connu"],
            };
          }
          if (item.id === "gem") {
            return {
              eventId: "gem",
              appeal: 4,
              discoveryValue: 5,
              planningValue: 1,
              recognition: 0,
              confidence: 0.8,
              reasons: ["local"],
            };
          }
          if (item.id === "plan") {
            return {
              eventId: "plan",
              appeal: 3,
              discoveryValue: 2,
              planningValue: 5,
              recognition: 2,
              confidence: 0.8,
              reasons: ["anticiper"],
            };
          }
          return {
            eventId: item.id,
            appeal: 3,
            discoveryValue: 3,
            planningValue: 3,
            recognition: 1,
            confidence: 0.7,
            reasons: ["ok"],
          };
        }),
      ),
    };

    const result = await new EventService(source, assessor).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(result.highlights.every((item) => item.selectionSource === "ai")).toBe(
      true,
    );
    expect(result.highlights.find((item) => item.slot === "strong-event")?.event.id).toBe(
      "star",
    );
    expect(result.highlights.find((item) => item.slot === "local-gem")?.event.id).toBe(
      "gem",
    );
    expect(
      result.highlights.find((item) => item.slot === "worth-planning")?.event.id,
    ).toBe("plan");
  });
});
