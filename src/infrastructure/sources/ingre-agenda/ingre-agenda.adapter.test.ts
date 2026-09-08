import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { IngreAgendaEventAdapter } from "./ingre-agenda.adapter";
import { parseIngreAgendaDetail } from "./ingre-agenda.detail-parser";
import { parseIngreAgendaListPage } from "./ingre-agenda.list-parser";
import {
  detectAmbiguousProgram,
  mapIngreAgendaDetailToDetourEvent,
} from "./ingre-agenda.mapper";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function detailShell(params: {
  nid: string;
  illustration?: string;
  extra?: string;
  title?: string;
  body?: string;
  dateHtml?: string;
}): string {
  const title = params.title ?? `Event ${params.nid}`;
  const dateHtml =
    params.dateHtml ??
    `<ul class="field-ads-agenda-date"><li><span class="date-display-single">Samedi 26 septembre 2026 <span class="date-display-start">10:00</span> <span class="date-display-end">12:00</span></span></li></ul>`;
  return `<!DOCTYPE html><html><head>
<link rel="shortlink" href="https://www.ingre.fr/node/${params.nid}" />
<link rel="canonical" href="https://www.ingre.fr/agenda/e-${params.nid}" />
</head>
<body class="page-node-${params.nid}">
${params.illustration ?? ""}
<div class="node-ads-agenda node-${params.nid}">
  <h1 class="pane-title">${title}</h1>
  <div class="field-body"><p>${params.body ?? `Description ${params.nid}`}</p></div>
  ${dateHtml}
</div>
${params.extra ?? ""}
</body></html>`;
}

function listShell(itemsHtml: string, pagerHtml: string): string {
  return `<!DOCTYPE html><html><body>
<div class="view-content">${itemsHtml}</div>
<div class="text-center"><ul class="pagination">${pagerHtml}</ul></div>
</body></html>`;
}

function teaser(nid: string, slug: string, title: string): string {
  return `<article id="node-${nid}" class="node node-ads-agenda node-teaser clearfix">
  <h3><a href="/agenda/${slug}">${title}</a></h3>
  <div class="field-ads-accroche">Accroche ${nid}</div>
</article>`;
}

function detailTimed(nid: string, slug: string, dayLabel: string): string {
  return `<!DOCTYPE html><html><head>
<link rel="shortlink" href="https://www.ingre.fr/node/${nid}" />
<link rel="canonical" href="https://www.ingre.fr/agenda/${slug}" />
</head>
<body class="page-node-${nid}">
<div class="panelizer-view-mode node node-full node-ads-agenda node-${nid}">
  <h1 class="pane-title">Event ${nid}</h1>
  <div class="field-ads-accroche">Teaser ${nid}</div>
  <div class="field-body"><p>Description ${nid}</p></div>
  <ul class="field-ads-agenda-thematique"><li>Culture</li></ul>
  <ul class="field-ads-agenda-date">
    <li><span class="date-display-single">${dayLabel} <span class="date-display-start">10:00</span> <span class="date-display-end">12:00</span></span></li>
  </ul>
</div>
</body></html>`;
}

const PAGER_TO_3 = `
<li class="pager-first"><a href="/agenda">premier</a></li>
<li><a href="/agenda?page=1">2</a></li>
<li><a href="/agenda?page=2">3</a></li>
<li class="pager-last"><a href="/agenda?page=3">last</a></li>`;

describe("ingre-agenda list parser", () => {
  it("pagination normale : page 0 avec pager-last", () => {
    const page = parseIngreAgendaListPage(fixture("list0.html"));
    expect(page.items).toHaveLength(6);
    expect(page.lastPageIndex).toBe(3);
    expect(page.items.map((i) => i.nid)).toEqual([
      "3826",
      "3828",
      "3822",
      "3824",
      "3827",
      "3830",
    ]);
  });

  it("dernière page courte", () => {
    const page = parseIngreAgendaListPage(fixture("list3.html"));
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.nid).toBe("3817");
    expect(page.lastPageIndex).toBe(3);
  });

  it("HTML inattendu avec pager → throw", () => {
    expect(() =>
      parseIngreAgendaListPage(
        listShell(
          "",
          `<li class="pager-last"><a href="/agenda?page=2">last</a></li>`,
        ),
      ),
    ).toThrow(/pager announces pages but no teasers/);
  });
});

