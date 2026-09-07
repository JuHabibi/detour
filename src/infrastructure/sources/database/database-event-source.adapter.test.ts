import { describe, expect, it, vi } from "vitest";
import {
  buildIngestionFromDbRows,
  DatabaseEventSourceAdapter,
} from "@/infrastructure/sources/database/database-event-source.adapter";
import type { DetourEvent } from "@/domain/events/event";
import type { EventWithAdapter } from "@/infrastructure/db/event-row.mapper";
import { isIngestingEventSource } from "@/infrastructure/composite-event-source.adapter";

function eventStub(id: string): DetourEvent {
  return {
    id,
    title: "T",
    description: null,
    imageUrl: null,
    startAt: "2026-09-10T18:00:00.000Z",
    endAt: null,
    venue: null,
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "culture",
    genre: null,
    conditions: null,
    source: "test",
    sourceUrl: null,
    registrationUrl: null,
  };
}

describe("DatabaseEventSourceAdapter", () => {
  it("query repository avec from/to et mappe events + provenance", async () => {
    const from = new Date("2026-09-06T12:00:00.000Z");
    const to = new Date("2026-12-01T12:00:00.000Z");
    const rows: EventWithAdapter[] = [
      { event: eventStub("openagenda:1"), adapterId: "orleans" },
      { event: eventStub("saran:1"), adapterId: "saran" },
      { event: eventStub("openagenda:2"), adapterId: "orleans" },
    ];
    const list = vi.fn(async () => rows);
    const adapter = new DatabaseEventSourceAdapter(list);

    expect(isIngestingEventSource(adapter)).toBe(true);

    const ingestion = await adapter.ingestUpcomingEvents({ from, to });

    expect(list).toHaveBeenCalledWith({ from, to });
    expect(ingestion.events.map((e) => e.id)).toEqual([
      "openagenda:1",
      "saran:1",
      "openagenda:2",
    ]);
    expect(ingestion.adapterByEventId.get("openagenda:1")).toBe("orleans");
    expect(ingestion.adapterByEventId.get("saran:1")).toBe("saran");
    expect(ingestion.rawCountByAdapter.get("orleans")).toBe(2);
    expect(ingestion.rawCountByAdapter.get("saran")).toBe(1);
    expect(ingestion.adapterOrder).toEqual(["orleans", "saran"]);
    expect(ingestion.statusByAdapter.get("orleans")).toBe("ok");
    expect(ingestion.statusByAdapter.get("saran")).toBe("ok");
    expect(ingestion.sourceNameByAdapter.get("orleans")).toBe(
      "Orléans / OpenAgenda",
    );
    expect(ingestion.sourceNameByAdapter.get("saran")).toBe("Ville de Saran");
  });

  it("fetchUpcomingEvents délègue sans appeler de source externe", async () => {
    const list = vi.fn(async () => [
      { event: eventStub("e1"), adapterId: "orleans" },
    ]);
    const adapter = new DatabaseEventSourceAdapter(list);
    const events = await adapter.fetchUpcomingEvents({
      from: new Date(),
      to: new Date(),
    });
    expect(events).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe("buildIngestionFromDbRows", () => {
  it("ordre preferred orleans puis saran puis ingre-agenda", () => {
    const ingestion = buildIngestionFromDbRows([
      { event: eventStub("saran:1"), adapterId: "saran" },
      { event: eventStub("ingre:1"), adapterId: "ingre-agenda" },
      { event: eventStub("oa:1"), adapterId: "orleans" },
    ]);
    expect(ingestion.adapterOrder).toEqual([
      "orleans",
      "saran",
      "ingre-agenda",
    ]);
  });
});
