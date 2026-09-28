import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import {
  EXPLORER_FRIEZE_HARD_CAP,
  buildExplorerFrieze,
  resolveFriezeWindow,
  shiftFriezeAnchor,
  toParisDateKey,
} from "@/features/frise/timeline/frise-timeline-model";

function item(
  partial: Pick<EventItem, "id" | "title" | "date"> &
    Partial<EventItem>,
): EventItem {
  return {
    category: "Musique",
    genre: "",
    venue: "Lieu",
    city: "Orléans",
    dateLabel: partial.date,
    ...partial,
  };
}

describe("resolveFriezeWindow", () => {
  it("couvre trois mois civils inclus", () => {
    const w = resolveFriezeWindow("2026-09-01");
    expect(w.fromKey).toBe("2026-09-01");
    expect(w.toKey).toBe("2026-11-30");
    expect(w.label).toMatch(/Septembre/i);
    expect(w.label).toMatch(/Novembre/i);
  });

  it("affiche les deux années sur un changement d’année", () => {
    const w = resolveFriezeWindow("2026-11-01");
    expect(w.fromKey).toBe("2026-11-01");
    expect(w.toKey).toBe("2027-01-31");
    expect(w.label).toContain("2026");
    expect(w.label).toContain("2027");
  });
});

describe("buildExplorerFrieze", () => {
  const window = resolveFriezeWindow("2026-09-01");

  it("période vide : trois chapitres calmes, zéro événement inventé", () => {
    const model = buildExplorerFrieze({
      events: [],
      window,
      fetchedCount: 0,
      truncatedByCap: false,
    });
    expect(model.eventCountInWindow).toBe(0);
    expect(model.chapters).toHaveLength(3);
    expect(model.chapters.every((c) => c.items.every((i) => i.kind === "quiet"))).toBe(
      true,
    );
  });

  it("plusieurs événements le même jour → un cluster jour", () => {
    const model = buildExplorerFrieze({
      events: [
        item({
          id: "a",
          title: "A",
          date: "2026-09-12",
          startAt: "2026-09-12T18:00:00+02:00",
        }),
        item({
          id: "b",
          title: "B",
          date: "2026-09-12",
          startAt: "2026-09-12T20:00:00+02:00",
        }),
        item({
          id: "c",
          title: "C",
          date: "2026-09-12",
          startAt: "2026-09-12T21:00:00+02:00",
        }),
      ],
      window,
      fetchedCount: 3,
      truncatedByCap: false,
    });
    const day = model.chapters
      .flatMap((c) => c.items)
      .find((i) => i.kind === "day" && i.dateKey === "2026-09-12");
    expect(day?.kind).toBe("day");
    if (day?.kind === "day") {
      expect(day.events).toHaveLength(3);
    }
  });

  it("événement multi-jours : ancré sur la date de début uniquement", () => {
    const model = buildExplorerFrieze({
      events: [
        item({
          id: "m",
          title: "Festival",
          date: "2026-10-01",
          startAt: "2026-10-01T10:00:00+02:00",
          endAt: "2026-10-04T22:00:00+02:00",
        }),
      ],
      window,
      fetchedCount: 1,
      truncatedByCap: false,
    });
    const days = model.chapters
      .flatMap((c) => c.items)
      .filter((i) => i.kind === "day");
    expect(days).toHaveLength(1);
    expect(days[0]?.kind === "day" && days[0].dateKey).toBe("2026-10-01");
  });

  it("ignore les événements hors fenêtre (pas d’invention)", () => {
    const model = buildExplorerFrieze({
      events: [
        item({
          id: "out",
          title: "Trop tôt",
          date: "2026-08-20",
          startAt: "2026-08-20T18:00:00+02:00",
        }),
        item({
          id: "in",
          title: "Dans la fenêtre",
          date: "2026-09-05",
          startAt: "2026-09-05T18:00:00+02:00",
        }),
        item({
          id: "late",
          title: "Trop tard",
          date: "2026-12-01",
          startAt: "2026-12-01T18:00:00+01:00",
        }),
      ],
      window,
      fetchedCount: 3,
      truncatedByCap: false,
    });
    expect(model.eventCountInWindow).toBe(1);
    expect(model.fetchedCount).toBe(3);
  });

  it("expose le plafond dur", () => {
    const model = buildExplorerFrieze({
      events: [],
      window,
      fetchedCount: 150,
      truncatedByCap: true,
      coverageStatus: "truncated",
    });
    expect(model.hardCap).toBe(EXPLORER_FRIEZE_HARD_CAP);
    expect(model.truncatedByCap).toBe(true);
    expect(model.coverageStatus).toBe("truncated");
    const october = model.chapters.find((c) => c.monthKey === "2026-10");
    expect(october?.items[0]?.kind).toBe("quiet");
    if (october?.items[0]?.kind === "quiet") {
      expect(october.items[0].label).toBe(
        "Couverture incomplète pour ce mois",
      );
      expect(october.items[0].label).not.toBe("Aucune sortie ce mois-ci");
    }
  });

  it("pending / error : pas de libellé « Aucune sortie »", () => {
    for (const coverageStatus of ["pending", "error"] as const) {
      const model = buildExplorerFrieze({
        events: [],
        window,
        fetchedCount: 0,
        truncatedByCap: false,
        coverageStatus,
      });
      const labels = model.chapters.flatMap((c) =>
        c.items.filter((i) => i.kind === "quiet").map((i) => i.label),
      );
      expect(labels.some((l) => l.includes("Aucune sortie"))).toBe(false);
      expect(model.coverageStatus).toBe(coverageStatus);
    }
  });

  it("coverage status mismatches other windows", async () => {
    const { resolveFriseCoverageStatus: resolveCoverage } = await import(
      "@/features/frise/timeline/frise-timeline-model"
    );
    const status = resolveCoverage({
      viewFrom: "2026-12-01",
      viewTo: "2027-02-28",
      viewCategory: "Musique",
      viewCity: null,
      viewSearch: "",
      settled: {
        from: "2026-09-01",
        to: "2026-11-30",
        category: "Musique",
        city: null,
        search: "",
        status: "complete",
      },
    });
    expect(status).toBe("pending");

    const errorStatus = resolveCoverage({
      viewFrom: "2026-12-01",
      viewTo: "2027-02-28",
      viewCategory: "Musique",
      viewCity: null,
      viewSearch: "",
      settled: {
        from: "2026-12-01",
        to: "2027-02-28",
        category: "Musique",
        city: null,
        search: "",
        status: "error",
      },
    });
    expect(errorStatus).toBe("error");
  });

  it("coverage status mismatches when city or search changes", async () => {
    const { resolveFriseCoverageStatus: resolveCoverage } = await import(
      "@/features/frise/timeline/frise-timeline-model"
    );
    const settled = {
      from: "2026-09-01",
      to: "2026-11-30",
      category: "Musique",
      city: null as string | null,
      search: "",
      status: "complete" as const,
    };

    expect(
      resolveCoverage({
        viewFrom: settled.from,
        viewTo: settled.to,
        viewCategory: settled.category,
        viewCity: "Orléans",
        viewSearch: settled.search,
        settled,
      }),
    ).toBe("pending");

    expect(
      resolveCoverage({
        viewFrom: settled.from,
        viewTo: settled.to,
        viewCategory: settled.category,
        viewCity: settled.city,
        viewSearch: "jazz",
        settled,
      }),
    ).toBe("pending");

    expect(
      resolveCoverage({
        viewFrom: settled.from,
        viewTo: settled.to,
        viewCategory: settled.category,
        viewCity: settled.city,
        viewSearch: settled.search,
        settled,
      }),
    ).toBe("complete");
  });

  it("garde des respirations calmes entre clusters", () => {
    const model = buildExplorerFrieze({
      events: [
        item({
          id: "early",
          title: "Début",
          date: "2026-09-02",
          startAt: "2026-09-02T18:00:00+02:00",
        }),
        item({
          id: "late",
          title: "Fin",
          date: "2026-11-20",
          startAt: "2026-11-20T18:00:00+01:00",
        }),
      ],
      window,
      fetchedCount: 2,
      truncatedByCap: false,
    });
    const quiet = model.chapters
      .flatMap((c) => c.items)
      .filter((i) => i.kind === "quiet");
    expect(quiet.length).toBeGreaterThan(0);
    const octoberQuiet = model.chapters
      .find((c) => c.monthKey === "2026-10")
      ?.items.filter((i) => i.kind === "quiet");
    expect(octoberQuiet?.[0]?.kind === "quiet" && octoberQuiet[0].label).toBe(
      "Aucune sortie ce mois-ci",
    );
    const withEventsQuiet = quiet.filter(
      (q) => q.kind === "quiet" && q.label.startsWith("Respiration"),
    );
    expect(withEventsQuiet.length).toBeGreaterThan(0);
    expect(model.chapters.map((c) => c.monthKey)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });

  it("libellé mois vide compréhensible", () => {
    const model = buildExplorerFrieze({
      events: [],
      window,
      fetchedCount: 0,
      truncatedByCap: false,
    });
    const october = model.chapters.find((c) => c.monthKey === "2026-10");
    expect(october?.items[0]?.kind).toBe("quiet");
    if (october?.items[0]?.kind === "quiet") {
      expect(october.items[0].label).toBe("Aucune sortie ce mois-ci");
    }
  });

  it("plusieurs événements le même jour restent tous exposés (pas de troncature modèle)", () => {
    const model = buildExplorerFrieze({
      events: [
        item({
          id: "a",
          title: "A",
          date: "2026-09-12",
          startAt: "2026-09-12T10:00:00+02:00",
        }),
        item({
          id: "b",
          title: "B",
          date: "2026-09-12",
          startAt: "2026-09-12T14:00:00+02:00",
        }),
        item({
          id: "c",
          title: "C",
          date: "2026-09-12",
          startAt: "2026-09-12T18:00:00+02:00",
        }),
        item({
          id: "d",
          title: "D",
          date: "2026-09-12",
          startAt: "2026-09-12T20:00:00+02:00",
        }),
      ],
      window,
      fetchedCount: 4,
      truncatedByCap: false,
    });
    const day = model.chapters
      .flatMap((c) => c.items)
      .find((i) => i.kind === "day" && i.dateKey === "2026-09-12");
    expect(day?.kind).toBe("day");
    if (day?.kind === "day") {
      expect(day.events.map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    }
  });
});

describe("shiftFriezeAnchor / toParisDateKey", () => {
  it("décale de 3 mois", () => {
    expect(shiftFriezeAnchor("2026-09-01", 3)).toBe("2026-12-01");
  });

  it("clé Paris depuis ISO", () => {
    expect(toParisDateKey("2026-09-25T23:30:00+02:00")).toBe("2026-09-25");
  });
});
