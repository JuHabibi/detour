import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { SaintJeanLeBlancEventAdapter } from "./saint-jean-le-blanc.adapter";
import { parseSjlbDetail } from "./saint-jean-le-blanc.detail-parser";
import { buildSjlbListPageUrl } from "./saint-jean-le-blanc.html";
import { parseSjlbListPage } from "./saint-jean-le-blanc.list-parser";
import {
  mapSjlbDetailToDetourEvent,
  parseFrSlashDate,
  parseHoraires,
} from "./saint-jean-le-blanc.mapper";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html;charset=utf-8" },
  });
}

describe("saint-jean-le-blanc list parser", () => {
  it("extrait cards + pagination", () => {
    const page = parseSjlbListPage(fixture("list-page.html"));
    expect(page.items).toHaveLength(2);
    expect(page.lastPageNumber).toBe(2);
    expect(page.items[0]?.resourceId).toBe("3195");
    expect(page.items[0]?.title).toContain("BELLE-MÈRE");
    expect(page.items[0]?.theme).toBe("Théâtre");
    expect(page.items[0]?.detailUrl).toContain("Ress_3195/");
    expect(page.items[1]?.resourceId).toBe("3219");
  });

  it("page vide → throw", () => {
    expect(() => parseSjlbListPage(fixture("list-empty.html"))).toThrow(
      /0 \.item_agenda/,
    );
  });

  it("structure cassée → throw", () => {
    expect(() => parseSjlbListPage(fixture("list-broken.html"))).toThrow(
      /without detail link|missing Ress/,
    );
  });

  it("challenge HTML → throw", () => {
    expect(() => parseSjlbListPage(fixture("list-challenge.html"))).toThrow(
      /challenge/,
    );
  });
});

describe("saint-jean-le-blanc detail parser + mapper", () => {
  it("fiche complète avec horaire", () => {
    const detail = parseSjlbDetail(
      fixture("detail-complete.html"),
      "https://www.saintjeanleblanc.com/Ress_3195/BELLE-M-RE-VENDRE.html",
    );
    expect(detail.title).toBe("BELLE-MÈRE À VENDRE");
    expect(detail.dateRaw).toBe("16/10/2026");
    expect(detail.horairesRaw).toBe("20H00");
    expect(detail.lieu).toBe("Espace Montission");
    expect(detail.adresse).toContain("Douffiagues");
    expect(detail.bookingUrl).toContain("yurplan");
    expect(detail.theme).toBe("Théâtre");

    const mapped = mapSjlbDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("saint-jean-le-blanc:3195");
    expect(mapped.event.city).toBe("Saint-Jean-le-Blanc");
    expect(mapped.event.venue).toBe("Espace Montission");
    expect(mapped.event.category).toBe("Théâtre");
    expect(mapped.event.allDay).toBeUndefined();
    expect(mapped.event.startAt).toMatch(/2026-10-16T20:00/);
    expect(mapped.event.registrationUrl).toContain("yurplan");
  });

  it("fiche sans horaire → allDay, une seule occurrence structurée", () => {
    const detail = parseSjlbDetail(
      fixture("detail-no-horaire.html"),
      "https://www.saintjeanleblanc.com/Ress_3219/EN-SC-NE-POUR-DES-R-VES-POUR-YANIS-.html",
    );
    expect(detail.dateRaw).toBe("02/10/2026");
    expect(detail.horairesRaw).toBeNull();
    expect(detail.descriptionText).toMatch(/21 novembre/i);

    const mapped = mapSjlbDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.allDay).toBe(true);
    expect(mapped.event.startAt).toMatch(/2026-10-02/);
    // Pas de seconde occurrence inventée
    expect(mapped.event.endAt).toMatch(/2026-10-02/);
  });

  it("parseFrSlashDate / parseHoraires", () => {
    expect(parseFrSlashDate("16/10/2026")).toEqual({
      year: 2026,
      month: 10,
      day: 16,
    });
    expect(parseFrSlashDate("junk")).toBeNull();
    expect(parseHoraires("20H00")).toEqual({
      startHour: 20,
      startMinute: 0,
      endHour: null,
      endMinute: null,
    });
    expect(parseHoraires("8H45")).toEqual({
      startHour: 8,
      startMinute: 45,
      endHour: null,
      endMinute: null,
    });
    expect(parseHoraires("20H00-22H30")).toEqual({
      startHour: 20,
      startMinute: 0,
      endHour: 22,
      endMinute: 30,
    });
    expect(parseHoraires(null)).toBeNull();
  });
});

