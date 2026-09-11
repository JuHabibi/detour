import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BouillonEventAdapter } from "./bouillon.adapter";
import { parseBouillonDetail } from "./bouillon.detail-parser";
import { parseBouillonListPage } from "./bouillon.list-parser";
import { mapBouillonDetailToDetourEvent } from "./bouillon.mapper";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("bouillon list parser", () => {
  it("parse la page 0 : teasers + last page", () => {
    const page = parseBouillonListPage(fixture("list-page0.html"));
    expect(page.items.length).toBeGreaterThanOrEqual(10);
    expect(page.lastPageIndex).toBe(2);
    expect(page.items[0]?.path).toBe(
      "/fr/culture/agenda-actualites/mona-guba-imparfait",
    );
    expect(page.items[0]?.title).toContain("Mona Guba");
    expect(page.items.some((i) => i.category === "Spectacle / Concert")).toBe(
      true,
    );
  });

  it("normalise les paths /culture → /fr/culture", () => {
    const page = parseBouillonListPage(fixture("list-page0.html"));
    for (const item of page.items) {
      expect(item.path.startsWith("/fr/culture/agenda-actualites/")).toBe(true);
    }
  });

  it("pagination : pages 1 et 2 cohérentes", () => {
    const p1 = parseBouillonListPage(fixture("list-page1.html"));
    const p2 = parseBouillonListPage(fixture("list-page2.html"));
    expect(p1.lastPageIndex).toBe(2);
    expect(p2.lastPageIndex).toBe(2);
    expect(p1.items.length).toBeGreaterThan(0);
    expect(p2.items.length).toBeGreaterThan(0);
  });

  it("fail-closed : HTML vide", () => {
    expect(() => parseBouillonListPage("")).toThrow(/empty HTML/);
  });

  it("fail-closed : structure absente", () => {
    expect(() => parseBouillonListPage("<html><body>noop</body></html>")).toThrow(
      /unexpected HTML/,
    );
  });

  it("fail-closed : pager sans teasers", () => {
    const html = `<html><body>
      <div class="view-id-univ_agenda"></div>
      <ul class="pagination js-pager__items">
        <li class="pager__item--last"><a href="?page=2" rel="last">last</a></li>
      </ul>
    </body></html>`;
    expect(() => parseBouillonListPage(html)).toThrow(/pager announces/);
  });
});

describe("bouillon detail parser + mapper", () => {
  it("parse Mona Guba → DetourEvent", () => {
    const detail = parseBouillonDetail(fixture("detail-mona.html"), {
      fallbackPath: "/fr/culture/agenda-actualites/mona-guba-imparfait",
      category: "Spectacle / Concert",
    });
    expect(detail.nid).toBe("18149");
    expect(detail.title).toContain("Mona Guba");
    expect(detail.startAt).toBe("2026-09-17T20:30:00Z");
    expect(detail.endAt).toBe("2026-09-17T23:30:00Z");
    expect(detail.imageUrl).toContain("/upload/public/");
    expect(detail.registrationUrl).toBe(
      "https://www.billetweb.fr/mona-guba-imparfait",
    );
    expect(detail.latitude).toBeCloseTo(47.843043, 4);
    expect(detail.longitude).toBeCloseTo(1.937027, 4);

    const mapped = mapBouillonDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("bouillon:18149");
    expect(mapped.event.source).toBe("Université d'Orléans / Le Bouillon");
    expect(mapped.event.city).toBe("Orléans");
    expect(mapped.event.venue).toBe("Le Bouillon");
    expect(mapped.event.category).toBe("Spectacle / Concert");
    expect(mapped.event.genre).toBeNull();
    expect(mapped.event.conditions).toBeNull();
    expect(mapped.event.sourceUrl).toContain("mona-guba-imparfait");
  });

  it("parse Jesus Christ Superstar", () => {
    const detail = parseBouillonDetail(fixture("detail-jesus.html"), {
      category: "Cinéma",
    });
    expect(detail.nid).toBe("18110");
    expect(detail.title).toContain("Jesus Christ Superstar");
    expect(detail.startAt).toBe("2026-10-06T18:00:00Z");
    expect(detail.registrationUrl).toContain("billetweb.fr");

    const mapped = mapBouillonDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("bouillon:18110");
    expect(mapped.event.category).toBe("Cinéma");
  });

  it("fail-closed : fiche sans nid", () => {
    expect(() =>
      parseBouillonDetail(
        `<html><body><h1 class="page-header">X</h1><time datetime="2026-09-17T20:30:00Z"></time></body></html>`,
      ),
    ).toThrow(/missing node id/);
  });

  it("fail-closed : fiche sans datetime", () => {
    expect(() =>
      parseBouillonDetail(
        `<html><head>
<link rel="canonical" href="https://www.univ-orleans.fr/fr/culture/agenda-actualites/sans-date" />
</head><body>
          <a data-drupal-link-system-path="node/99"></a>
          <h1 class="page-header">Sans date</h1>
        </body></html>`,
      ),
    ).toThrow(/missing datetime/);
  });
});