describe("ingre-agenda detail parser + mapper", () => {
  it("fiche simple horodatée", () => {
    const detail = parseIngreAgendaDetail(fixture("detail-simple.html"));
    expect(detail.nid).toBe("3825");
    expect(detail.singleDayStartTime).toBe("10:00");
    expect(detail.singleDayEndTime).toBe("12:00");
    expect(detail.allDay).toBe(false);

    const mapped = mapIngreAgendaDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("ingre-agenda:3825");
    expect(mapped.event.startAt).toBe("2026-09-26T10:00:00+02:00");
    expect(mapped.event.endAt).toBe("2026-09-26T12:00:00+02:00");
    expect(mapped.event.city).toBe("Ingré");
    expect(mapped.event.latitude).toBeNull();
    expect(mapped.event.longitude).toBeNull();
    expect(mapped.event.venue).toBeNull();
    expect(mapped.event.imageUrl).toBeNull();
  });

  it("extrait une illustration événement (URL absolue)", () => {
    const html = detailShell({
      nid: "9001",
      illustration: `<figure class="field-ads-illustration">
        <img class="img-responsive" src="https://www.ingre.fr/sites/default/files/public/media/concert.jpg" alt="Concert" />
      </figure>`,
    });
    expect(parseIngreAgendaDetail(html).imageUrl).toBe(
      "https://www.ingre.fr/sites/default/files/public/media/concert.jpg",
    );
  });

  it("normalise une illustration relative en URL absolue", () => {
    const html = detailShell({
      nid: "9002",
      illustration: `<figure class="field-ads-illustration">
        <img src="/sites/default/files/public/media/expo.jpg" alt="" />
      </figure>`,
    });
    expect(parseIngreAgendaDetail(html).imageUrl).toBe(
      "https://www.ingre.fr/sites/default/files/public/media/expo.jpg",
    );
  });

  it("absence d'illustration → imageUrl null", () => {
    expect(parseIngreAgendaDetail(detailShell({ nid: "9003", illustration: "" })).imageUrl).toBeNull();
  });

  it("image Drupal par défaut → imageUrl null", () => {
    const html = detailShell({
      nid: "9004",
      illustration: `<figure class="field-ads-illustration">
        <img src="https://www.ingre.fr/sites/default/files/public/default_images/image_defaut_1.jpg" alt="" />
      </figure>`,
    });
    expect(parseIngreAgendaDetail(html).imageUrl).toBeNull();
  });

  it("ignore logo hors field-ads-illustration", () => {
    const html = detailShell({
      nid: "9005",
      illustration: "",
      extra: `<img alt="ingre" src="/sites/default/files/public/media/panes/blason-ingre.png" />`,
    });
    expect(parseIngreAgendaDetail(html).imageUrl).toBeNull();
  });

  it("all-day multi-jours (Saint-Loup)", () => {
    const detail = parseIngreAgendaDetail(fixture("detail-saintloup.html"));
    expect(detail.nid).toBe("3805");
    expect(detail.allDay).toBe(true);

    const mapped = mapIngreAgendaDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.id).toBe("ingre-agenda:3805");
    expect(mapped.event.startAt).toBe("2026-09-05T00:00:00+02:00");
    expect(mapped.event.endAt).toBe("2026-09-07T00:00:00+02:00");
    expect(mapped.event.allDay).toBe(true);
  });

  it("all-day single jour (date-display-single)", () => {
    const html = `<!DOCTYPE html><html><head>
<link rel="shortlink" href="https://www.ingre.fr/node/3820" />
<link rel="canonical" href="https://www.ingre.fr/agenda/phosphene" />
</head>
<body class="page-node-3820">
<div class="node-ads-agenda node-3820">
  <h1 class="pane-title">Ateliers créatifs</h1>
  <ul class="field-ads-agenda-date">
    <li><span class="date-display-single">Samedi 12 septembre 2026 (Jour entier)</span></li>
  </ul>
</div>
</body></html>`;
    const detail = parseIngreAgendaDetail(html);
    expect(detail.allDay).toBe(true);
    const mapped = mapIngreAgendaDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.event.startAt).toBe("2026-09-12T00:00:00+02:00");
    expect(mapped.event.endAt).toBe("2026-09-13T00:00:00+02:00");
    expect(mapped.event.allDay).toBe(true);
  });

  it("programme multi-rdv ambigu (Apacrete)", () => {
    const detail = parseIngreAgendaDetail(fixture("detail-apacrete.html"));
    expect(detail.nid).toBe("3827");
    expect(detectAmbiguousProgram({ bodyText: detail.bodyText })).toMatch(
      /body_distinct_dates/,
    );

    const mapped = mapIngreAgendaDetailToDetourEvent(detail);
    expect(mapped.ok).toBe(false);
    if (mapped.ok) return;
    expect(mapped.exclusion.reason).toBe("ambiguous_program");
  });

  it("exclut période administrative all-day (appel à archives / cours / promo)", () => {
    expect(
      detectAmbiguousProgram({
        title: "Appel à archives : exposition",
        bodyText: "Nous recherchons divers documents.",
      }),
    ).toBe("administrative_period:title_appel_a");

    expect(
      detectAmbiguousProgram({
        title: "Judo",
        bodyText: "Ingré judo club propose des cours de judo à partir de 4 ans.",
      }),
    ).toBe("administrative_period:body_propose_des_cours");

    expect(
      detectAmbiguousProgram({
        title: "Arabesque",
        bodyText:
          "faites le plein d’énergie dès le 1er septembre ! Retrouvez-nous au Forum des associations le 12 septembre",
      }),
    ).toMatch(/administrative_period:body_rentree_promo_forum|body_distinct_dates/);
  });

  it("stabilité du nid / ID", () => {
    const a = parseIngreAgendaDetail(fixture("detail-simple.html"));
    const b = parseIngreAgendaDetail(fixture("detail-simple.html"));
    const ma = mapIngreAgendaDetailToDetourEvent(a);
    const mb = mapIngreAgendaDetailToDetourEvent(b);
    expect(ma.ok && mb.ok).toBe(true);
    if (!ma.ok || !mb.ok) return;
    expect(ma.event.id).toBe(mb.event.id);
    expect(ma.event.id).toBe(`ingre-agenda:${a.nid}`);
  });

  it("fenêtre temporelle : hors fenêtre → outside_window via adapter", async () => {
    const listHtml = listShell(
      teaser("3825", "simple", "Simple"),
      "",
    );
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/agenda/simple")) {
        return new Response(fixture("detail-simple.html"), { status: 200 });
      }
      return new Response(listHtml, { status: 200 });
    });
    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    const result = await adapter.collectUpcomingEvents({
      from: new Date("2025-01-01T00:00:00+01:00"),
      to: new Date("2025-02-01T00:00:00+01:00"),
    });
    expect(result.events).toHaveLength(0);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        nid: "3825",
        reason: "outside_window",
      }),
    ]);
  });
});

