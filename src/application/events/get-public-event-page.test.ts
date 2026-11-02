import { describe, expect, it, vi } from "vitest";
import { getPublicEventPage } from "@/application/events/get-public-event-page";
import type { DetourEvent } from "@/domain/events/event";
import type { EventRecord } from "@/infrastructure/db/event.repository";

function event(overrides: Partial<DetourEvent> = {}): DetourEvent {
  return {
    id: "openagenda:1",
    title: "Concert test",
    description: "Une soirée",
    imageUrl: null,
    startAt: "2026-11-10T19:00:00.000Z",
    endAt: "2026-11-10T21:00:00.000Z",
    allDay: false,
    venue: "Scène",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: null,
    genre: null,
    conditions: null,
    source: "OpenAgenda",
    sourceUrl: "https://example.com/event",
    registrationUrl: "https://example.com/book",
    ...overrides,
  };
}

function record(
  overrides: Partial<EventRecord> & { event?: DetourEvent } = {},
): EventRecord {
  return {
    event: overrides.event ?? event(),
    isActive: overrides.isActive ?? true,
  };
}

describe("getPublicEventPage", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");

  it("retourne une fiche indexable pour un événement actif à venir", async () => {
    const loadRecord = vi.fn().mockResolvedValue(record());
    const result = await getPublicEventPage("openagenda:1", { now, loadRecord });

    expect(result).toMatchObject({
      status: "ok",
      data: {
        eventId: "openagenda:1",
        isEnded: false,
        item: { title: "Concert test" },
      },
    });
  });

  it("conserve un événement actif passé avec isEnded", async () => {
    const loadRecord = vi.fn().mockResolvedValue(
      record({
        event: event({
          startAt: "2026-10-01T19:00:00.000Z",
          endAt: "2026-10-01T21:00:00.000Z",
        }),
      }),
    );
    const result = await getPublicEventPage("openagenda:1", { now, loadRecord });

    expect(result).toMatchObject({
      status: "ok",
      data: { isEnded: true },
    });
  });

  it("not_found si inconnu ou désactivé", async () => {
    await expect(
      getPublicEventPage("missing", {
        now,
        loadRecord: vi.fn().mockResolvedValue(null),
      }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      getPublicEventPage("openagenda:1", {
        now,
        loadRecord: vi.fn().mockResolvedValue(record({ isActive: false })),
      }),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("propage une panne DB (pas de fausse 404)", async () => {
    const loadRecord = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(
      getPublicEventPage("openagenda:1", { now, loadRecord }),
    ).rejects.toThrow("db down");
  });

  it("respecte la fin exclusive all-day (encore en cours le jour J)", async () => {
    // all-day 5 nov. Europe/Paris → endAt exclusif = 6 nov. 00:00 Paris
    const loadRecord = vi.fn().mockResolvedValue(
      record({
        event: event({
          allDay: true,
          startAt: "2026-11-05T00:00:00+01:00",
          endAt: "2026-11-06T00:00:00+01:00",
        }),
      }),
    );
    const midday = new Date("2026-11-05T12:00:00+01:00");
    const result = await getPublicEventPage("openagenda:1", {
      now: midday,
      loadRecord,
    });
    expect(result).toMatchObject({ status: "ok", data: { isEnded: false } });
  });
});
