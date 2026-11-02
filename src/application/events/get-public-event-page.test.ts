import { describe, expect, it, vi } from "vitest";
import {
  applyPublicEventEndedStatus,
  getPublicEventPage,
  getPublicEventSnapshot,
  type GetPublicEventSnapshotResult,
} from "@/application/events/get-public-event-page";
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

describe("getPublicEventSnapshot / applyPublicEventEndedStatus", () => {
  const beforeEnd = new Date("2026-11-10T20:00:00.000Z");
  const afterEnd = new Date("2026-11-10T21:00:01.000Z");

  it("indexe un événement actif à venir (isEnded frais)", async () => {
    const loadRecord = vi.fn().mockResolvedValue(record());
    const snapshot = await getPublicEventSnapshot("openagenda:1", {
      loadRecord,
    });
    const result = applyPublicEventEndedStatus(snapshot, beforeEnd);

    expect(result).toMatchObject({
      status: "ok",
      data: {
        eventId: "openagenda:1",
        isEnded: false,
        item: { title: "Concert test" },
      },
    });
    expect("isEnded" in (snapshot as { data?: object }).data!).toBe(false);
  });

  it("recalcule isEnded hors cache quand l’horloge dépasse la fin (sans relecture DB)", async () => {
    const loadRecord = vi.fn().mockResolvedValue(record());
    const snapshot = await getPublicEventSnapshot("openagenda:1", {
      loadRecord,
    });
    expect(loadRecord).toHaveBeenCalledTimes(1);

    expect(
      applyPublicEventEndedStatus(snapshot, beforeEnd),
    ).toMatchObject({ status: "ok", data: { isEnded: false } });

    // Nouvelle « requête » : même snapshot cache, horloge avancée — pas de DB.
    expect(
      applyPublicEventEndedStatus(snapshot, afterEnd),
    ).toMatchObject({ status: "ok", data: { isEnded: true } });
    expect(loadRecord).toHaveBeenCalledTimes(1);
  });

  it("not_found si inconnu ou désactivé", async () => {
    await expect(
      getPublicEventSnapshot("missing", {
        loadRecord: vi.fn().mockResolvedValue(null),
      }),
    ).resolves.toEqual({ status: "not_found" });

    await expect(
      getPublicEventSnapshot("openagenda:1", {
        loadRecord: vi.fn().mockResolvedValue(record({ isActive: false })),
      }),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("propage une panne DB (pas de fausse 404)", async () => {
    const loadRecord = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(
      getPublicEventSnapshot("openagenda:1", { loadRecord }),
    ).rejects.toThrow("db down");
  });

  it("respecte la fin exclusive all-day (encore en cours le jour J)", async () => {
    const loadRecord = vi.fn().mockResolvedValue(
      record({
        event: event({
          allDay: true,
          startAt: "2026-11-05T00:00:00+01:00",
          endAt: "2026-11-06T00:00:00+01:00",
        }),
      }),
    );
    const snapshot = await getPublicEventSnapshot("openagenda:1", {
      loadRecord,
    });
    const midday = new Date("2026-11-05T12:00:00+01:00");
    expect(
      applyPublicEventEndedStatus(snapshot, midday),
    ).toMatchObject({ status: "ok", data: { isEnded: false } });
  });

  it("all-day terminé à la borne exclusive endAt (sans relecture DB)", async () => {
    const endAt = "2026-11-06T00:00:00+01:00";
    const loadRecord = vi.fn().mockResolvedValue(
      record({
        event: event({
          allDay: true,
          startAt: "2026-11-05T00:00:00+01:00",
          endAt,
        }),
      }),
    );
    const snapshot = await getPublicEventSnapshot("openagenda:1", {
      loadRecord,
    });
    expect(loadRecord).toHaveBeenCalledTimes(1);

    const justBefore = new Date(Date.parse(endAt) - 1);
    expect(
      applyPublicEventEndedStatus(snapshot, justBefore),
    ).toMatchObject({ status: "ok", data: { isEnded: false } });

    const atExclusiveEnd = new Date(endAt);
    expect(
      applyPublicEventEndedStatus(snapshot, atExclusiveEnd),
    ).toMatchObject({ status: "ok", data: { isEnded: true } });
    expect(loadRecord).toHaveBeenCalledTimes(1);
  });
});

describe("getPublicEventPage", () => {
  it("compose snapshot + isEnded pour les appels directs", async () => {
    const loadRecord = vi.fn().mockResolvedValue(record());
    await expect(
      getPublicEventPage("openagenda:1", {
        now: new Date("2026-11-05T12:00:00.000Z"),
        loadRecord,
      }),
    ).resolves.toMatchObject({
      status: "ok",
      data: { isEnded: false },
    });
  });
});

describe("applyPublicEventEndedStatus", () => {
  it("laisse not_found intact", () => {
    const missing: GetPublicEventSnapshotResult = { status: "not_found" };
    expect(applyPublicEventEndedStatus(missing)).toEqual({
      status: "not_found",
    });
  });
});
