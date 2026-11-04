import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWeekendPageEndedFilter,
  getPublicWeekendPage,
  type PublicWeekendPage,
} from "@/application/weekend/get-public-weekend-page";
import type { DetourEvent } from "@/domain/events/event";
import type { EventItem } from "@/data/types";

vi.mock("@/application/explorer/list-explorer-events", () => ({
  listExplorerEvents: vi.fn(),
}));

import { listExplorerEvents } from "@/application/explorer/list-explorer-events";

const listExplorerEventsMock = vi.mocked(listExplorerEvents);

beforeEach(() => {
  listExplorerEventsMock.mockReset();
});

function detour(overrides: Partial<DetourEvent> = {}): DetourEvent {
  return {
    id: "evt-1",
    title: "Concert jazz avec Marie Dupont",
    description: "Spectacle musical live",
    imageUrl: null,
    startAt: "2026-11-07T19:00:00.000Z",
    endAt: "2026-11-07T21:00:00.000Z",
    venue: "Scène",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Concert",
    genre: null,
    conditions: null,
    source: "test",
    sourceUrl: "https://example.com",
    registrationUrl: "https://example.com/book",
    ...overrides,
  };
}

describe("getPublicWeekendPage", () => {
  it("expose les bornes du week-end Paris et une sélection courte", async () => {
    listExplorerEventsMock.mockResolvedValue({
      events: [
        detour({ id: "a" }),
        detour({
          id: "yoga",
          title: "Yoga",
          category: "Bien-être",
          description: "Cours",
          registrationUrl: null,
        }),
      ],
      totalCount: 2,
      nextCursor: null,
    });

    const page = await getPublicWeekendPage({
      now: new Date("2026-11-04T12:00:00+01:00"),
    });

    expect(page.saturdayKey).toBe("2026-11-07");
    expect(page.sundayKey).toBe("2026-11-08");
    expect(page.weekendLabel).toContain("samedi 7");
    expect(page.explorerHref).toBe("/explorer");
    expect(page.events.length).toBe(1);
    expect(page.events[0]?.id).toBe("a");
    expect(listExplorerEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({ when: "weekend" }),
      expect.anything(),
    );
  });

  it("pagine le corpus week-end jusqu’à épuisement du curseur", async () => {
    listExplorerEventsMock
      .mockResolvedValueOnce({
        events: [detour({ id: "p1" })],
        totalCount: 2,
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        events: [
          detour({
            id: "p2",
            title: "Théâtre avec Jean Martin",
            category: "Spectacle",
            description: "Pièce de théâtre",
            startAt: "2026-11-08T17:00:00.000Z",
            endAt: "2026-11-08T19:00:00.000Z",
          }),
        ],
        totalCount: null,
        nextCursor: null,
      });

    const page = await getPublicWeekendPage({
      now: new Date("2026-11-04T12:00:00+01:00"),
    });

    expect(listExplorerEventsMock).toHaveBeenCalledTimes(2);
    expect(page.events.map((item) => item.id).sort()).toEqual(["p1", "p2"]);
  });

  it("reste vide sans inventer de contenu", async () => {
    listExplorerEventsMock.mockResolvedValue({
      events: [],
      totalCount: 0,
      nextCursor: null,
    });

    const page = await getPublicWeekendPage({
      now: new Date("2026-11-04T12:00:00+01:00"),
    });
    expect(page.events).toEqual([]);
    expect(page.culturalActiveCount).toBe(0);
  });
});

describe("applyWeekendPageEndedFilter", () => {
  it("retire les événements devenus terminés hors cache", () => {
    const page: PublicWeekendPage = {
      saturdayKey: "2026-11-07",
      sundayKey: "2026-11-08",
      weekendLabel: "samedi 7 et dimanche 8 novembre 2026",
      weekendFromIso: "2026-11-06T23:00:00.000Z",
      weekendToIso: "2026-11-08T22:59:59.999Z",
      culturalActiveCount: 2,
      explorerHref: "/explorer",
      events: [
        {
          id: "alive",
          title: "Encore",
          startAt: "2026-11-08T18:00:00.000Z",
          endAt: "2026-11-08T20:00:00.000Z",
        } as EventItem,
        {
          id: "done",
          title: "Fini",
          startAt: "2026-11-07T10:00:00.000Z",
          endAt: "2026-11-07T12:00:00.000Z",
        } as EventItem,
      ],
    };

    const filtered = applyWeekendPageEndedFilter(
      page,
      new Date("2026-11-07T18:00:00.000Z"),
    );
    expect(filtered.events.map((item) => item.id)).toEqual(["alive"]);
  });
});
