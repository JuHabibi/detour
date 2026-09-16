import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  collectOrmesEvents,
  OrmesEventAdapter,
} from "./ormes.adapter";
import { parseOrmesDetail } from "./ormes.detail-parser";
import { parseOrmesListPage } from "./ormes.list-parser";
import {
  mapOrmesDetailToDetourEvent,
  ORMES_CITY,
  ORMES_SOURCE_NAME,
} from "./ormes.mapper";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("ormes list parser", () => {
  it("parse la catégorie Culture + slugs stables", () => {
    const page = parseOrmesListPage(
      fixture("category-culture.html"),
      "https://www.ville-ormes.fr/events/categories/culture/",
    );
    expect(page.items.length).toBe(9);
    expect(page.nextPageUrl).toBeNull();
    expect(page.items.map((i) => i.slug)).toContain(
      "concert-brass-band-val-de-loire",
    );
    expect(
      page.items.find((i) => i.slug === "le-doudou-du-pere-noel")?.title,
    ).toMatch(/COMPLET/i);
  });

  it("suit la pagination pno", () => {
    const page1 = parseOrmesListPage(
      fixture("category-culture-page1.html"),
      "https://www.ville-ormes.fr/events/categories/culture/",
    );
    expect(page1.items).toHaveLength(2);
    expect(page1.nextPageUrl).toBe(
      "https://www.ville-ormes.fr/events/categories/culture/?pno=2",
    );

    const page2 = parseOrmesListPage(
      fixture("category-culture-page2.html"),
      page1.nextPageUrl!,
    );
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.slug).toBe("lecture-c");
    expect(page2.nextPageUrl).toBeNull();
  });
});

describe("ormes detail parser + mapper", () => {
  it("détail simple : image, lieu, coords, booking, date", () => {
    const detail = parseOrmesDetail(
      fixture("detail-concert.html"),
      "https://www.ville-ormes.fr/events/concert-brass-band-val-de-loire/",
    );
    expect(detail.eventId).toBe("224");
    expect(detail.title).toMatch(/BRASS BAND/i);
    expect(detail.imageUrl).toContain("BBVL_image-daccueil");
    expect(detail.venue).toMatch(/Ecole de Musique/i);
    expect(detail.latitude).toBeCloseTo(47.94053, 4);
    expect(detail.longitude).toBeCloseTo(1.813491, 4);
    expect(detail.registrationUrl).toContain("linscription.com");
    expect(detail.dateStartLabel).toBe("27 septembre 2026");
    expect(detail.dateEndLabel).toBeNull();
    expect(detail.startTime).toBe("16:00");
    expect(detail.endTime).toBe("17:30");
    expect(detail.categories).toContain("Culture");

    const mapped = mapOrmesDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("ormes:224");
    expect(mapped.event.city).toBe(ORMES_CITY);
    expect(mapped.event.source).toBe(ORMES_SOURCE_NAME);
    expect(mapped.event.startAt).toContain("2026-09-27T16:00:00");
    expect(mapped.event.endAt).toContain("2026-09-27T17:30:00");
    expect(mapped.event.allDay).toBeUndefined();
  });

  it("exclu expo multi-mois timed (multi_day_timed_range)", () => {
    const detail = parseOrmesDetail(
      fixture("detail-expo.html"),
      "https://www.ville-ormes.fr/events/exposition-deux-mots-pour-te-donner-des-nouvelles/",
    );
    expect(detail.dateStartLabel).toBe("19 septembre 2026");
    expect(detail.dateEndLabel).toBe("17 juillet 2027");
    expect(detail.startTime).toBe("16:00");

    const mapped = mapOrmesDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(false);
    if (mapped.ok) return;
    expect(mapped.exclusion.reason).toBe("ambiguous_program");
    expect(mapped.exclusion.detail).toBe("multi_day_timed_range");
  });

  it("exclu titre COMPLET", () => {
    const detail = parseOrmesDetail(
      fixture("detail-complet.html"),
      "https://www.ville-ormes.fr/events/le-doudou-du-pere-noel/",
    );
    const mapped = mapOrmesDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(false);
    if (mapped.ok) return;
    expect(mapped.exclusion.reason).toBe("complete");
  });
});

