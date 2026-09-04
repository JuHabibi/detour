import { describe, expect, it } from "vitest";
import { classifyEventCategory } from "@/domain/classify-event-category";
import type { DetourEvent } from "@/domain/event";

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "title">,
): DetourEvent {
  return {
    id: partial.id ?? "test",
    title: partial.title,
    description: partial.description ?? null,
    imageUrl: null,
    startAt: partial.startAt ?? "2026-09-12T18:00:00+02:00",
    endAt: null,
    venue: partial.venue ?? null,
    city: partial.city ?? "Orléans",
    latitude: null,
    longitude: null,
    category: partial.category ?? null,
    genre: partial.genre ?? null,
    conditions: null,
    source: partial.source ?? null,
    sourceUrl: null,
    registrationUrl: null,
    relevance: partial.relevance,
  };
}

describe("classifyEventCategory", () => {
  it("Lapanty en Fête → Fête / salon / marché (structure > musique)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Lapanty en Fête",
          category: "Fête - salon - marché;Musique",
        }),
      ),
    ).toBe("Fête / salon / marché");
  });

  it("Forum des associations out_of_scope → Fête / salon / marché (pas Autre)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Forum des associations 2026",
          category: "Fête - salon - marché;Musique",
          description: "Animations musicales et stands",
          relevance: "out_of_scope",
        }),
      ),
    ).toBe("Fête / salon / marché");
  });

  it("Soutien Numérique out_of_scope → Atelier (pas Autre)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soutien Numérique Personnalisé",
          category: "Stage - atelier -  jeu",
          relevance: "out_of_scope",
        }),
      ),
    ).toBe("Atelier");
  });

  it("title musique + sourceCategory Fête → Fête / salon / marché", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Animations musicales du village",
          category: "Fête - salon - marché",
        }),
      ),
    ).toBe("Fête / salon / marché");
  });

  it("OpenAgenda category structurée Musique → Musique", () => {
    expect(
      classifyEventCategory(
        event({ title: "Duo Zéphyr", category: "Musique" }),
      ),
    ).toBe("Musique");
  });

  it("OpenAgenda category Spectacle → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({ title: "CANAILLE", category: "Spectacle" }),
      ),
    ).toBe("Spectacle");
  });

  it("Spectacle;Jeune public → Spectacle (structure, contenu > audience)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Spectacle familial",
          category: "Spectacle;Jeune public",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("Saran sans category, title concert → Musique", () => {
    expect(
      classifyEventCategory(
        event({ title: "Concert chorale locale", category: null }),
      ),
    ).toBe("Musique");
  });

  it('Exposition Saran, category null, title explicite → Exposition', () => {
    expect(
      classifyEventCategory(
        event({
          title: "Exposition - Un regard sur le vivant - Dominique de Joux",
          category: null,
        }),
      ),
    ).toBe("Exposition");
  });

  it("Histoires pour les petites oreilles → Jeune public", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Histoires pour les petites oreilles",
          venue: "Médiathèque",
          category: null,
        }),
      ),
    ).toBe("Jeune public");
  });

  it("Escape Game → Loisirs culturels", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Escape Game - Cyber enquête",
          venue: "Médiathèque",
          category: null,
        }),
      ),
    ).toBe("Loisirs culturels");
  });

  it("Conférence → Rencontre", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Conférence au musée",
          category: "Conférence - rencontre - débat",
        }),
      ),
    ).toBe("Rencontre");
  });

  it("Visite patrimoine → Visite", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Visite du patrimoine",
          description: "Balade guidée",
          category: null,
        }),
      ),
    ).toBe("Visite");
  });

  it("Atelier scrapbooking → Atelier", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Atelier scrapbooking",
          category: null,
        }),
      ),
    ).toBe("Atelier");
  });

  it("aucun signal clair → Autre", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Réunion de quartier",
          description: "Échanges locaux",
          category: null,
        }),
      ),
    ).toBe("Autre");
  });

  it("Concert jeune public → Musique (texte, contenu > audience)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Concert jeune public",
          category: null,
        }),
      ),
    ).toBe("Musique");
  });

  it("ne confond pas dansante avec danse", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Clôture de la Guinguette",
          description: "soirée dansante",
          category: null,
        }),
      ),
    ).toBe("Loisirs culturels");
  });

  it("jeu seul ne suffit pas pour Loisirs culturels", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Faites vos jeux !",
          description: "Des jeux pour tous les âges",
          category: null,
        }),
      ),
    ).toBe("Autre");
  });

  it("relevance n’influence jamais la category", () => {
    const base = {
      title: "Concert annulé",
      category: "Musique" as string | null,
    };
    expect(
      classifyEventCategory(
        event({ ...base, relevance: "out_of_scope" }),
      ),
    ).toBe("Musique");
    expect(
      classifyEventCategory(event({ ...base, relevance: "culture" })),
    ).toBe("Musique");
  });
});
