import { describe, expect, it } from "vitest";
import { listPublicEventSitemapEntries } from "@/application/events/list-public-event-sitemap-entries";
import type { EventSitemapRow } from "@/infrastructure/db/event.repository";

function row(overrides: Partial<EventSitemapRow> = {}): EventSitemapRow {
  return {
    id: "openagenda:1",
    startAt: "2026-11-10T19:00:00.000Z",
    endAt: "2026-11-10T21:00:00.000Z",
    ...overrides,
  };
}

describe("listPublicEventSitemapEntries", () => {
  const beforeEnd = new Date("2026-11-10T20:00:00.000Z");
  const afterEnd = new Date("2026-11-10T21:00:01.000Z");

  it("inclut les actifs non terminés avec URL canonique encodée", () => {
    const id = "saran:calendar.1@www.mairie-saran.fr";
    expect(
      listPublicEventSitemapEntries(
        [row({ id, startAt: "2026-11-20T10:00:00.000Z", endAt: null })],
        beforeEnd,
      ),
    ).toEqual([
      {
        url: "https://detour.website/evenements/saran%3Acalendar.1%40www.mairie-saran.fr",
      },
    ]);
  });

  it("exclut les terminés sans relecture — même snapshot, horloge avancée", () => {
    const rows = [row()];
    expect(listPublicEventSitemapEntries(rows, beforeEnd)).toHaveLength(1);
    expect(listPublicEventSitemapEntries(rows, afterEnd)).toEqual([]);
  });

  it("déduplique les urls et ignore les ids déjà vus", () => {
    const rows = [
      row(),
      row(),
      row({
        id: "openagenda:2",
        startAt: "2026-11-20T10:00:00.000Z",
        endAt: null,
      }),
    ];
    expect(listPublicEventSitemapEntries(rows, beforeEnd)).toEqual([
      { url: "https://detour.website/evenements/openagenda%3A1" },
      { url: "https://detour.website/evenements/openagenda%3A2" },
    ]);
  });
});