describe("ormes adapter fetch", () => {
  it("ingestion séquentielle + pace (~1 req/s)", async () => {
    const sleeps: number[] = [];
    let clock = 1_000_000;
    const htmlByUrl: Record<string, string> = {
      "https://www.ville-ormes.fr/events/categories/culture/": fixture(
        "category-culture-page1.html",
      ),
      "https://www.ville-ormes.fr/events/categories/culture/?pno=2": fixture(
        "category-culture-page2.html",
      ),
      "https://www.ville-ormes.fr/events/concert-a/": fixture(
        "detail-concert.html",
      ).replaceAll("concert-brass-band-val-de-loire", "concert-a")
        .replace("em-event-224", "em-event-501")
        .replace("postid-12249", "postid-501"),
      "https://www.ville-ormes.fr/events/concert-b/": fixture(
        "detail-concert.html",
      ).replaceAll("concert-brass-band-val-de-loire", "concert-b")
        .replace("em-event-224", "em-event-502")
        .replace("27 septembre 2026", "28 septembre 2026")
        .replace("postid-12249", "postid-502"),
      "https://www.ville-ormes.fr/events/lecture-c/": fixture(
        "detail-concert.html",
      ).replaceAll("concert-brass-band-val-de-loire", "lecture-c")
        .replace("em-event-224", "em-event-503")
        .replace("27 septembre 2026", "21 octobre 2026")
        .replace("postid-12249", "postid-503"),
    };

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const body = htmlByUrl[url];
      if (!body) {
        return new Response("missing", { status: 404 });
      }
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    const result = await collectOrmesEvents(
      {
        from: new Date("2026-09-01T00:00:00.000Z"),
        to: new Date("2027-03-01T00:00:00.000Z"),
      },
      {
        fetchImpl,
        minIntervalMs: 1_000,
        now: () => clock,
        sleep: async (ms) => {
          sleeps.push(ms);
          clock += ms;
        },
      },
    );

    expect(result.stats.discovered).toBe(3);
    expect(result.stats.detailsFetched).toBe(3);
    expect(result.stats.published).toBe(3);
    expect(fetchImpl.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://www.ville-ormes.fr/events/categories/culture/",
      "https://www.ville-ormes.fr/events/categories/culture/?pno=2",
      "https://www.ville-ormes.fr/events/concert-a/",
      "https://www.ville-ormes.fr/events/concert-b/",
      "https://www.ville-ormes.fr/events/lecture-c/",
    ]);
    // 4 intervalles entre 5 requêtes séquentielles.
    expect(sleeps.filter((ms) => ms === 1_000).length).toBeGreaterThanOrEqual(4);
  });

  it("EventSource fetchUpcomingEvents délègue au collect", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/categories/culture")) {
        return new Response(fixture("category-culture.html"), { status: 200 });
      }
      if (url.includes("concert-brass-band")) {
        return new Response(fixture("detail-concert.html"), { status: 200 });
      }
      if (url.includes("exposition")) {
        return new Response(fixture("detail-expo.html"), { status: 200 });
      }
      if (url.includes("doudou")) {
        return new Response(fixture("detail-complet.html"), { status: 200 });
      }
      // other details: minimal single-day HTML clone of concert with unique id
      const slug = url.split("/events/")[1]?.replace(/\/$/, "") ?? "x";
      const html = fixture("detail-concert.html")
        .replaceAll("concert-brass-band-val-de-loire", slug)
        .replace("em-event-224", `em-event-${Math.abs(hash(slug))}`)
        .replace("27 septembre 2026", "15 octobre 2026");
      return new Response(html, { status: 200 });
    });

    const events = await new OrmesEventAdapter({
      fetchImpl,
      minIntervalMs: 0,
      sleep: async () => undefined,
    }).fetchUpcomingEvents({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2027-03-01T00:00:00.000Z"),
    });

    expect(events.some((e) => e.id === "ormes:224")).toBe(true);
    expect(events.every((e) => e.city === ORMES_CITY)).toBe(true);
    expect(events.every((e) => !/COMPLET/i.test(e.title))).toBe(true);
  });
});

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}