describe("bouillon adapter pagination + window", () => {
  it("parcourt toutes les pages et fetch les détails (fixtures)", async () => {
    const list0 = fixture("list-page0.html");
    const list1 = fixture("list-page1.html");
    const list2 = fixture("list-page2.html");
    const detailMona = fixture("detail-mona.html");
    const detailJesus = fixture("detail-jesus.html");

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("agenda-actualites") && !url.match(/agenda-actualites\/[^/?]+/)) {
        if (url.includes("page=1")) {
          return new Response(list1, { status: 200 });
        }
        if (url.includes("page=2")) {
          return new Response(list2, { status: 200 });
        }
        return new Response(list0, { status: 200 });
      }
      if (url.includes("mona-guba")) {
        return new Response(detailMona, { status: 200 });
      }
      if (url.includes("jesus-christ")) {
        return new Response(detailJesus, { status: 200 });
      }
      // Minimal stub detail for other listing URLs (keep adapter fail-closed on real parse)
      const slug = url.split("/").pop() ?? "stub";
      const stub = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.univ-orleans.fr/fr/culture/agenda-actualites/${slug}" />
</head><body>
<a data-drupal-link-system-path="node/${Math.abs(hashCode(slug))}"></a>
<h1 class="page-header">${slug}</h1>
<time datetime="2026-10-15T18:00:00Z">x</time>
<time datetime="2026-10-15T20:00:00Z">y</time>
</body></html>`;
      return new Response(stub, { status: 200 });
    });

    const adapter = new BouillonEventAdapter({
      fetchImpl,
      detailConcurrency: 4,
    });

    const result = await adapter.collectUpcomingEvents({
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-12-01T00:00:00Z"),
    });

    expect(result.stats.discovered).toBeGreaterThanOrEqual(20);
    expect(result.events.length).toBe(result.stats.published);
    expect(result.events.some((e) => e.id === "bouillon:18149")).toBe(true);
    expect(result.events.some((e) => e.id === "bouillon:18110")).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("page=1"))).toBe(
      true,
    );
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(
      true,
    );
  });

  it("fail-closed : HTTP non OK", async () => {
    const adapter = new BouillonEventAdapter({
      fetchImpl: async () => new Response("nope", { status: 500 }),
    });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2026-12-01T00:00:00Z"),
      }),
    ).rejects.toThrow(/HTTP error: 500/);
  });

  it("fail-closed : last page incohérente entre pages", async () => {
    const list0 = fixture("list-page0.html");
    const brokenP1 = fixture("list-page1.html").replace(
      /pager__item--last[\s\S]*?page=2/,
      'pager__item--last"><a href="?page=9',
    );
    const adapter = new BouillonEventAdapter({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("page=1")) return new Response(brokenP1, { status: 200 });
        return new Response(list0, { status: 200 });
      },
    });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2026-12-01T00:00:00Z"),
      }),
    ).rejects.toThrow(/last page changed/);
  });
});

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100000) + 1000;
}
