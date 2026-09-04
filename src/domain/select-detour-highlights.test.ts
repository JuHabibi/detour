import { describe, expect, it } from "vitest";
import type { DetourEvent } from "@/domain/event";
import {
  HIGHLIGHT_WEIGHTS,
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

describe("selectDetourHighlights", () => {
  it("détecte high-appeal via combinaison de signaux", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "appeal",
        title: "Concert au Théâtre",
        category: "Musique",
        description:
          "Une soirée musicale rare avec un programme soigné et une salle intimiste.",
        registrationUrl: "https://example.com/book",
        source: "Agenda culturel Orléans",
        sourceUrl: "https://example.com/source",
      }),
    ]);

    expect(reasonsOf(highlights, "appeal")).toContain("high-appeal");
  });

  it("détecte local-discovery via structure locale hors Orléans", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "local",
        title: "Lecture poétique",
        category: "Littérature",
        venue: "Médiathèque municipale",
        city: "Olivet",
        description: "Une rencontre littéraire autour de la poésie contemporaine.",
      }),
    ]);

    expect(reasonsOf(highlights, "local")).toContain("local-discovery");
  });

  it("détecte singular pour un spectacle ponctuel", () => {
    const highlights = selectDetourHighlights([
      event({
        id: "singular",
        title: "Spectacle de danse",
        category: "Spectacle vivant",
      }),
    ]);

    expect(reasonsOf(highlights, "singular")).toContain("singular");
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

  it("assure la diversité de profils quand plusieurs reasons existent", () => {
    const highlights = selectDetourHighlights(
      [
        event({
          id: "a1",
          title: "Concert A",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/a",
          source: "Scène nationale",
          sourceUrl: "https://example.com/source-a",
          city: "Orléans",
        }),
        event({
          id: "a2",
          title: "Concert B",
          category: "Musique",
          description: "x".repeat(90),
          registrationUrl: "https://example.com/b",
          source: "Scène nationale",
          sourceUrl: "https://example.com/source-b",
          city: "Orléans",
          startAt: "2026-09-13T20:00:00+02:00",
        }),
        event({
          id: "local",
          title: "Expo photo",
          category: "Exposition",
          venue: "Musée",
          city: "Saint-Jean-de-Braye",
          source: "Musée municipal",
        }),
        event({
          id: "sing",
          title: "Projection documentaire",
          category: "Cinéma / projection",
          city: "Orléans",
          // Pas de high-appeal support hors forme (multi-jours longs)
          endAt: "2026-10-20T20:00:00+02:00",
          description: "Court.",
        }),
        event({
          id: "filler",
          title: "Atelier loisirs",
          category: "Loisirs",
          relevance: "culture_leisure",
          registrationUrl: "https://example.com/filler",
        }),
      ],
      { limit: 4 },
    );

    const ids = highlights.map((item) => item.event.id);
    expect(highlights).toHaveLength(4);
    expect(ids[0]).toBe("a1"); // meilleur high-appeal
    expect(ids).toContain("local"); // slot local-discovery
    expect(ids).toContain("sing"); // slot singular (sans high-appeal)
    expect(new Set(ids).size).toBe(4);
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

  it("complète avec les meilleurs scores si une reason manque", () => {
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

    // Aucun local-discovery dans ce set → fallback sur scores.
    expect(highlights).toHaveLength(3);
    expect(highlights.every((item) => item.reasons.includes("high-appeal"))).toBe(
      true,
    );
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
});
