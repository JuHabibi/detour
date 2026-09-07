import { describe, expect, it, vi } from "vitest";
import { loadExplorerEvents } from "@/app/actions/load-explorer-events";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";

vi.mock("@/application/explorer/list-explorer-events", () => ({
  listExplorerEvents: vi.fn(),
}));

vi.mock("@/application/map-detour-event-to-ui", () => ({
  mapDetourEventToEventItem: vi.fn((event: { id: string; title: string }) => ({
    id: event.id,
    title: event.title,
    category: "Musique",
    genre: "",
    venue: null,
    city: null,
    date: "",
    dateLabel: "",
  })),
}));

describe("loadExplorerEvents action", () => {
  it("valide et mappe une page", async () => {
    vi.mocked(listExplorerEvents).mockResolvedValue({
      events: [
        {
          id: "1",
          title: "Jazz",
          description: null,
          imageUrl: null,
          startAt: "2026-11-01T20:00:00.000Z",
          endAt: null,
          venue: null,
          city: "Orléans",
          latitude: null,
          longitude: null,
          category: null,
          genre: null,
          conditions: null,
          source: null,
          sourceUrl: null,
          registrationUrl: null,
        },
      ],
      totalCount: 1,
      nextCursor: null,
    });

    const result = await loadExplorerEvents({
      when: "weekend",
      category: "Musique",
      city: "Orléans",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(listExplorerEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        when: "weekend",
        category: "Musique",
        city: "Orléans",
        limit: 12,
        cursor: undefined,
      }),
    );
    expect(result.events).toHaveLength(1);
    expect(mapDetourEventToEventItem).toHaveBeenCalled();
    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBeNull();
  });

  it("refuse une entrée invalide sans appeler le read model", async () => {
    vi.mocked(listExplorerEvents).mockClear();
    const result = await loadExplorerEvents({ when: "nope" });
    expect(result).toEqual({ ok: false, error: "Période invalide." });
    expect(listExplorerEvents).not.toHaveBeenCalled();
  });
});
