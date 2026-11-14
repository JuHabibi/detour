import { readFileSync } from "node:fs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import type { DbQueryable } from "./postgres";
import {
  upsertMany,
  getEventRecordById,
  listUpcomingActive,
  listActiveEventsForSitemap,
} from "./event.repository";
import { listFavoriteEventsForUser } from "./favorite.repository";
import {
  getGroupWithEventsForUser,
  listGroupSummariesForUser,
} from "./group.repository";
import { listExplorerEvents } from "@/application/explorer/list-explorer-events";
import {
  getPublicEventSnapshot,
  applyPublicEventEndedStatus,
} from "@/application/events/get-public-event-page";
import { listPublicEventSitemapEntries } from "@/application/events/list-public-event-sitemap-entries";
import { selectWeekendPageEvents } from "@/application/weekend/select-weekend-events";
import {
  getPublicWeekendPage,
  applyWeekendPageEndedFilter,
} from "@/application/weekend/get-public-weekend-page";
import { buildEventJsonLd } from "@/features/event-page/build-event-json-ld";
import { buildEventCalendar } from "@/domain/calendar/build-event-calendar";
import { selectEventInWindow } from "@/domain/events/event-schedule";
import { mapDetourEventToEventItem } from "@/application/map-detour-event-to-ui";
import type { DetourEvent, EventOccurrence } from "@/domain/events/event";
import { parseIngreAgendaDetail } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.detail-parser";
import { mapIngreAgendaDetailToDetourEvent } from "@/infrastructure/sources/ingre-agenda/ingre-agenda.mapper";

const NOW = new Date("2026-11-13T12:00:00Z");
const saturday = {
  startAt: "2026-11-14T19:00:00.000Z",
  endAt: "2026-11-14T21:00:00.000Z",
  allDay: false,
};
const sunday = {
  startAt: "2026-11-15T19:00:00.000Z",
  endAt: "2026-11-15T21:00:00.000Z",
  allDay: false,
};
const october = {
  startAt: "2026-10-02T19:00:00.000Z",
  endAt: "2026-10-02T21:00:00.000Z",
  allDay: false,
};
const later = {
  startAt: "2026-11-27T19:00:00.000Z",
  endAt: "2026-11-27T21:00:00.000Z",
  allDay: false,
};

function event(id: string, occurrences?: EventOccurrence[]): DetourEvent {
  return {
    id,
    title: `Concert ${id}`,
    description: "Un concert de musique jazz sur scène.",
    imageUrl: null,
    ...october,
    venue: "Salle de concert",
    city: "Orléans",
    latitude: null,
    longitude: null,
    category: "Concert",
    genre: null,
    conditions: null,
    source: "test",
    sourceUrl: "https://example.com/event",
    registrationUrl: null,
    occurrences,
  };
}

