import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  IngreMediathequeEventAdapter,
  collectIngreMediathequeEvents,
} from "./ingre-mediatheque.adapter";
import { parseIngreMediathequeListing } from "./ingre-mediatheque.listing-parser";
import {
  mapIngreMediathequeSession,
  INGRE_MEDIATHEQUE_ADAPTER_ID,
} from "./ingre-mediatheque.mapper";
import {
  parseIngreMediathequeRss,
  parseRssPubDateToIso,
  startKeyFromIso,
} from "./ingre-mediatheque.rss-parser";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function mockFetch(bodies: Record<string, string | { status: number; body: string }>) {
  return async (input: string | URL) => {
    const url = String(input);
    const key = Object.keys(bodies).find((k) => url.includes(k));
    if (!key) {
      return new Response("not found", { status: 404 });
    }
    const value = bodies[key]!;
    if (typeof value === "string") {
      return new Response(value, { status: 200 });
    }
    return new Response(value.body, { status: value.status });
  };
}

describe("ingre-mediatheque rss parser", () => {
  it("parse pubDate séance → ISO offsetté", () => {
    expect(parseRssPubDateToIso("Sat, 03 Oct 2026 15:30:00 +0200")).toBe(
      "2026-10-03T15:30:00+02:00",
    );
    expect(parseRssPubDateToIso("Wed, 28 Oct 2026 15:30:00 +0100")).toBe(
      "2026-10-28T15:30:00+01:00",
    );
  });

  it("extrait les items de référence avec startKey distincts pour Pomme", () => {
    const items = parseIngreMediathequeRss(loadFixture("agenda-rss.xml"));
    const bibliotron = items.find((i) => i.title === "Bibliotron");
    const malefique = items.find((i) => /maléfique/i.test(i.title));
    const pommes = items.filter((i) => /pomme/i.test(i.title));

    expect(bibliotron?.startAt).toBe("2026-10-03T15:30:00+02:00");
    expect(bibliotron?.startKey).toBe("2026-10-03T15:30");
    expect(malefique?.startAt).toBe("2026-10-28T15:30:00+01:00");
    expect(pommes).toHaveLength(2);
    expect(pommes.map((p) => p.startKey).sort()).toEqual([
      "2026-12-23T16:00",
      "2026-12-23T17:00",
    ]);
  });
});

describe("ingre-mediatheque listing parser", () => {
  it("associe nid + fin de séance par startKey", () => {
    const sessions = parseIngreMediathequeListing(
      loadFixture("agenda-listing.html"),
    );
    const byKey = Object.fromEntries(
      sessions.map((s) => [s.startKey, s]),
    );

    expect(byKey["2026-10-03T15:30"]?.nid).toBe("539462");
    expect(byKey["2026-10-28T15:30"]?.nid).toBe("539510");
    expect(byKey["2026-12-23T16:00"]?.nid).toBe("539515");
    expect(byKey["2026-12-23T17:00"]?.nid).toBe("539516");
    expect(byKey["2026-10-03T15:30"]?.endAt).toMatch(/2026-10-03T16:30:00\+02:00/);
  });
});

describe("ingre-mediatheque mapper", () => {
  it("produit des ids distincts pour deux séances Pomme", () => {
    const rss = parseIngreMediathequeRss(loadFixture("agenda-rss.xml"));
    const listing = parseIngreMediathequeListing(
      loadFixture("agenda-listing.html"),
    );
    const byKey = new Map(listing.map((s) => [s.startKey, s]));

    const mapped = rss
      .filter((i) => /pomme/i.test(i.title))
      .map((item) =>
        mapIngreMediathequeSession({
          rss: item,
          listing: byKey.get(item.startKey)!,
        }),
      );

    expect(mapped.every((m) => m.ok)).toBe(true);
    const ids = mapped.map((m) => (m.ok ? m.event.id : ""));
    expect(ids).toEqual([
      `${INGRE_MEDIATHEQUE_ADAPTER_ID}:539515`,
      `${INGRE_MEDIATHEQUE_ADAPTER_ID}:539516`,
    ]);
  });
});