describe("IngreAgendaEventAdapter pagination", () => {
  function fullPage(nids: string[], pageIndex: number): string {
    const items = nids
      .map((nid) => teaser(nid, `e-${nid}`, `Event ${nid}`))
      .join("\n");
    return listShell(items, PAGER_TO_3);
  }

  it("pagination normale + dernière page courte", async () => {
    const pages: Record<number, string> = {
      0: fullPage(["1001", "1002", "1003", "1004", "1005", "1006"], 0),
      1: fullPage(["1007", "1008", "1009", "1010", "1011", "1012"], 1),
      2: fullPage(["1013", "1014", "1015", "1016", "1017", "1018"], 2),
      3: listShell(teaser("1019", "e-1019", "Event 1019"), PAGER_TO_3),
    };

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const pageMatch = /[?&]page=(\d+)/.exec(url);
      if (url.includes("/agenda/e-")) {
        const nid = /e-(\d+)/.exec(url)?.[1] ?? "0";
        return new Response(
          detailTimed(nid, `e-${nid}`, "Samedi 26 septembre 2026"),
          { status: 200 },
        );
      }
      if (!pageMatch && url.endsWith("/agenda")) {
        return new Response(pages[0]!, { status: 200 });
      }
      const page = Number(pageMatch?.[1] ?? 0);
      return new Response(pages[page] ?? "", { status: 200 });
    });

    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    const result = await adapter.collectUpcomingEvents({
      from: new Date("2026-01-01T00:00:00+01:00"),
      to: new Date("2027-01-01T00:00:00+01:00"),
    });

    expect(result.stats.discovered).toBe(19);
    expect(result.stats.detailsFetched).toBe(19);
    expect(result.stats.published).toBe(19);
    expect(result.stats.excluded).toBe(0);
    expect(result.events.map((e) => e.id)).toContain("ingre-agenda:1001");
    expect(result.events.map((e) => e.id)).toContain("ingre-agenda:1019");
  });

  it("page intermédiaire manquante → throw", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/agenda")) {
        return new Response(
          fullPage(["1", "2", "3", "4", "5", "6"], 0),
          { status: 200 },
        );
      }
      if (url.includes("page=1")) {
        return new Response(
          listShell(
            "",
            `<li class="pager-last"><a href="/agenda?page=3">last</a></li>`,
          ),
          { status: 200 },
        );
      }
      return new Response("nope", { status: 404 });
    });

    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/incomplete pagination|no teasers|empty page/i);
  });

  it("HTTP non OK → throw (pas [])", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/HTTP error: 503/);
  });

  it("HTML inattendu sans pager → corpus vide légitime", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html><body>Maintenance</body></html>", { status: 200 }),
    );
    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).resolves.toEqual([]);
  });

  it("HTML inattendu avec pager → throw", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          listShell(
            "<div>broken</div>",
            `<li class="pager-last"><a href="/agenda?page=2">last</a></li>`,
          ),
          { status: 200 },
        ),
    );
    const adapter = new IngreAgendaEventAdapter({ fetchImpl });
    await expect(
      adapter.fetchUpcomingEvents({
        from: new Date("2026-01-01"),
        to: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(/pager announces pages but no teasers/);
  });

  it("limite la concurrence des fiches détail", async () => {
    const listHtml = listShell(
      [
        teaser("1", "e-1", "A"),
        teaser("2", "e-2", "B"),
        teaser("3", "e-3", "C"),
        teaser("4", "e-4", "D"),
      ].join("\n"),
      "",
    );
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/agenda/e-")) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 40));
        inFlight -= 1;
        const nid = /e-(\d+)/.exec(url)?.[1] ?? "0";
        return new Response(
          detailTimed(nid, `e-${nid}`, "Samedi 26 septembre 2026"),
          { status: 200 },
        );
      }
      return new Response(listHtml, { status: 200 });
    });

    const adapter = new IngreAgendaEventAdapter({
      fetchImpl,
      detailConcurrency: 2,
    });
    await adapter.fetchUpcomingEvents({
      from: new Date("2026-01-01"),
      to: new Date("2027-01-01"),
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
