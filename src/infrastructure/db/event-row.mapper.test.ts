import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/events/event";
import {
  UPSERT_EVENT_PARAM_COUNT,
  buildUpsertEventsChunkSql,
  detourEventToUpsertValues,
  mapEventRowToDetourEvent,
  mapEventRowToEventWithAdapter,
  type EventRow,
} from "@/infrastructure/db/event-row.mapper";

function sampleEvent(overrides: Partial<DetourEvent> = {}): DetourEvent {
  return {
    id: "openagenda:1",
    title: "Concert",
    description: "Desc",
    imageUrl: "https://example.com/a.jpg",
    startAt: "2026-11-12T19:00:00.000Z",
    endAt: "2026-11-12T21:00:00.000Z",
    venue: "CO'Met",
    city: "Orléans",
    latitude: 47.9,
    longitude: 1.9,
    category: "Concert",
    genre: "Jazz",
    conditions: "Sur réservation",
    source: "Agenda Orléans",
    sourceUrl: "https://example.com/event",
    registrationUrl: "https://example.com/book",
    ...overrides,
  };
}

function sampleRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "openagenda:1",
    adapter_id: "orleans",
    title: "Concert",
    description: "Desc",
    image_url: "https://example.com/a.jpg",
    start_at: new Date("2026-11-12T19:00:00.000Z"),
    end_at: new Date("2026-11-12T21:00:00.000Z"),
    venue: "CO'Met",
    city: "Orléans",
    latitude: 47.9,
    longitude: 1.9,
    category: "Concert",
    genre: "Jazz",
    conditions: "Sur réservation",
    source: "Agenda Orléans",
    source_url: "https://example.com/event",
    registration_url: "https://example.com/book",
    is_active: true,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    last_seen_at: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

describe("event-row.mapper", () => {
  it("row → DetourEvent (snake → camel, timestamptz → ISO)", () => {
    const event = mapEventRowToDetourEvent(sampleRow());
    expect(event).toEqual(sampleEvent());
    expect(event).not.toHaveProperty("adapterId");
    expect(event).not.toHaveProperty("adapter_id");
  });

  it("row → EventWithAdapter conserve adapterId hors DetourEvent", () => {
    const mapped = mapEventRowToEventWithAdapter(sampleRow());
    expect(mapped.adapterId).toBe("orleans");
    expect(mapped.event.id).toBe("openagenda:1");
  });

  it("nulls latitude / endAt / urls", () => {
    const event = mapEventRowToDetourEvent(
      sampleRow({
        description: null,
        image_url: null,
        end_at: null,
        venue: null,
        city: null,
        latitude: null,
        longitude: null,
        category: null,
        genre: null,
        conditions: null,
        source: null,
        source_url: null,
        registration_url: null,
      }),
    );
    expect(event.endAt).toBeNull();
    expect(event.latitude).toBeNull();
    expect(event.registrationUrl).toBeNull();
  });

  it("DetourEvent → valeurs upsert ordonnées (pas d’interpolation SQL)", () => {
    const marker = new Date("2026-09-06T12:00:00.000Z");
    const values = detourEventToUpsertValues("orleans", sampleEvent(), marker);
    expect(values).toHaveLength(UPSERT_EVENT_PARAM_COUNT);
    expect(values[0]).toBe("openagenda:1");
    expect(values[1]).toBe("orleans");
    expect(values[2]).toBe("Concert");
    expect(values[17]).toBe(marker.toISOString());
  });

  it("SQL upsert : placeholders dynamiques, aucune valeur métier dans le texte", () => {
    const sql = buildUpsertEventsChunkSql(2);
    expect(sql).toContain("$1");
    expect(sql).toContain("$18");
    expect(sql).toContain("$19");
    expect(sql).toContain("$36");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql).not.toMatch(/openagenda|Orléans|Concert|https?:/);
  });
});
