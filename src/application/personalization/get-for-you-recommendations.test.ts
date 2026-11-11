import { describe, expect, it, vi } from "vitest";
import type { DetourEvent } from "@/domain/events/event";
import {
  FOR_YOU_CANDIDATES_PER_CATEGORY,
  getForYouRecommendations,
} from "./get-for-you-recommendations";

function detourEvent(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    description: null,
    imageUrl: null,
    startAt: "2026-11-14T20:00:00+01:00",
    endAt: null,
    allDay: false,
    venue: "Salle",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Concert",
    genre: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    registrationUrl: null,
    ...partial,
  };
}

describe("getForYouRecommendations", () => {
  it("interroge Explorer par catégorie d’intérêt avec skipCount", async () => {
    const listEvents = vi.fn(async (query: { category?: string | null }) => {
      const category = query.category ?? "Autre";
      return {
        events: [
          detourEvent({
            id: `${category}-1`,
            title: `${category} 1`,
            category,
          }),
        ],
        totalCount: null,
        nextCursor: null,
      };
    });

    const mapEvent = vi.fn((event: DetourEvent) => ({
      id: event.id,
      title: event.title,
      category: event.category as "Musique" | "Cinéma",
      genre: "",
      venue: event.venue,
      city: event.city,
      date: "2026-11-14",
      dateLabel: "14 nov.",
      startAt: event.startAt,
      conditions: event.conditions ?? undefined,
    }));

    const result = await getForYouRecommendations(
      {
        interests: ["Musique", "Cinéma"],
        availabilities: ["flexible"],
        budget: "any",
      },
      {
        listEvents: listEvents as never,
        mapEvent: mapEvent as never,
        now: new Date("2026-11-11T12:00:00+01:00"),
      },
    );

    expect(listEvents).toHaveBeenCalledTimes(2);
    expect(listEvents).toHaveBeenCalledWith(
      {
        when: "upcoming",
        category: "Musique",
        limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
      },
      expect.objectContaining({ skipCount: true }),
    );
    expect(listEvents).toHaveBeenCalledWith(
      {
        when: "upcoming",
        category: "Cinéma",
        limit: FOR_YOU_CANDIDATES_PER_CATEGORY,
      },
      expect.objectContaining({ skipCount: true }),
    );
    expect(result.candidateCount).toBe(2);
    expect(result.events.length).toBeGreaterThan(0);
    expect(
      result.events.every(
        (event) => event.category === "Musique" || event.category === "Cinéma",
      ),
    ).toBe(true);
  });

  it("exclut les catégories non demandées même si le pool les contient", async () => {
    const listEvents = vi.fn(async () => ({
      events: [
        detourEvent({ id: "m1", title: "Concert", category: "Musique" }),
      ],
      totalCount: null,
      nextCursor: null,
    }));

    const mapEvent = vi.fn((event: DetourEvent) => ({
      id: event.id,
      title: event.title,
      category: "Spectacle" as const,
      genre: "",
      venue: "Salle",
      city: "Orléans",
      date: "2026-11-14",
      dateLabel: "14 nov.",
      startAt: event.startAt,
    }));

    const result = await getForYouRecommendations(
      {
        interests: ["Musique"],
        availabilities: ["flexible"],
        budget: "any",
      },
      {
        listEvents: listEvents as never,
        mapEvent: mapEvent as never,
        now: new Date("2026-11-11T12:00:00+01:00"),
      },
    );

    expect(result.events).toEqual([]);
    expect(result.matchCount).toBe(0);
  });

  it("déduplique les ids cross-catégorie", async () => {
    const shared = detourEvent({
      id: "shared",
      title: "Partagé",
      category: "Musique",
    });
    const listEvents = vi.fn(async () => ({
      events: [shared],
      totalCount: null,
      nextCursor: null,
    }));

    const mapEvent = vi.fn((event: DetourEvent) => ({
      id: event.id,
      title: event.title,
      category: "Musique" as const,
      genre: "",
      venue: "Salle",
      city: "Orléans",
      date: "2026-11-14",
      dateLabel: "14 nov.",
      startAt: event.startAt,
    }));

    const result = await getForYouRecommendations(
      {
        interests: ["Musique", "Cinéma"],
        availabilities: ["flexible"],
        budget: "any",
      },
      {
        listEvents: listEvents as never,
        mapEvent: mapEvent as never,
        now: new Date("2026-11-11T12:00:00+01:00"),
      },
    );

    expect(result.candidateCount).toBe(1);
    expect(result.events).toHaveLength(1);
  });

  it("intérêts vides → aucun fetch", async () => {
    const listEvents = vi.fn();
    const result = await getForYouRecommendations(
      { interests: [], availabilities: ["flexible"], budget: "any" },
      { listEvents: listEvents as never },
    );
    expect(listEvents).not.toHaveBeenCalled();
    expect(result).toEqual({
      events: [],
      candidateCount: 0,
      matchCount: 0,
    });
  });
});
