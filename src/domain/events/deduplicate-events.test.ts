import { describe, expect, it } from "vitest";
import { deduplicateEvents } from "@/domain/events/deduplicate-events";
import type { DetourEvent } from "@/domain/events/event";

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description ?? null,
    imageUrl: partial.imageUrl ?? null,
    startAt: partial.startAt ?? "2026-09-12T18:00:00+02:00",
    endAt: partial.endAt ?? null,
    venue: partial.venue ?? "Scène nationale",
    city: partial.city ?? "Orléans",
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    category: partial.category ?? "Musique",
    genre: partial.genre ?? null,
    conditions: partial.conditions ?? null,
    source: partial.source ?? null,
    sourceUrl: partial.sourceUrl ?? null,
    registrationUrl: partial.registrationUrl ?? null,
  };
}

describe("deduplicateEvents", () => {
  it("rapproche les variantes Hop Pop Hop", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "HOP POP HOP",
        startAt: "2026-09-20T20:00:00+02:00",
        venue: "Place de Loire",
        city: "Orléans",
      }),
      event({
        id: "b",
        title: "Hop Pop Hop 2026",
        startAt: "2026-09-20T20:00:00+02:00",
        venue: "Place de Loire",
        city: "Orléans",
        imageUrl: "https://example.com/img.jpg",
      }),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].reason).toBe("same-time-place-similar-title");
    expect(result.events[0].id).toBe("b");
  });

  it("rapproche les variantes Histoire de la batterie dans le jazz", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Histoire de la batterie dans le jazz",
        startAt: "2026-10-11T15:00:00+02:00",
        venue: "Médiathèque",
        city: "Orléans",
      }),
      event({
        id: "b",
        title: "Culture jazz - Histoire de la batterie dans le jazz",
        startAt: "2026-10-11T15:00:00+02:00",
        venue: "Médiathèque",
        city: "Orléans",
      }),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.duplicates[0].reason).toBe("same-time-place-similar-title");
  });

  it("ne fusionne pas le même titre à des dates différentes", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Duo Zéphyr",
        startAt: "2026-09-10T20:00:00+02:00",
      }),
      event({
        id: "b",
        title: "Duo Zéphyr",
        startAt: "2026-09-17T20:00:00+02:00",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("ne fusionne pas le même titre et la même date à des lieux différents", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Concert jazz",
        startAt: "2026-09-12T20:00:00+02:00",
        venue: "Astrolabe",
        city: "Orléans",
      }),
      event({
        id: "b",
        title: "Concert jazz",
        startAt: "2026-09-12T20:00:00+02:00",
        venue: "Théâtre d'Orléans",
        city: "Orléans",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("ne fusionne pas des titres vaguement ressemblants", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Festival de jazz",
        startAt: "2026-09-12T20:00:00+02:00",
        venue: "Place de Loire",
        city: "Orléans",
      }),
      event({
        id: "b",
        title: "Soirée jazz au bord de Loire",
        startAt: "2026-09-12T20:00:00+02:00",
        venue: "Place de Loire",
        city: "Orléans",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("ne fusionne pas une même registrationUrl à des dates différentes", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Atelier A",
        startAt: "2026-09-12T10:00:00+02:00",
        registrationUrl: "https://example.com/reserve",
      }),
      event({
        id: "b",
        title: "Atelier B",
        startAt: "2026-09-19T10:00:00+02:00",
        registrationUrl: "https://example.com/reserve",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("ne fusionne pas une même registrationUrl si les titres diffèrent", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Journées Européennes du Patrimoine — Visite A",
        startAt: "2026-09-20T10:00:00+02:00",
        registrationUrl: "https://example.com/jep",
      }),
      event({
        id: "b",
        title: "Journées Européennes du Patrimoine — Visite B",
        startAt: "2026-09-20T10:00:00+02:00",
        registrationUrl: "https://example.com/jep",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("détecte une même registrationUrl seulement si les titres sont très proches", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "HOP POP HOP",
        startAt: "2026-09-12T10:00:00+02:00",
        registrationUrl: "https://example.com/reserve",
      }),
      event({
        id: "b",
        title: "Hop Pop Hop 2026",
        startAt: "2026-09-12T10:00:00+02:00",
        registrationUrl: "https://example.com/reserve",
        description: "Détails",
        imageUrl: "https://example.com/img.jpg",
      }),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].reason).toBe("same-registration-url");
    expect(result.events[0].id).toBe("b");
  });

  it("ne fusionne pas une exposition et sa visite flash associée", () => {
    const result = deduplicateEvents([
      event({
        id: "a",
        title: "Exposition « Le Design coule de source »",
        startAt: "2026-09-20T14:00:00+02:00",
        venue: "Muséum",
        city: "Orléans",
        category: "Exposition",
      }),
      event({
        id: "b",
        title: "Visites flash / Exposition « Le Design coule de source »",
        startAt: "2026-09-20T14:00:00+02:00",
        venue: "Muséum",
        city: "Orléans",
        category: "Balade - découverte - visite",
      }),
    ]);

    expect(result.events).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });
});
