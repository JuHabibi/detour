import { describe, expect, it } from "vitest";
import { classifyEventRelevance } from "@/domain/classify-event-relevance";
import type { DetourEvent } from "@/domain/event";

function event(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "title">,
): DetourEvent {
  return {
    id: partial.id ?? "test",
    title: partial.title,
    description: partial.description ?? null,
    imageUrl: partial.imageUrl ?? null,
    startAt: partial.startAt ?? "2026-09-12T18:00:00+02:00",
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
  };
}

describe("classifyEventRelevance", () => {
  it("classifie Hop Pop Hop comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "FESTIVAL HOP POP HOP, LE BEFORE",
        category: "Musique",
        description: "Festival de musiques actuelles",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("strong-category:musique");
  });

  it("classifie Histoire de la batterie dans le jazz comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Histoire de la batterie dans le jazz",
        category: "Conférence - rencontre - débat",
        description: "Une conférence autour du jazz et de la batterie",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toMatch(/^cultural-keyword:/);
  });

  it("classifie Projection Philharmonie : Cerrone comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Projection Philharmonie : Cerrone — Disco Symphonic",
        category: "Projection - cinéma",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("strong-category:projection-cinéma");
  });

  it("classifie Le jardinier de ces dames comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Le jardinier de ces dames - CINÉ-RENCONTRE aux Carmes",
        category: "Projection - cinéma",
      }),
    );
    expect(result.relevance).toBe("culture");
  });

  it("classifie Duo Zéphyr comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Duo Zéphyr",
        category: "Musique",
        description: "Jazz, folk et groove",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("strong-category:musique");
  });

  it("classifie CANAILLE comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "CANAILLE",
        category: "Spectacle",
        description: "Lecture théâtralisée",
      }),
    );
    expect(result.relevance).toBe("culture");
  });

  it("classifie Ateliers d'écriture créative comme culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Ateliers d'écriture créative",
        category: "Stage - atelier -  jeu",
        description: "Atelier d'écriture et de création littéraire",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toMatch(/^cultural-keyword:/);
  });

  it("classifie ZUMBA comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "ZUMBA",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toMatch(/^excluded-/);
  });

  it("classifie QI GONG SANTE comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "QI GONG SANTE",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
  });

  it("classifie Marche Nordique DOUCE comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "Marche Nordique DOUCE",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
  });

  it("classifie Free Fit comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "Free Fit",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
  });

  it("classifie Don de sang comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "Don de sang",
        category: "Solidarité",
        description: "Collecte de don de sang",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:don de sang");
  });

  it("classifie Soutien Numérique Personnalisé comme out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "Soutien Numérique Personnalisé",
        category: "Stage - atelier -  jeu",
        description: "Aide aux démarches numériques",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:soutien numérique");
  });

  it("priorise l'inscription annuelle face à une catégorie Musique", () => {
    const result = classifyEventRelevance(
      event({
        title: "Cours d'essai de piano",
        category: "Musique",
        description: "Cours d'essai puis inscription annuelle",
        conditions: "inscription annuelle",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("recurring-activity:inscription annuelle");
  });

  it("priorise atelier annuel face à un mot culturel théâtre", () => {
    const result = classifyEventRelevance(
      event({
        title: "ATELIERS THEATRE (Adultes & enfants à partir de 8 ans)",
        category: "Stage - atelier -  jeu",
        description: "Atelier annuel payant de théâtre",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("recurring-activity:atelier annuel");
  });

  it("ne rejette pas une saison culturelle de spectacles", () => {
    const result = classifyEventRelevance(
      event({
        title: "Ouverture de saison",
        category: "Spectacle",
        description: "Premier spectacle de la saison culturelle 2026-2027",
      }),
    );
    expect(result.relevance).toBe("culture");
  });

  it("laisse uncertain un atelier sans indice culturel", () => {
    const result = classifyEventRelevance(
      event({
        title: "Goûter, devoirs, jeux (parents/enfants de 6 à 11 ans)",
        category: "Stage - atelier -  jeu",
        description: "Temps d’accueil parents-enfants",
      }),
    );
    expect(result.relevance).toBe("uncertain");
    expect(result.reason).toBe("ambiguous-category");
  });

  it("laisse uncertain une conférence sans indice culturel", () => {
    const result = classifyEventRelevance(
      event({
        title: "Ateliers de conversation",
        category: "Conférence - rencontre - débat",
        description:
          "Votre langue maternelle n’est pas le français et vous souhaitez vous améliorer ?",
      }),
    );
    expect(result.relevance).toBe("uncertain");
    expect(result.reason).toBe("ambiguous-category");
  });

  it("exclut un forum des associations même catégorisé Musique", () => {
    const result = classifyEventRelevance(
      event({
        title: "Forum des associations 2026",
        category: "Fête - salon - marché;Musique",
        description: "Animations musicales et stands",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-event-type:associations-forum");
  });

  it("exclut un forum des associations catégorisé Sport avec reason forum", () => {
    const result = classifyEventRelevance(
      event({
        title: "Forum des associations",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-event-type:associations-forum");
  });

  it("n'attribue jamais culture à FORUM DES ASSOS à cause de expo", () => {
    const result = classifyEventRelevance(
      event({
        title: "FORUM DES ASSOS",
        category: "Fête - salon - marché",
        description: "Stands, expo et animations",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-event-type:associations-forum");
  });

  it("exclut YOGA NIDRA", () => {
    const result = classifyEventRelevance(
      event({
        title: "YOGA NIDRA",
        category: "Stage - atelier -  jeu",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:yoga");
  });

  it("exclut Hatha Yoga", () => {
    const result = classifyEventRelevance(
      event({
        title: "Animation - Séance d'Hatha Yoga",
        category: "Sport",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:yoga");
  });

  it("conserve une vraie exposition en culture", () => {
    const result = classifyEventRelevance(
      event({
        title: 'Exposition « Le Design coule de source »',
        category: "Exposition",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("strong-category:exposition");
  });

  it("conserve Ateliers initiation danses Trad en culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Ateliers initiation danses Trad",
        category: "Stage - atelier -  jeu",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("cultural-keyword:danse");
  });

  it("category spectacle → culture", () => {
    const result = classifyEventRelevance(
      event({ title: "Soirée", category: "Spectacle" }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("strong-category:spectacle");
  });

  it("category sport → out_of_scope", () => {
    const result = classifyEventRelevance(
      event({ title: "Match amical", category: "Sport" }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-category:sport");
  });

  it("conseil municipal → out_of_scope", () => {
    const result = classifyEventRelevance(
      event({
        title: "Conseil Municipal",
        venue: "Médiathèque",
        description: "Séance publique",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:conseil municipal");
  });

  it("PSC1 en MJC → out_of_scope (exclusion > lieu)", () => {
    const result = classifyEventRelevance(
      event({
        title: "Formation psc1 - croix blanche",
        venue: "MJC Jacques Prévert",
      }),
    );
    expect(result.relevance).toBe("out_of_scope");
    expect(result.reason).toBe("excluded-keyword:psc1");
  });

  it("title culturel évident → culture", () => {
    const result = classifyEventRelevance(
      event({ title: "Concert en plein air" }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toBe("cultural-keyword:concert");
  });

  it("aucun signal → uncertain", () => {
    const result = classifyEventRelevance(
      event({ title: "Réunion de quartier", description: "Échanges locaux" }),
    );
    expect(result.relevance).toBe("uncertain");
    expect(result.reason).toBe("no-signal");
  });

  it("lecture en médiathèque → culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Lecture du mardi",
        venue: "Médiathèque",
        description: "Temps de lecture partagée",
      }),
    );
    expect(result.relevance).toBe("culture");
    expect(result.reason).toMatch(/^cultural-/);
  });

  it("histoires pour les petites oreilles → culture", () => {
    const result = classifyEventRelevance(
      event({
        title: "Histoires pour les petites oreilles",
        venue: "Médiathèque",
      }),
    );
    expect(result.relevance).toBe("culture");
  });

  it("guinguette → culture_leisure", () => {
    const result = classifyEventRelevance(
      event({
        title: "Feu d'artifice et clôture de la Guinguette du Château",
        description: "Bar, restauration, soirée dansante",
      }),
    );
    expect(result.relevance).toBe("culture_leisure");
    expect(result.reason).toMatch(/^leisure-keyword:/);
  });

  it("scrapbooking → culture_leisure", () => {
    const result = classifyEventRelevance(
      event({
        title: "Scrapbooking - Maison des loisirs et de la culture",
        venue: "Annexes du château",
      }),
    );
    expect(result.relevance).toBe("culture_leisure");
    expect(result.reason).toBe("leisure-keyword:scrapbooking");
  });

  it("escape game en médiathèque → culture_leisure (loisir > lieu)", () => {
    const result = classifyEventRelevance(
      event({
        title: "Escape Game - Cyber enquête",
        venue: "Médiathèque",
      }),
    );
    expect(result.relevance).toBe("culture_leisure");
    expect(result.reason).toBe("leisure-keyword:escape game");
  });

  it("atelier seul → uncertain", () => {
    const result = classifyEventRelevance(
      event({
        title: "Atelier parents-enfants",
        category: "Stage - atelier -  jeu",
        description: "Temps d’accueil",
      }),
    );
    expect(result.relevance).toBe("uncertain");
  });
});
