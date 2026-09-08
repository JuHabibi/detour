import { describe, expect, it } from "vitest";
import {
  canonicalizeExplorerTitle,
  explorerDedupePartitionKey,
  normalizeExplorerVenue,
} from "@/application/explorer/explorer-title-canonical";

function groupId(parts: {
  id: string;
  cityKey?: string | null;
  venue: string;
  startAt: string;
  endAt: string;
  title: string;
}): string {
  const key = explorerDedupePartitionKey({
    id: parts.id,
    cityKey: parts.cityKey ?? "Orléans",
    venue: parts.venue,
    startAt: parts.startAt,
    endAt: parts.endAt,
    title: parts.title,
  });
  return [
    key.cityKey,
    key.venueKey,
    key.startAt,
    key.endEff,
    key.canonicalTitle,
  ].join("|");
}

describe("canonicalizeExplorerTitle V1", () => {
  it("Hop Pop Hop ↔ année terminale", () => {
    expect(canonicalizeExplorerTitle("HOP POP HOP")).toBe("hop pop hop");
    expect(canonicalizeExplorerTitle("Hop Pop Hop 2026")).toBe("hop pop hop");
  });

  it("Culture jazz préfixe court avant -", () => {
    expect(
      canonicalizeExplorerTitle(
        "Culture jazz - Histoire de la batterie dans le jazz",
      ),
    ).toBe(canonicalizeExplorerTitle("Histoire de la batterie dans le jazz"));
  });

  it("Instants suspendus : Trio Wanderer", () => {
    expect(
      canonicalizeExplorerTitle("Instants suspendus : Trio Wanderer"),
    ).toBe(canonicalizeExplorerTitle("Trio Wanderer"));
  });

  it("Bib créative accents", () => {
    expect(canonicalizeExplorerTitle("Bib créative")).toBe("bib creative");
  });

  it("ne strip pas un préfixe Atelier", () => {
    expect(canonicalizeExplorerTitle("Atelier : poterie créative")).toBe(
      "atelier poterie creative",
    );
  });

  it("préfixe 4 mots (VR) non stripé", () => {
    const a = canonicalizeExplorerTitle("Jeux vidéo casque VR : Elixir");
    const b = canonicalizeExplorerTitle("Jeux vidéo sur console");
    expect(a).not.toBe(b);
    expect(a).toContain("vr");
  });
});

describe("Explorer V1 partition grouping", () => {
  const start = "2026-09-11T15:30:00.000Z";
  const end = "2026-09-11T21:59:00.000Z";
  const venue = "Campo Santo";

  it("1. HOP POP HOP + Hop Pop Hop 2026 → 1 groupe", () => {
    expect(
      groupId({
        id: "a",
        venue,
        startAt: start,
        endAt: end,
        title: "HOP POP HOP",
      }),
    ).toBe(
      groupId({
        id: "b",
        venue,
        startAt: start,
        endAt: end,
        title: "Hop Pop Hop 2026",
      }),
    );
  });

  it("2. Culture jazz prefix → 1 groupe", () => {
    expect(
      groupId({
        id: "a",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Culture jazz - Histoire de la batterie dans le jazz",
      }),
    ).toBe(
      groupId({
        id: "b",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Histoire de la batterie dans le jazz",
      }),
    );
  });

  it("3. Trio Wanderer prefix → 1 groupe", () => {
    expect(
      groupId({
        id: "a",
        venue: "Salle de l'institut",
        startAt: start,
        endAt: end,
        title: "Instants suspendus : Trio Wanderer",
      }),
    ).toBe(
      groupId({
        id: "b",
        venue: "Salle de l'institut",
        startAt: start,
        endAt: end,
        title: "Trio Wanderer",
      }),
    );
  });

  it("4. Bib créative identique → 1 groupe", () => {
    expect(
      groupId({
        id: "a",
        venue: "Bibliothèque",
        startAt: start,
        endAt: end,
        title: "Bib créative",
      }),
    ).toBe(
      groupId({
        id: "b",
        venue: "Bibliothèque",
        startAt: start,
        endAt: end,
        title: "Bib créative",
      }),
    );
  });

  it("5. VR Elixir vs Jeux vidéo sur console → 2", () => {
    expect(
      groupId({
        id: "a",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Jeux vidéo casque VR : Elixir",
      }),
    ).not.toBe(
      groupId({
        id: "b",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Jeux vidéo sur console",
      }),
    );
  });

  it("6. Pokémon Snap vs Jeux vidéo sur console → 2", () => {
    expect(
      groupId({
        id: "a",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Jeu vidéo : Rallye Photo New Pokémon Snap",
      }),
    ).not.toBe(
      groupId({
        id: "b",
        venue: "Médiathèque",
        startAt: start,
        endAt: end,
        title: "Jeux vidéo sur console",
      }),
    );
  });

  it("7. même lieu/date titres différents → 2", () => {
    expect(
      groupId({
        id: "a",
        venue,
        startAt: start,
        endAt: end,
        title: "George Sand, 150 ans",
      }),
    ).not.toBe(
      groupId({
        id: "b",
        venue,
        startAt: start,
        endAt: end,
        title: "Journées européennes du patrimoine : Ouverture",
      }),
    );
  });

  it("8. même titre dates différentes → 2", () => {
    expect(
      groupId({
        id: "a",
        venue,
        startAt: "2026-09-10T18:00:00.000Z",
        endAt: "2026-09-10T20:00:00.000Z",
        title: "Duo Zéphyr",
      }),
    ).not.toBe(
      groupId({
        id: "b",
        venue,
        startAt: "2026-09-17T18:00:00.000Z",
        endAt: "2026-09-17T20:00:00.000Z",
        title: "Duo Zéphyr",
      }),
    );
  });

  it("9. même titre/date lieux différents → 2", () => {
    expect(
      groupId({
        id: "a",
        venue: "Astrolabe",
        startAt: start,
        endAt: end,
        title: "Concert jazz",
      }),
    ).not.toBe(
      groupId({
        id: "b",
        venue: "Théâtre d'Orléans",
        startAt: start,
        endAt: end,
        title: "Concert jazz",
      }),
    );
  });

  it("venue vide → pas de collapse (clés distinctes via id)", () => {
    const a = explorerDedupePartitionKey({
      id: "a",
      cityKey: "Orléans",
      venue: null,
      startAt: start,
      endAt: end,
      title: "Same",
    });
    const b = explorerDedupePartitionKey({
      id: "b",
      cityKey: "Orléans",
      venue: null,
      startAt: start,
      endAt: end,
      title: "Same",
    });
    expect(a.venueKey).toBe("a");
    expect(b.venueKey).toBe("b");
  });

  it("normalizeExplorerVenue", () => {
    expect(normalizeExplorerVenue("  Campo Santo  ")).toBe("campo santo");
    expect(normalizeExplorerVenue(null)).toBe("");
  });
});