describe("ingre-mediatheque adapter", () => {
  const from = new Date("2026-09-25T00:00:00+02:00");
  const to = new Date("2026-12-25T00:00:00+01:00");

  it("dry-run : publie les références avec ids stables", async () => {
    const adapter = new IngreMediathequeEventAdapter({
      crawlDelayMs: 0,
      fetchImpl: mockFetch({
        "agenda/rss": loadFixture("agenda-rss.xml"),
        "agenda-/-animations": loadFixture("agenda-listing.html"),
      }),
    });

    const result = await adapter.collectUpcomingEvents({ from, to });
    const ids = result.events.map((e) => e.id);

    expect(ids).toContain(`${INGRE_MEDIATHEQUE_ADAPTER_ID}:539462`);
    expect(ids).toContain(`${INGRE_MEDIATHEQUE_ADAPTER_ID}:539510`);
    expect(ids).toContain(`${INGRE_MEDIATHEQUE_ADAPTER_ID}:539515`);
    expect(ids).toContain(`${INGRE_MEDIATHEQUE_ADAPTER_ID}:539516`);
    expect(new Set(ids).size).toBe(ids.length);

    const bibliotron = result.events.find((e) => e.title === "Bibliotron");
    expect(bibliotron?.startAt).toBe("2026-10-03T15:30:00+02:00");
    expect(bibliotron?.city).toBe("Ingré");
    expect(bibliotron?.venue).toBeNull();
    expect(bibliotron?.imageUrl).toBeNull();
    expect(bibliotron?.sourceUrl).toContain("/node/content/nid/539462");
  });

  it("fail-closed : deux séances listing distinctes même startKey", () => {
    const listing = `${loadFixture("agenda-listing.html")}
<article data-nid="999001">
<a href="/node/content/nid/999001">other</a>
<div class="date">Le Samedi 03 Octobre 2026 de 15h30 à 16h30</div>
</article>
`;
    expect(() => parseIngreMediathequeListing(listing)).toThrow(
      /startKey collision/,
    );
  });

  it("fail-closed : deux items RSS même startKey", async () => {
    const base = loadFixture("agenda-rss.xml");
    const bibliotronItem = base.match(
      /<item>[\s\S]*?Bibliotron[\s\S]*?<\/item>/,
    )?.[0];
    expect(bibliotronItem).toBeTruthy();
    const collisionRss = base.replace(
      "</channel>",
      `${bibliotronItem!.replace("Bibliotron", "Autre spectacle")}\n</channel>`,
    );

    await expect(
      collectIngreMediathequeEvents(
        { from, to },
        {
          crawlDelayMs: 0,
          fetchImpl: mockFetch({
            "agenda/rss": collisionRss,
            "agenda-/-animations": loadFixture("agenda-listing.html"),
          }),
        },
      ),
    ).rejects.toThrow(/RSS startKey collision/);
  });

  it("fail-closed : HTTP RSS non-OK", async () => {
    await expect(
      collectIngreMediathequeEvents(
        { from, to },
        {
          crawlDelayMs: 0,
          fetchImpl: mockFetch({
            "agenda/rss": { status: 500, body: "err" },
            "agenda-/-animations": loadFixture("agenda-listing.html"),
          }),
        },
      ),
    ).rejects.toThrow(/HTTP error: 500/);
  });

  it("fail-closed : item RSS sans séance listing", async () => {
    const rss = loadFixture("agenda-rss.xml").replace(
      "Sat, 03 Oct 2026 15:30:00 +0200",
      "Sat, 03 Oct 2099 15:30:00 +0200",
    );

    await expect(
      collectIngreMediathequeEvents(
        { from, to },
        {
          crawlDelayMs: 0,
          fetchImpl: mockFetch({
            "agenda/rss": rss,
            "agenda-/-animations": loadFixture("agenda-listing.html"),
          }),
        },
      ),
    ).rejects.toThrow(/incomplete join/);
  });

  it("exclut hors fenêtre sans casser la collecte", async () => {
    const result = await collectIngreMediathequeEvents(
      {
        from: new Date("2026-10-01T00:00:00+02:00"),
        to: new Date("2026-10-10T00:00:00+02:00"),
      },
      {
        crawlDelayMs: 0,
        fetchImpl: mockFetch({
          "agenda/rss": loadFixture("agenda-rss.xml"),
          "agenda-/-animations": loadFixture("agenda-listing.html"),
        }),
      },
    );

    expect(result.events.map((e) => e.id)).toContain(
      `${INGRE_MEDIATHEQUE_ADAPTER_ID}:539462`,
    );
    expect(result.events.every((e) => !/pomme/i.test(e.title))).toBe(true);
    expect(result.exclusions.some((e) => e.reason === "outside_window")).toBe(
      true,
    );
  });

  it("startKeyFromIso ignore les secondes", () => {
    expect(startKeyFromIso("2026-10-03T15:30:00+02:00")).toBe(
      "2026-10-03T15:30",
    );
  });
});