describe("séances — contrat de lecture bout en bout PostgreSQL", () => {
  let db: PGlite;
  let client: DbQueryable & PoolClient;
  beforeAll(async () => {
    db = new PGlite();
    for (const file of [
      "20260906120000_create_events_and_source_syncs.sql",
      "20260907160000_create_event_availability.sql",
      "20260907220000_add_event_normalized_explorer_fields.sql",
      "20260908120000_add_event_all_day.sql",
      "20260912150000_add_event_image_attribution.sql",
      "20261101150000_add_event_audience_jeune_public.sql",
      "20261101210000_add_cinema_product_category.sql",
      "20261111120000_create_event_occurrences.sql",
    ]) {
      const sql = readFileSync(
        new URL(`../../../db/migrations/${file}`, import.meta.url),
        "utf8",
      );
      await db.exec(sql.split("-- migrate:down")[0]);
    }
    await db.exec(`
      CREATE TABLE favorites (user_id text, event_id text REFERENCES events(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
      CREATE TABLE groups (id text PRIMARY KEY, user_id text, name text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE group_events (group_id text REFERENCES groups(id) ON DELETE CASCADE, event_id text REFERENCES events(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
    `);
    client = {
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
    } as unknown as typeof client;
  });
  afterAll(async () => {
    vi.useRealTimers();
    await db?.close();
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await db.exec("TRUNCATE events, groups CASCADE");
    await upsertMany(
      "test",
      [
        event("series", [october, saturday, sunday, later]),
        event("gap", [october, later]),
        { ...event("legacy"), ...sunday },
        { ...event("empty", []), ...saturday },
        event("stale", [saturday]),
        event("inactive", [saturday]),
      ],
      NOW,
      client,
    );
    await db.exec(
      "UPDATE events SET last_seen_at = '2026-11-13T12:01:00Z' WHERE id = 'stale'; UPDATE events SET is_active = false WHERE id = 'inactive'",
    );
  });

  it("corrige la plage historique Ingré à la sync, puis filtre et affiche les séances réelles", async () => {
    const html = readFileSync(new URL(
      "../sources/ingre-agenda/fixtures/detail-yoga-distinct-dates.html", import.meta.url,
    ), "utf8");
    const mapped = mapIngreAgendaDetailToDetourEvent(parseIngreAgendaDetail(html));
    if (!mapped.ok) throw new Error("Expected mapped source event");
    await db.exec("TRUNCATE events CASCADE");
    const queryDay = (day: string) => listExplorerEvents(
      { when: "range", from: day, to: day },
      { now: new Date("2026-11-07T12:00:00Z"), client },
    );

    // État historique : pas de séances, l'enveloppe remplit les jours sans atelier.
    await upsertMany("ingre-agenda", [{ ...mapped.event, occurrences: undefined }], NOW, client);
    expect((await queryDay("2026-11-12")).totalCount).toBe(1);
    // La sync habituelle remplace cet état sans migration ni nouvel ID.
    await upsertMany("ingre-agenda", [mapped.event], NOW, client);
    expect((await queryDay("2026-11-12")).totalCount).toBe(0);
    for (const day of ["2026-11-08", "2026-11-15"]) {
      const page = await queryDay(day);
      expect(page.totalCount).toBe(1);
      expect(page.events[0].id).toBe(mapped.event.id);
      expect(mapDetourEventToEventItem(page.events[0]).dateLabel).not.toContain("Du 8 au 15");
    }
    const snapshot = await getPublicEventSnapshot(mapped.event.id, {
      loadRecord: (id) => getEventRecordById(id, client),
    });
    const detail = applyPublicEventEndedStatus(snapshot, NOW);
    expect(detail).toMatchObject({ status: "ok", data: {
      startAt: "2026-11-14T23:00:00.000Z",
      endAt: "2026-11-15T23:00:00.000Z",
    } });
    if (detail.status !== "ok") throw new Error("Expected public detail");
    expect(detail.data.item.occurrences).toHaveLength(2);
    expect(detail.data.item.dateLabel).not.toContain("Du 8 au 15");
    expect(buildEventJsonLd(detail.data)?.startDate).toBe("2026-11-15");

    // Une correction source vers un seul jour doit aussi remplacer les anciennes séances.
    const single = mapIngreAgendaDetailToDetourEvent(parseIngreAgendaDetail(html
      .replaceAll("le 8 et 15 novembre", "le 15 novembre")
      .replaceAll("les Dimanches 8 et 15 novembre 2026", "le Dimanche 15 novembre 2026")
      .replaceAll("Dimanche 08 novembre", "Dimanche 15 novembre")));
    if (!single.ok) throw new Error("Expected corrected source event");
    await upsertMany("ingre-agenda", [single.event], new Date(NOW.getTime() + 1000), client);
    expect((await queryDay("2026-11-08")).totalCount).toBe(0);
    expect((await queryDay("2026-11-15")).totalCount).toBe(1);
  });

  it.each(["sold_out_online", "sold_out", "available"])(
    "conserve la disponibilité %s entre Explorer et la fiche publique, même après un changement de séance",
    async (status) => {
      await db.query(`INSERT INTO event_availability
        (event_id, status, provider, provider_event_url, checked_at)
        VALUES ('series', $1, 'test-provider', 'https://example.com/tickets/series', $2)`,
        [status, NOW.toISOString()]);
      const loadRecord = vi.fn((id: string) => getEventRecordById(id, client));
      // Aller-retour JSON : même représentation que le snapshot Data Cache.
      const snapshot = JSON.parse(JSON.stringify(
        await getPublicEventSnapshot("series", { loadRecord }),
      ));
      const fields = (item: ReturnType<typeof mapDetourEventToEventItem>) => ({
        availabilityStatus: item.availabilityStatus,
        availabilityBadge: item.availabilityBadge,
        registrationUrl: item.registrationUrl,
      });
      for (const now of [NOW, new Date("2026-11-15T12:00:00Z")]) {
        const explorer = await listExplorerEvents({ when: "weekend" }, { now, client });
        const card = mapDetourEventToEventItem(explorer.events.find((e) => e.id === "series")!);
        const page = applyPublicEventEndedStatus(snapshot, now);
        expect(page.status).toBe("ok");
        if (page.status !== "ok") throw new Error("Expected public event");
        expect(page.data.item.availabilityStatus).toBe(status);
        expect(fields(page.data.item)).toEqual(fields(card));
        expect(page.data.startAt).toBe(now === NOW ? saturday.startAt : sunday.startAt);
      }
      // Une milliseconde après les 48h, le même snapshot ne prolonge pas le statut.
      const expired = applyPublicEventEndedStatus(snapshot, new Date("2026-11-15T12:00:00.001Z"));
      expect(expired).toMatchObject({ status: "ok", data: { item: {
        availabilityStatus: "unknown", availabilityBadge: undefined,
        registrationUrl: undefined,
      } } });
      expect(loadRecord).toHaveBeenCalledTimes(1);
    },
  );

  it("Home garde les dates source quand SQL passe à la séance suivante", async () => {
    const read = (from: Date) => listUpcomingActive({ from, to: new Date("2026-12-01"), now: from, client });
    const first = (await read(NOW)).find((item) => item.id === "series")!;
    const next = (await read(new Date("2026-11-15T12:00:00Z"))).find((item) => item.id === "series")!;
    expect(first.startAt).toBe(saturday.startAt);
    expect(next.startAt).toBe(sunday.startAt);
    expect(first.sourceDates).toEqual({ startAt: october.startAt, endAt: october.endAt });
    expect(next.sourceDates).toEqual(first.sourceDates);
    // Aucun ancien créneau artificiellement réinjecté pour garder la clé IA.
    expect(next.occurrences).toEqual([sunday, later]);
  });

  it("filtre les séances avant COUNT/LIMIT : une carte par événement, aucun trou rempli", async () => {
    const page = await listExplorerEvents(
      { when: "weekend", limit: 1 },
      { now: NOW, client },
    );
    expect(page.totalCount).toBe(2);
    expect(page.events.map((e) => e.id)).toEqual(["series"]);
    expect(page.events[0].startAt).toBe(saturday.startAt);
    expect(page.events[0].occurrences).toEqual([saturday, sunday]);
    const next = await listExplorerEvents(
      { when: "weekend", limit: 1, cursor: page.nextCursor! },
      { now: NOW, client },
    );
    expect(next.events.map((e) => e.id)).toEqual(["legacy"]);
    expect(next.nextCursor).toBeNull();
  });

  it("garde l’horloge du curseur quand une séance expire entre deux pages", async () => {
    const first = await listExplorerEvents(
      { when: "weekend", limit: 1 },
      { now: NOW, client },
    );
    const next = await listExplorerEvents(
      { when: "weekend", limit: 1, cursor: first.nextCursor! },
      {
        now: new Date("2026-11-15T18:00:00Z"),
        client,
      },
    );
    expect(next.events.map((e) => e.id)).toEqual(["legacy"]);
    const refreshed = await listExplorerEvents(
      { when: "weekend" },
      { now: new Date("2026-11-15T18:00:00Z"), client },
    );
    expect(refreshed.events.find((e) => e.id === "series")?.startAt).toBe(
      sunday.startAt,
    );
  });

  it("déduplique les sources avant pagination et applique les facettes aux mêmes événements", async () => {
    const original = event("series", [october, saturday, sunday]);
    const duplicate = {
      ...original,
      id: "duplicate",
      registrationUrl: "https://example.com/tickets",
    };
    await upsertMany("other-source", [duplicate], NOW, client);
    const querySpy = vi.spyOn(client, "query");
    const page = await listExplorerEvents(
      {
        when: "weekend",
        category: "Musique",
        city: "Orléans",
        search: "Concert",
        limit: 1,
      },
      { now: NOW, client },
    );
    expect(querySpy).toHaveBeenCalledTimes(2); // COUNT + page, aucun aller-retour par séance.
    querySpy.mockRestore();
    expect(page.totalCount).toBe(2);
    expect(page.events[0].id).toBe("duplicate");
    const next = await listExplorerEvents(
      {
        when: "weekend",
        category: "Musique",
        city: "Orléans",
        search: "Concert",
        limit: 1,
        cursor: page.nextCursor!,
      },
      { now: NOW, client },
    );
    expect(next.events.map((e) => e.id)).toEqual(["legacy"]);
    const frise = await listExplorerEvents(
      { when: "upcoming", from: "2026-11-15", to: "2026-11-15" },
      { now: NOW, client },
    );
    expect(frise.events.find((e) => e.id === "duplicate")?.startAt).toBe(
      sunday.startAt,
    );
    expect(frise.events.some((e) => e.id === "gap")).toBe(false);
  });

  it("partage les dates avec Home/Radar et la sélection week-end sans réexécuter l’IA", async () => {
    const events = await listUpcomingActive({
      from: NOW,
      to: new Date("2026-11-16T00:00:00Z"),
      now: NOW,
      client,
    });
    expect(events.map((e) => e.id)).toEqual(["series", "legacy"]);
    expect(
      selectWeekendPageEvents(events, { now: NOW }).find(
        (e) => e.id === "series",
      )?.startAt,
    ).toBe(saturday.startAt);
    const cached = await getPublicWeekendPage({ now: NOW, client });
    const refreshed = applyWeekendPageEndedFilter(
      cached,
      new Date("2026-11-15T18:00:00Z"),
    );
    expect(refreshed.events.find((e) => e.id === "series")?.startAt).toBe(
      sunday.startAt,
    );
    expect(
      applyWeekendPageEndedFilter(cached, new Date("2026-11-16T00:00:00Z"))
        .events,
    ).toEqual([]);
  });

  it("détail et JSON-LD avancent à la prochaine séance après cache ; sitemap conserve la série", async () => {
    const snapshot = await getPublicEventSnapshot("series", {
      loadRecord: (id) => getEventRecordById(id, client),
    });
    const page = applyPublicEventEndedStatus(
      snapshot,
      new Date("2026-11-15T18:00:00Z"),
    );
    expect(page.status).toBe("ok");
    if (page.status !== "ok") throw new Error("missing event");
    expect(page.data.startAt).toBe(sunday.startAt);
    expect(page.data.item.startAt).toBe(sunday.startAt);
    expect(page.data.isEnded).toBe(false);
    expect(buildEventJsonLd(page.data)?.startDate).toBe(sunday.startAt);
    const rows = await listActiveEventsForSitemap(client);
    const urls = listPublicEventSitemapEntries(rows, NOW).map(
      (entry) => entry.url,
    );
    expect(urls.some((url) => url.endsWith("/series"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/gap"))).toBe(true);
    expect(urls.some((url) => /\/(empty|stale|inactive)$/.test(url))).toBe(
      false,
    );
    const ended = applyPublicEventEndedStatus(
      snapshot,
      new Date("2026-11-28T00:00:00Z"),
    );
    if (ended.status !== "ok") throw new Error("missing event");
    expect(ended.data.isEnded).toBe(true);
    expect(ended.data.startAt).toBe(later.startAt);
    expect(buildEventJsonLd(ended.data)).toBeNull();
  });

  it("calendrier vide ou absent à la dernière sync : dates à confirmer, sans faux JSON-LD", async () => {
    for (const id of ["empty", "stale"]) {
      const snapshot = await getPublicEventSnapshot(id, {
        loadRecord: (key) => getEventRecordById(key, client),
      });
      const page = applyPublicEventEndedStatus(snapshot, NOW);
      if (page.status !== "ok") throw new Error("missing event");
      expect(page.data.item.dateLabel).toBe("Dates à confirmer");
      expect(page.data.item.startAt).toBeUndefined();
      expect(page.data.isEnded).toBe(false);
      expect(buildEventJsonLd(page.data)).toBeNull();
    }
  });

  it("favoris et carnets gardent l’identité ; export ICS énumère uniquement les séances réelles à venir", async () => {
    await db.exec(
      "INSERT INTO favorites (user_id, event_id) VALUES ('user', 'series'); INSERT INTO groups (id, user_id, name) VALUES ('group', 'user', 'Sorties'); INSERT INTO group_events (group_id, event_id) VALUES ('group', 'series')",
    );
    const favorites = await listFavoriteEventsForUser("user", client);
    expect(favorites[0].id).toBe("series");
    expect(favorites[0].startAt).toBe(saturday.startAt);
    expect(await listFavoriteEventsForUser("other", client)).toEqual([]);
    const group = await getGroupWithEventsForUser("user", "group", client);
    expect(group?.events[0].startAt).toBe(saturday.startAt);
    expect(
      await getGroupWithEventsForUser("other", "group", client),
    ).toBeNull();
    expect(
      (await listGroupSummariesForUser("user", client))[0].earliestStartAt,
    ).toBe(saturday.startAt);
    const ics = buildEventCalendar(favorites[0], { now: NOW });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("DTSTART:20261114T190000Z");
    expect(ics).toContain("DTSTART:20261115T190000Z");
    expect(ics).toContain("DTSTART:20261127T190000Z");
    expect(ics).not.toContain("DTSTART:20261002");
    expect(new Set(ics.match(/UID:[^\r]+/g)).size).toBe(3);
  });

  it("frontières fin exclusive/all-day, nuit et changement d’heure : SQL et domaine s’accordent", async () => {
    const fixtures: EventOccurrence[] = [
      {
        startAt: "2026-10-25T00:30:00Z",
        endAt: "2026-10-25T01:30:00Z",
        allDay: false,
      },
      {
        startAt: "2026-10-24T22:00:00Z",
        endAt: "2026-10-25T23:00:00Z",
        allDay: true,
      },
      {
        startAt: "2026-10-24T21:00:00Z",
        endAt: "2026-10-24T22:00:00Z",
        allDay: false,
      },
      {
        startAt: "2026-10-24T22:00:00Z",
        endAt: "2026-10-24T22:00:00Z",
        allDay: false,
      },
    ];
    await db.exec("TRUNCATE events CASCADE");
    const events = fixtures.map((o, i) => event(`edge-${i}`, [o]));
    await upsertMany("test", events, NOW, client);
    const page = await listExplorerEvents(
      { when: "range", from: "2026-10-25", to: "2026-10-25" },
      { now: NOW, client },
    );
    const window = {
      from: new Date("2026-10-24T22:00:00Z"),
      to: new Date("2026-10-25T22:59:59.999Z"),
    };
    expect(page.events.map((e) => e.id).sort()).toEqual(
      events
        .filter((e) => selectEventInWindow(e, window))
        .map((e) => e.id)
        .sort(),
    );
    expect(page.totalCount).toBe(3);
  });
});
