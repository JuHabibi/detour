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
    imageCredit: null,
    imageLicense: null,
    imageSourceUrl: null,
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
    const values = detourEventToUpsertValues(
      "orleans",
      sampleEvent({
        imageCredit: "Alice",
        imageLicense: "CC BY-SA 4.0",
        imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      }),
      marker,
    );
    expect(values).toHaveLength(UPSERT_EVENT_PARAM_COUNT);
    expect(values[0]).toBe("openagenda:1");
    expect(values[1]).toBe("orleans");
    expect(values[2]).toBe("Concert");
    expect(values[5]).toBe("Alice");
    expect(values[6]).toBe("CC BY-SA 4.0");
    expect(values[7]).toBe("https://commons.wikimedia.org/wiki/File:Example.jpg");
    expect(values[10]).toBe(false);
    expect(values[13]).toBe(47.9);
    expect(values[14]).toBe(1.9);
    expect(values[21]).toBe("Musique");
    expect(values[22]).toBe("Orléans");
    expect(values[23]).toBe(marker.toISOString());
  });

  it("SQL upsert : placeholders dynamiques, aucune valeur métier dans le texte", () => {
    const sql = buildUpsertEventsChunkSql(2);
    expect(sql).toContain("$1");
    expect(sql).toContain("$24");
    expect(sql).toContain("$25");
    expect(sql).toContain("$48");
    expect(sql).toContain("all_day");
    expect(sql).toContain("image_credit");
    expect(sql).toContain("image_license");
    expect(sql).toContain("image_source_url");
    expect(sql).toContain("product_category");
    expect(sql).toContain("city_key");
    expect(sql).not.toContain("resolved_latitude");
    expect(sql).not.toContain("geo_resolution");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql).not.toMatch(/openagenda|Orléans|Concert|https?:/);
  });

  it("all_day true → DetourEvent.allDay et upsert", () => {
    const event = mapEventRowToDetourEvent(sampleRow({ all_day: true }));
    expect(event.allDay).toBe(true);

    const values = detourEventToUpsertValues(
      "ingre-agenda",
      sampleEvent({ allDay: true }),
      new Date("2026-09-06T12:00:00.000Z"),
    );
    expect(values[10]).toBe(true);
  });

  it("row attribution → DetourEvent + EventItem-ready fields", () => {
    const event = mapEventRowToDetourEvent(
      sampleRow({
        image_credit: "Bob",
        image_license: "CC BY 4.0",
        image_source_url: "https://commons.wikimedia.org/wiki/File:X.jpg",
      }),
    );
    expect(event.imageCredit).toBe("Bob");
    expect(event.imageLicense).toBe("CC BY 4.0");
    expect(event.imageSourceUrl).toBe(
      "https://commons.wikimedia.org/wiki/File:X.jpg",
    );
  });
});
