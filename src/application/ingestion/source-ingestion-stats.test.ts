import { describe, expect, it, vi } from "vitest";
import { EventService } from "@/application/event.service";
import type { EventIngestionResult } from "@/application/ingestion/event-ingestion-result";
import { buildSourceIngestionStats } from "@/application/ingestion/source-ingestion-stats";
import type { AiConfig } from "@/config/ai-config";
import { classifyEventRelevance } from "@/domain/events/classify-event-relevance";
import { deduplicateEvents } from "@/domain/events/deduplicate-events";
import type { DetourEvent } from "@/domain/events/event";
import { CompositeEventSourceAdapter } from "@/infrastructure/composite-event-source.adapter";
import type { EventSource } from "@/application/ports/event-source";

const disabledAi: AiConfig = {
  enabled: false,
  mode: "auto",
  displayMode: "disabled",
};

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

describe("Source ingestion stats", () => {
  it("agrège 2 sources avec provenance adapterId", async () => {
    const orleans: EventSource = {
      fetchUpcomingEvents: async () => [
        baseEvent({
          id: "oa-1",
          title: "Concert jazz Orléans",
          city: "Orléans",
          venue: "CO'Met",
          source: "Ville d'Orléans",
        }),
        baseEvent({
          id: "oa-2",
          title: "Exposition photo",
          city: "Orléans",
          venue: "Musée",
          source: "OpenAgenda partenaire",
        }),
      ],
    };
    const saran: EventSource = {
      fetchUpcomingEvents: async () => [
        baseEvent({
          id: "saran:1",
          title: "Théâtre municipal",
          source: "Ville de Saran",
        }),
      ],
    };

    const composite = new CompositeEventSourceAdapter([
      { name: "orleans", label: "Orléans / OpenAgenda", adapter: orleans },
      { name: "saran", label: "Ville de Saran", adapter: saran },
    ]);

    const ingestion = await composite.ingestUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(ingestion.events).toHaveLength(3);
    expect(ingestion.adapterByEventId.get("oa-1")).toBe("orleans");
    expect(ingestion.adapterByEventId.get("oa-2")).toBe("orleans");
    expect(ingestion.adapterByEventId.get("saran:1")).toBe("saran");
    expect(ingestion.rawCountByAdapter.get("orleans")).toBe(2);
    expect(ingestion.rawCountByAdapter.get("saran")).toBe(1);
    expect(ingestion.statusByAdapter.get("orleans")).toBe("ok");
    expect(ingestion.statusByAdapter.get("saran")).toBe("ok");
    // Deux sources métier OpenAgenda ≠ un seul adapterId
    expect(ingestion.events.filter((e) => e.source !== "Ville de Saran")).toHaveLength(2);
  });

  it("classification retire certains événements du compteur classified", () => {
    const ingestion: EventIngestionResult = {
      events: [
        baseEvent({ id: "c1", title: "Concert jazz" }),
        baseEvent({
          id: "x1",
          title: "Cours de yoga",
          category: "Sport",
        }),
        baseEvent({ id: "c2", title: "Exposition design" }),
      ],
      adapterByEventId: new Map([
        ["c1", "saran"],
        ["x1", "saran"],
        ["c2", "saran"],
      ]),
      rawCountByAdapter: new Map([["saran", 3]]),
      statusByAdapter: new Map([["saran", "ok"]]),
      sourceNameByAdapter: new Map([["saran", "Ville de Saran"]]),
      adapterOrder: ["saran"],
    };

    const classified = classifyAll(ingestion.events);
    const { events: deduped, duplicates } = deduplicateEvents(classified);
    const stats = buildSourceIngestionStats({
      ingestion,
      classifiedEvents: classified,
      dedupedEvents: deduped,
      duplicates,
    });

    expect(stats).toEqual([
      {
        adapterId: "saran",
        sourceName: "Ville de Saran",
        status: "ok",
        rawCount: 3,
        classifiedCount: 2,
        dedupedContribution: 3,
        editorialContribution: 2,
        duplicatesRemoved: 0,
      },
    ]);
    expect(classified.find((e) => e.id === "x1")?.relevance).toBe("out_of_scope");
  });

  it("out_of_scope conservé après dedup → raw + deduped, pas relevant", () => {
    const ingestion: EventIngestionResult = {
      events: [
        baseEvent({ id: "c1", title: "Concert jazz" }),
        baseEvent({
          id: "oos",
          title: "Cours de yoga",
          category: "Sport",
        }),
      ],
      adapterByEventId: new Map([
        ["c1", "orleans"],
        ["oos", "orleans"],
      ]),
      rawCountByAdapter: new Map([["orleans", 2]]),
      statusByAdapter: new Map([["orleans", "ok"]]),
      sourceNameByAdapter: new Map([
        ["orleans", "Orléans / OpenAgenda"],
      ]),
      adapterOrder: ["orleans"],
    };

    const classified = classifyAll(ingestion.events);
    const { events: deduped, duplicates } = deduplicateEvents(classified);
    expect(deduped.map((e) => e.id).sort()).toEqual(["c1", "oos"]);
    expect(classified.find((e) => e.id === "oos")?.relevance).toBe(
      "out_of_scope",
    );

    const stats = buildSourceIngestionStats({
      ingestion,
      classifiedEvents: classified,
      dedupedEvents: deduped,
      duplicates,
    });

    expect(stats[0]).toEqual({
      adapterId: "orleans",
      sourceName: "Orléans / OpenAgenda",
      status: "ok",
      rawCount: 2,
      classifiedCount: 1,
      dedupedContribution: 2,
      editorialContribution: 1,
      duplicatesRemoved: 0,
    });
  });

  it("déduplication cross-source + stats cohérentes", () => {
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

    const ingestion: EventIngestionResult = {
      events: [orleansEvent, saranDup, saranUnique],
      adapterByEventId: new Map([
        ["oa-dup", "orleans"],
        ["saran:dup", "saran"],
        ["saran:new", "saran"],
      ]),
      rawCountByAdapter: new Map([
        ["orleans", 1],
        ["saran", 2],
      ]),
      statusByAdapter: new Map([
        ["orleans", "ok"],
        ["saran", "ok"],
      ]),
      sourceNameByAdapter: new Map([
        ["orleans", "Orléans / OpenAgenda"],
        ["saran", "Ville de Saran"],
      ]),
      adapterOrder: ["orleans", "saran"],
    };

    const classified = classifyAll(ingestion.events);
    const { events: deduped, duplicates } = deduplicateEvents(classified);
    const stats = buildSourceIngestionStats({
      ingestion,
      classifiedEvents: classified,
      dedupedEvents: deduped,
      duplicates,
    });

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.duplicateId).toBe("saran:dup");
    expect(duplicates[0]?.keptId).toBe("oa-dup");

    expect(stats).toEqual([
      {
        adapterId: "orleans",
        sourceName: "Orléans / OpenAgenda",
        status: "ok",
        rawCount: 1,
        classifiedCount: 1,
        dedupedContribution: 1,
        editorialContribution: 1,
        duplicatesRemoved: 0,
      },
      {
        adapterId: "saran",
        sourceName: "Ville de Saran",
        status: "ok",
        rawCount: 2,
        classifiedCount: 2,
        dedupedContribution: 1,
        editorialContribution: 1,
        duplicatesRemoved: 1,
      },
    ]);
  });

  it("source en échec → rawCount 0, stats présentes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok: EventSource = {
      fetchUpcomingEvents: async () => [
        baseEvent({ id: "oa-1", title: "Concert jazz", city: "Orléans" }),
      ],
    };
    const failing: EventSource = {
      fetchUpcomingEvents: async () => {
        throw new Error("ical down");
      },
    };

    const composite = new CompositeEventSourceAdapter([
      { name: "orleans", label: "Orléans / OpenAgenda", adapter: ok },
      { name: "saran", label: "Ville de Saran", adapter: failing },
    ]);

    const ingestion = await composite.ingestUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(ingestion.rawCountByAdapter.get("saran")).toBe(0);
    expect(ingestion.rawCountByAdapter.get("orleans")).toBe(1);
    expect(ingestion.statusByAdapter.get("saran")).toBe("error");
    expect(ingestion.statusByAdapter.get("orleans")).toBe("ok");
    expect(ingestion.adapterOrder).toEqual(["orleans", "saran"]);

    const classified = classifyAll(ingestion.events);
    const { events: deduped, duplicates } = deduplicateEvents(classified);
    const stats = buildSourceIngestionStats({
      ingestion,
      classifiedEvents: classified,
      dedupedEvents: deduped,
      duplicates,
    });

    expect(stats.find((s) => s.adapterId === "saran")).toEqual({
      adapterId: "saran",
      sourceName: "Ville de Saran",
      status: "error",
      rawCount: 0,
      classifiedCount: 0,
      dedupedContribution: 0,
      editorialContribution: 0,
      duplicatesRemoved: 0,
    });
    errorSpy.mockRestore();
  });

  it("source à 0 événement → stats à zéro", async () => {
    const composite = new CompositeEventSourceAdapter([
      {
        name: "orleans",
        label: "Orléans / OpenAgenda",
        adapter: {
          fetchUpcomingEvents: async () => [
            baseEvent({ id: "oa-1", title: "Spectacle théâtre" }),
          ],
        },
      },
      {
        name: "saran",
        label: "Ville de Saran",
        adapter: { fetchUpcomingEvents: async () => [] },
      },
    ]);

    const ingestion = await composite.ingestUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(ingestion.rawCountByAdapter.get("saran")).toBe(0);
    expect(ingestion.events).toHaveLength(1);

    const classified = classifyAll(ingestion.events);
    const { events: deduped, duplicates } = deduplicateEvents(classified);
    const stats = buildSourceIngestionStats({
      ingestion,
      classifiedEvents: classified,
      dedupedEvents: deduped,
      duplicates,
    });

    expect(stats[1]).toMatchObject({
      adapterId: "saran",
      status: "ok",
      rawCount: 0,
      classifiedCount: 0,
      dedupedContribution: 0,
      editorialContribution: 0,
      duplicatesRemoved: 0,
    });
  });

  it("EventService expose sourceIngestion + saranDuplicates (mocks)", async () => {
    const sharedStart = "2026-10-01T19:30:00+02:00";
    const composite = new CompositeEventSourceAdapter([
      {
        name: "orleans",
        label: "Orléans / OpenAgenda",
        adapter: {
          fetchUpcomingEvents: async () => [
            baseEvent({
              id: "oa-keep",
              title: "Nuit de la lecture",
              startAt: sharedStart,
              venue: "Médiathèque",
              city: "Saran",
              source: "OpenAgenda",
              description: "Programme détaillé OpenAgenda.",
              imageUrl: "https://example.com/a.jpg",
              registrationUrl: "https://example.com/r",
            }),
            baseEvent({
              id: "oa-yoga",
              title: "Séance de yoga",
              startAt: "2026-10-02T10:00:00+02:00",
              city: "Orléans",
              venue: "Parc",
              category: "Sport",
            }),
          ],
        },
      },
      {
        name: "saran",
        label: "Ville de Saran",
        adapter: {
          fetchUpcomingEvents: async () => [
            baseEvent({
              id: "saran:dup",
              title: "Nuit de la lecture",
              startAt: sharedStart,
              venue: "Médiathèque",
              city: "Saran",
              source: "Ville de Saran",
            }),
          ],
        },
      },
    ]);

    const result = await new EventService(composite, {
      cacheContext: {
        model: "noop",
        promptVersion: "noop",
        generation: { temperature: 0 },
      },
      assess: async () => [],
    }, {
      aiConfig: disabledAi,
    }).getUpcomingEvents({
      from: new Date("2026-09-01"),
      to: new Date("2026-12-01"),
    });

    expect(result.sourceIngestion).toEqual([
      {
        adapterId: "orleans",
        sourceName: "Orléans / OpenAgenda",
        status: "ok",
        rawCount: 2,
        classifiedCount: 1,
        dedupedContribution: 2,
        editorialContribution: 1,
        duplicatesRemoved: 0,
      },
      {
        adapterId: "saran",
        sourceName: "Ville de Saran",
        status: "ok",
        rawCount: 1,
        classifiedCount: 1,
        dedupedContribution: 0,
        editorialContribution: 0,
        duplicatesRemoved: 1,
      },
    ]);

    expect(result.saranDuplicates).toHaveLength(1);
    expect(result.saranDuplicates[0]?.keptAdapterId).toBe("orleans");
    expect(result.saranDuplicates[0]?.reason).toBe(
      "same-time-place-similar-title",
    );
  });
});
