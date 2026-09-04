import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/event";
import {
  HIGHLIGHT_WEIGHTS,
  rankDetourHighlightCandidates,
  selectDetourHighlights,
  type EventHighlight,
} from "@/domain/select-detour-highlights";

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description ?? null,
    imageUrl: partial.imageUrl ?? null,
    startAt: partial.startAt ?? "2026-09-12T20:00:00+02:00",
    endAt: partial.endAt ?? null,
    venue: partial.venue ?? null,
    city: partial.city ?? "Orléans",
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    category: partial.category ?? null,
    genre: partial.genre ?? null,
    conditions: partial.conditions ?? null,
    source: partial.source ?? null,
    sourceUrl: partial.sourceUrl ?? null,
    registrationUrl: partial.registrationUrl ?? null,
    relevance: partial.relevance ?? "culture",
    relevanceReason: partial.relevanceReason,
  };
}

function reasonsOf(highlights: EventHighlight[], id: string): string[] {
  return highlights.find((item) => item.event.id === id)?.reasons ?? [];
}

function scoreOf(highlights: EventHighlight[], id: string): number | undefined {
  return highlights.find((item) => item.event.id === id)?.score;
}

describe("selectDetourHighlights", () => {
  it("détecte headline-appeal via « avec Prénom Nom »", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "avec",
        title: "Le Bourgeois Gentilhomme",
        category: "Spectacle",
        description: "Comédie avec Jean-Paul Rouve dans le rôle-titre.",
      }),
    ]);

    expect(reasonsOf(highlights, "avec")).toContain("headline-appeal");
  });

  it("détecte headline-appeal via « par Prénom Nom »", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "par",
        title: "Récital de piano",
        category: "Concert",
        description: "Un programme romantique par Marie Dupont.",
      }),
    ]);

    expect(reasonsOf(highlights, "par")).toContain("headline-appeal");
  });

  it("détecte compagnie / Cie", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "cie",
        title: "Création contemporaine",
        category: "Danse",
        description: "Une pièce présentée par la Cie Lumière.",
      }),
    ]);

    expect(reasonsOf(highlights, "cie")).toContain("headline-appeal");
  });

  it("ne déclenche pas headline sur un titre culturel générique", () => {
    const ranked = rankDetourHighlightCandidates([
      event({
        id: "generic",
        title: "Le Bourgeois Gentilhomme",
        category: "Spectacle",
        description: "Une comédie classique au théâtre municipal.",
      }),
    ]);

    expect(reasonsOf(ranked, "generic")).not.toContain("headline-appeal");
  });

  it("high-appeal exige désormais plusieurs soutiens", () => {
    const weak = rankDetourHighlightCandidates([
      event({
        id: "weak",
        title: "Concert improvisé",
        category: "Musique",
        // Un seul soutien : ponctuel (endAt null)
      }),
    ]);
    expect(reasonsOf(weak, "weak")).not.toContain("high-appeal");

    const strong = rankDetourHighlightCandidates([
      event({
        id: "strong",
        title: "Concert improvisé",
        category: "Musique",
        description: "x".repeat(90),
        registrationUrl: "https://example.com/book",
      }),
    ]);
    expect(reasonsOf(strong, "strong")).toContain("high-appeal");
  });

  it("le poids headline vaut bien +3", () => {
    const ranked = rankDetourHighlightCandidates([
      event({
        id: "headline",
        title: "One-man-show",
        category: "Humour",
        description: "Spectacle avec Paul Martin sur scène.",
      }),
    ]);

    const highlight = ranked.find((item) => item.event.id === "headline");
    expect(highlight).toBeDefined();
    expect(highlight!.reasons).toContain("headline-appeal");
    expect(highlight!.score).toBeGreaterThanOrEqual(
      HIGHLIGHT_WEIGHTS["headline-appeal"],
    );
    expect(HIGHLIGHT_WEIGHTS["headline-appeal"]).toBe(3);
  });

  it("strong-event préfère headline", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "headline",
          title: "Spectacle avec Alice Moreau",
          category: "Spectacle",
          description: "Soirée avec Alice Moreau.",
          city: "Orléans",
          startAt: "2026-09-20T20:00:00+02:00",
        }),
        event({
          id: "appeal",
          title: "Concert A",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/a",
          source: "Agenda",
          sourceUrl: "https://example.com/s",
          city: "Orléans",
          startAt: "2026-09-10T20:00:00+02:00",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Saint-Jean-de-Braye",
        }),
        event({
          id: "filler",
          title: "Projection documentaire",
          category: "Cinéma / projection",
          endAt: "2026-10-20T20:00:00+02:00",
          description: "Court.",
        }),
      ],
      { limit: 4, now: new Date("2026-09-04T12:00:00+02:00") },
    );

    expect(highlights[0]?.slot).toBe("strong-event");
    expect(highlights[0]?.event.id).toBe("headline");
    expect(highlights[0]?.reasons).toContain("headline-appeal");
  });

  it("fallback high-appeal si aucun headline", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "a1",
          title: "Concert A",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/a",
          source: "Agenda",
          sourceUrl: "https://example.com/s",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Olivet",
        }),
        event({
          id: "sing",
          title: "Projection documentaire",
          category: "Cinéma / projection",
          endAt: "2026-10-20T20:00:00+02:00",
          description: "Court.",
        }),
      ],
      { limit: 3 },
    );

    expect(highlights[0]?.slot).toBe("strong-event");
    expect(highlights[0]?.event.id).toBe("a1");
    expect(highlights[0]?.reasons).toContain("high-appeal");
    expect(highlights[0]?.reasons).not.toContain("headline-appeal");
  });

  it("local-gem sélectionne local-discovery", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "headline",
          title: "Spectacle avec Alice Moreau",
          category: "Spectacle",
          description: "Soirée avec Alice Moreau.",
          city: "Orléans",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Saint-Jean-de-Braye",
        }),
        event({
          id: "other",
          title: "Concert B",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/b",
          source: "Agenda",
          sourceUrl: "https://example.com/sb",
        }),
      ],
      { limit: 3 },
    );

    const localGem = highlights.find((item) => item.slot === "local-gem");
    expect(localGem?.event.id).toBe("local");
    expect(localGem?.reasons).toContain("local-discovery");
  });

  it("worth-planning sélectionne événement lointain avec planningScore", () => {
    const now = new Date("2026-09-04T12:00:00+02:00");
    const highlights = selectDetourHighlights(
      [
        event({
          id: "soon-headline",
          title: "Spectacle avec Alice Moreau",
          category: "Spectacle",
          description: "Soirée avec Alice Moreau.",
          city: "Orléans",
          startAt: "2026-09-10T20:00:00+02:00",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Olivet",
        }),
        // Pas de headline / pas local-discovery : reste pour worth-planning
        event({
          id: "far-plan",
          title: "Concert d’hiver",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/far",
          source: "Agenda",
          sourceUrl: "https://example.com/sf",
          city: "Orléans",
          startAt: "2026-12-01T20:00:00+01:00",
        }),
        event({
          id: "wild",
          title: "Projection documentaire",
          category: "Cinéma / projection",
          endAt: "2026-10-20T20:00:00+02:00",
          description: "Court.",
        }),
      ],
      { limit: 4, now },
    );

    expect(highlights.find((item) => item.slot === "strong-event")?.event.id).toBe(
      "soon-headline",
    );
    const planning = highlights.find((item) => item.slot === "worth-planning");
    expect(planning?.event.id).toBe("far-plan");
    expect(planning!.planningScore).toBeGreaterThan(0);
  });

  it("wildcard prend meilleur restant", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "headline",
          title: "Spectacle avec Alice Moreau",
          category: "Spectacle",
          description: "Soirée avec Alice Moreau.",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Olivet",
        }),
        event({
          id: "far",
          title: "Concert d’hiver",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/far",
          source: "Agenda",
          sourceUrl: "https://example.com/sf",
          city: "Orléans",
          startAt: "2026-12-01T20:00:00+01:00",
        }),
        event({
          id: "wild",
          title: "Concert restant",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/w",
          source: "Agenda",
          sourceUrl: "https://example.com/sw",
          startAt: "2026-09-11T20:00:00+02:00",
        }),
      ],
      { limit: 4, now: new Date("2026-09-04T12:00:00+02:00") },
    );

    expect(highlights.map((item) => item.slot)).toEqual([
      "strong-event",
      "local-gem",
      "worth-planning",
      "wildcard",
    ]);
    expect(highlights[3]?.slot).toBe("wildcard");
    expect(highlights[3]?.event.id).toBe("wild");
  });

  it("aucun doublon entre slots", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "one",
          title: "Festival jazz avec Carla Voss",
          category: "Musique",
          description: "Soirée avec Carla Voss.".padEnd(90, "."),
          registrationUrl: "https://example.com/one",
          source: "Agenda",
          sourceUrl: "https://example.com/s",
          city: "Olivet",
          venue: "Médiathèque",
          startAt: "2026-12-01T20:00:00+01:00",
        }),
        event({
          id: "two",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Saint-Jean-de-Braye",
        }),
        event({
          id: "three",
          title: "Spectacle avec Nina Leroy",
          category: "Spectacle",
          description: "Soirée avec Nina Leroy.".padEnd(90, "."),
          registrationUrl: "https://example.com/three",
          source: "Agenda",
          sourceUrl: "https://example.com/s3",
          city: "Chécy",
          startAt: "2026-11-01T20:00:00+01:00",
        }),
        event({
          id: "four",
          title: "Concert D",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/four",
          source: "Agenda",
          sourceUrl: "https://example.com/s4",
        }),
      ],
      { limit: 4, now: new Date("2026-09-04T12:00:00+02:00") },
    );

    const ids = highlights.map((item) => item.event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fallback quand un slot n’a aucun candidat", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "s1",
          title: "Concert 1",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/1",
          source: "Agenda",
          sourceUrl: "https://example.com/s1",
        }),
        event({
          id: "s2",
          title: "Concert 2",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/2",
          source: "Agenda",
          sourceUrl: "https://example.com/s2",
          startAt: "2026-09-13T20:00:00+02:00",
        }),
        event({
          id: "s3",
          title: "Spectacle 3",
          category: "Spectacle",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/3",
          source: "Agenda",
          sourceUrl: "https://example.com/s3",
          startAt: "2026-09-14T20:00:00+02:00",
        }),
      ],
      { limit: 3 },
    );

    // Pas de local-discovery / worth-planning typiques → fallback restants
    expect(highlights).toHaveLength(3);
    expect(new Set(highlights.map((item) => item.event.id)).size).toBe(3);
  });

  it("n’encode aucun nom propre particulier", () => {
    // Même structure textuelle, autre personne — doit matcher aussi.
    const highlights = selectDetourHighlights([
      event({
        id: "other",
        title: "Pièce contemporaine",
        category: "Théâtre",
        description: "Mise en scène avec Camille Bernard au plateau.",
      }),
    ]);

    expect(reasonsOf(highlights, "other")).toContain("headline-appeal");
    expect(HIGHLIGHT_WEIGHTS).not.toHaveProperty("jean-paul-rouve");
  });

  it("n’introduit aucun signal d’urgence", () => {
    const reasons = Object.keys(HIGHLIGHT_WEIGHTS).join(" ");
    expect(reasons).not.toMatch(/urgent|complet|places|stock|popularit/i);
    expect(HIGHLIGHT_WEIGHTS["booking-available"]).toBe(1);
  });

  it("booking seul ne crée pas un énorme score", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "booking-only",
        title: "Atelier cuisine",
        category: "Loisirs",
        relevance: "culture_leisure",
        registrationUrl: "https://example.com/book",
      }),
    ]);

    const highlight = highlights.find((item) => item.event.id === "booking-only");
    expect(highlight).toBeDefined();
    expect(highlight!.reasons).toEqual(["booking-available"]);
    expect(highlight!.score).toBe(HIGHLIGHT_WEIGHTS["booking-available"]);
  });

  it("exclut un événement hors scope", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "yoga",
        title: "Cours de yoga",
        category: "Sport",
        relevance: "out_of_scope",
        registrationUrl: "https://example.com/book",
        description: "x".repeat(100),
        source: "MJC",
        city: "Olivet",
      }),
    ]);

    expect(highlights).toHaveLength(0);
  });

  it("ne sélectionne aucun doublon", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "one",
          title: "Festival jazz",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/one",
          source: "Agenda",
          sourceUrl: "https://example.com/s",
          city: "Olivet",
          venue: "Médiathèque",
        }),
      ],
      { limit: 4 },
    );

    expect(highlights).toHaveLength(1);
    expect(new Set(highlights.map((item) => item.event.id)).size).toBe(1);
  });

  it("respecte limit", () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event({
        id: `e${index}`,
        title: `Concert ${index}`,
        category: "Musique",
        description: "x".repeat(90),
        registrationUrl: `https://example.com/${index}`,
        source: "Agenda",
        sourceUrl: `https://example.com/s${index}`,
        startAt: `2026-09-${String(10 + index).padStart(2, "0")}T20:00:00+02:00`,
      }),
    );

    expect(selectDetourHighlights(events, { limit: 4 })).toHaveLength(4);
    expect(selectDetourHighlights(events, { limit: 2 })).toHaveLength(2);
  });

  it("le score est la somme directe des reasons", () => {
    const ranked = rankDetourHighlightCandidates([
      event({
        id: "sum",
        title: "Spectacle avec Nina Leroy",
        category: "Spectacle",
        description: "Soirée avec Nina Leroy.".padEnd(90, "."),
        registrationUrl: "https://example.com/book",
        source: "Agenda",
        sourceUrl: "https://example.com/s",
        city: "Olivet",
        venue: "MJC",
      }),
    ]);

    const highlight = ranked.find((item) => item.event.id === "sum");
    expect(highlight).toBeDefined();
    const expected = highlight!.reasons.reduce(
      (sum, reason) => sum + HIGHLIGHT_WEIGHTS[reason],
      0,
    );
    expect(scoreOf(ranked, "sum")).toBe(expected);
  });

  describe("planningScore", () => {
    const now = new Date("2026-09-04T12:00:00+02:00");

    it("événement lointain sans booking => pas de planning bonus distant", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "far-no-book",
            title: "Spectacle avec Alice Moreau",
            category: "Spectacle",
            description: "Soirée avec Alice Moreau.",
            startAt: "2026-12-01T20:00:00+01:00",
          }),
        ],
        { now },
      );

      const item = ranked.find((h) => h.event.id === "far-no-book");
      expect(item).toBeDefined();
      expect(item!.reasons).toContain("headline-appeal");
      expect(item!.reasons).not.toContain("booking-available");
      // headline seul sans booking : pas de +1 headline/booking, pas de +1 distant
      expect(item!.planningScore).toBe(0);
    });

    it("événement lointain avec booking mais sans appeal => pas de bonus distant", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "far-book-only",
            title: "Atelier loisirs",
            category: "Loisirs",
            relevance: "culture_leisure",
            registrationUrl: "https://example.com/book",
            startAt: "2026-12-01T20:00:00+01:00",
          }),
        ],
        { now },
      );

      const item = ranked.find((h) => h.event.id === "far-book-only");
      expect(item).toBeDefined();
      expect(item!.reasons).not.toContain("headline-appeal");
      expect(item!.reasons).not.toContain("high-appeal");
      expect(item!.planningScore).toBe(0);
    });

    it("headline + booking => bonus", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "hb",
            title: "Spectacle avec Alice Moreau",
            category: "Spectacle",
            description: "Soirée avec Alice Moreau.",
            registrationUrl: "https://example.com/book",
            startAt: "2026-09-10T20:00:00+02:00",
          }),
        ],
        { now },
      );

      const item = ranked.find((h) => h.event.id === "hb");
      expect(item!.reasons).toContain("headline-appeal");
      expect(item!.reasons).toContain("booking-available");
      expect(item!.planningScore).toBeGreaterThanOrEqual(1);
    });

    it("singular + booking => bonus", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "sb",
            title: "Projection documentaire",
            category: "Cinéma",
            registrationUrl: "https://example.com/book",
            startAt: "2026-09-10T20:00:00+02:00",
            endAt: "2026-10-20T20:00:00+02:00",
            description: "Court.",
          }),
        ],
        { now },
      );

      const item = ranked.find((h) => h.event.id === "sb");
      expect(item!.reasons).toContain("singular");
      expect(item!.reasons).toContain("booking-available");
      expect(item!.planningScore).toBeGreaterThanOrEqual(1);
    });

    it("égalité de score principal départagée par planningScore", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "soon",
            title: "Spectacle avec Alice Moreau",
            category: "Spectacle",
            description: "Soirée avec Alice Moreau.".padEnd(90, "."),
            registrationUrl: "https://example.com/soon",
            source: "Agenda",
            sourceUrl: "https://example.com/s1",
            city: "Olivet",
            venue: "MJC",
            startAt: "2026-09-10T20:00:00+02:00",
          }),
          event({
            id: "later",
            title: "Spectacle avec Bruno Petit",
            category: "Spectacle",
            description: "Soirée avec Bruno Petit.".padEnd(90, "."),
            registrationUrl: "https://example.com/later",
            source: "Agenda",
            sourceUrl: "https://example.com/s2",
            city: "Olivet",
            venue: "MJC",
            startAt: "2026-12-01T20:00:00+01:00",
          }),
        ],
        { now },
      );

      expect(ranked[0]!.score).toBe(ranked[1]!.score);
      expect(ranked[0]!.event.id).toBe("later");
      expect(ranked[0]!.planningScore).toBeGreaterThan(ranked[1]!.planningScore);
    });

    it("date reste dernier tie-break", () => {
      const ranked = rankDetourHighlightCandidates(
        [
          event({
            id: "b",
            title: "Spectacle avec Alice Moreau",
            category: "Spectacle",
            description: "Soirée avec Alice Moreau.".padEnd(90, "."),
            registrationUrl: "https://example.com/b",
            source: "Agenda",
            sourceUrl: "https://example.com/sb",
            city: "Olivet",
            venue: "MJC",
            startAt: "2026-09-15T20:00:00+02:00",
          }),
          event({
            id: "a",
            title: "Spectacle avec Bruno Petit",
            category: "Spectacle",
            description: "Soirée avec Bruno Petit.".padEnd(90, "."),
            registrationUrl: "https://example.com/a",
            source: "Agenda",
            sourceUrl: "https://example.com/sa",
            city: "Olivet",
            venue: "MJC",
            startAt: "2026-09-10T20:00:00+02:00",
          }),
        ],
        { now },
      );

      expect(ranked[0]!.score).toBe(ranked[1]!.score);
      expect(ranked[0]!.planningScore).toBe(ranked[1]!.planningScore);
      expect(ranked[0]!.event.id).toBe("a");
    });
  });
});