describe("saint-jean-le-blanc adapter fail-closed + pagination", () => {
  it("buildSjlbListPageUrl", () => {
    expect(buildSjlbListPageUrl(1)).toContain("/Liste_agenda_1/");
    expect(buildSjlbListPageUrl(2)).toContain(
      "ListeAgenda.php?IdRubrique=1&p=2&listeDebut=9&listeFin=18",
    );
  });

  it("pagination complète + mapping fenêtre", async () => {
    const page1 = fixture("list-page.html");
    const page2 = `<!DOCTYPE html><html><body>
<div class="col-lg-4 item_agenda"><div class="content"><span class="thematique">Théâtre</span>
<div class="image"><img src="upload/x.jpg" /></div>
<div id="X" class="agenda"><h3><a href="Ress_9999/EXTRA.html">EXTRA SHOW</a></h3></div>
</div></div>
<a href="ListeAgenda.php?IdRubrique=1&p=1&listeDebut=0&listeFin=9">1</a>
<a href="ListeAgenda.php?IdRubrique=1&p=2&listeDebut=9&listeFin=18">2</a>
</body></html>`;

    const details: Record<string, string> = {
      "3195": fixture("detail-complete.html"),
      "3219": fixture("detail-no-horaire.html"),
      "9999": `<!DOCTYPE html><html><body><div id="texte">
<h1>EXTRA SHOW</h1>
<div class="separation"><span>Date</span><p>01/11/2026</p></div>
<div class="separation"><span>Horaires</span><p>18H00</p></div>
<div class="separation"><span>Lieu</span><p>Espace Montission</p></div>
</div></body></html>`,
    };

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("Liste_agenda_1") || /p=1&/.test(url)) {
        return htmlResponse(page1);
      }
      if (/p=2&/.test(url)) return htmlResponse(page2);
      const id = url.match(/Ress_(\d+)/)?.[1];
      if (id && details[id]) return htmlResponse(details[id]!);
      return htmlResponse("missing", 404);
    });

    const adapter = new SaintJeanLeBlancEventAdapter({ fetchImpl });
    const from = new Date("2026-09-01T00:00:00+02:00");
    const to = new Date("2027-01-01T00:00:00+01:00");
    const result = await adapter.collectUpcomingEvents({ from, to });

    expect(result.stats.listPagesFetched).toBe(2);
    expect(result.stats.discovered).toBe(3);
    expect(result.stats.detailsFetched).toBe(3);
    expect(result.events.length).toBe(3);
    expect(result.events.map((e) => e.id).sort()).toEqual([
      "saint-jean-le-blanc:3195",
      "saint-jean-le-blanc:3219",
      "saint-jean-le-blanc:9999",
    ]);
  });

  it("HTTP non-200 → throw", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse("nope", 503));
    const adapter = new SaintJeanLeBlancEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/HTTP error: 503/);
  });

  it("page 1 vide → throw", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(fixture("list-empty.html")),
    );
    const adapter = new SaintJeanLeBlancEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/0 \.item_agenda/);
  });

  it("page intermédiaire vide → throw", async () => {
    const page1 = `<!DOCTYPE html><html><body>
${Array.from({ length: 2 }, (_, i) => {
  const id = 1000 + i;
  return `<div class="item_agenda"><div class="content"><span class="thematique">Théâtre</span>
<div id="A${id}" class="agenda"><h3><a href="Ress_${id}/E.html">Event ${id}</a></h3></div></div></div>`;
}).join("")}
<a href="ListeAgenda.php?IdRubrique=1&p=1&listeDebut=0&listeFin=9">1</a>
<a href="ListeAgenda.php?IdRubrique=1&p=2&listeDebut=9&listeFin=18">2</a>
<a href="ListeAgenda.php?IdRubrique=1&p=3&listeDebut=18&listeFin=27">3</a>
</body></html>`;

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("Liste_agenda") || /p=1&/.test(url)) {
        return htmlResponse(page1);
      }
      if (/p=2&/.test(url)) {
        return htmlResponse(
          `<!DOCTYPE html><html><body><p>empty mid</p>
<a href="ListeAgenda.php?IdRubrique=1&p=3&listeDebut=18&listeFin=27">3</a></body></html>`,
        );
      }
      return htmlResponse("<html></html>");
    });

    const adapter = new SaintJeanLeBlancEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/empty intermediate page 2|0 \.item_agenda/);
  });

  it("taux de détails trop bas → throw", async () => {
    const page1 = fixture("list-page.html");
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("Liste_agenda") || /ListeAgenda|p=1/.test(url)) {
        // Force single-page by stripping pager links beyond p=1 for simplicity:
        // list-page announces p=2 — return empty last page with 0 items allowed
        if (/p=2&/.test(url)) {
          return htmlResponse(
            `<!DOCTYPE html><html><body><p>end</p></body></html>`,
          );
        }
        return htmlResponse(page1);
      }
      return htmlResponse("fail", 500);
    });

    const adapter = new SaintJeanLeBlancEventAdapter({
      fetchImpl,
      minDetailSuccessRate: 0.7,
    });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/success rate too low|HTTP error: 500/);
  });
});
