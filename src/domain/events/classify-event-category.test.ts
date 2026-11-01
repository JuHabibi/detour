import { describe, expect, it } from "vitest";
import { classifyEventCategory } from "@/domain/events/classify-event-category";
import type { DetourEvent } from "@/domain/events/event";

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

  // --- PR-A : concerts misclassés Spectacle → Musique (golden audit) ---

  it("Spectacle / Concert + performance musicale → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Voyage musical",
          description: "Concert de musique classique",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Musique");
  });

  it("Spectacle / Concert au Théâtre (venue) → Musique si concert", () => {
    expect(
      classifyEventCategory(
        event({
          title: 'Concert "FLUTE !"',
          description: "Voyage musical sous le signe de la flûte",
          venue: "Théâtre d'Orléans",
          category: "Musique;Spectacle",
        }),
      ),
    ).toBe("Musique");
  });

  it("Spectacle / Concert théâtre étudiant → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Restitution de l'UEOT Théâtre",
          description: "Actions avec le Centre Dramatique National",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("Spectacle / Concert Cie théâtre → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: '"Je n\'ai jamais" - Cie Les Tubercules',
          description: "Cinq étudiant.e.s se retrouvent pour une dernière soirée",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("seul-en-scène humoristique (Yaourt) reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: 'Thomas Poitevin - "Yaourt"',
          description:
            "C’est un seul-en-scène très peuplé ! Le résultat est souvent chaotique, un peu gênant et surtout très drôle.",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("cabaret radiophonique reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "La guerre des ondes",
          description:
            "Cabaret radiophonique freak d’Halloween, pièce radiophonique inspirée de Wells",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("conte / performance hybride reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Quand on dort on n'a pas faim",
          description:
            "Conte médiéval afro queer mêlant danse, chant, performance et archives",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("Radio-Crochet (performance chantée) → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Radio-Crochet de St-Marceau - Présélections",
          description: "Les inscriptions pour les présélections sont ouvertes.",
          category: "Musique;Spectacle",
        }),
      ),
    ).toBe("Musique");
  });

  it("bio « vient du théâtre » ne bloque pas un concert", () => {
    expect(
      classifyEventCategory(
        event({
          title: "lynx irl + Golimar",
          description: "Mathis vient du théâtre. Concert de rap et bass music.",
          category: "Spectacle / Concert",
        }),
      ),
    ).toBe("Musique");
  });

  it("danseurs + musiciens hybride reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Petite Musique Intérieure Brute",
          description:
            "Une vingtaine de danseurs et de musiciens conjuguent leurs talents",
          category: "Musique;Spectacle",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("spectacle théâtral sur la chanson → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Tout le monde écrit des chansons",
          description:
            "Ce spectacle propose une plongée ludique et théâtrale dans la composition",
          category: "Spectacle;Musique",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("Musique;Spectacle + concert primaire → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Duo jazz",
          description: "Concert intimiste",
          category: "Musique;Spectacle",
        }),
      ),
    ).toBe("Musique");
  });

  it("Spectacle;Musique + orchestre → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Orchestre de chambre",
          description: "Programme romantique",
          category: "Spectacle;Musique",
        }),
      ),
    ).toBe("Musique");
  });

  it("Spectacle;Musique sans signal concert fiable → Spectacle (CHUT !)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "CHUT !",
          description:
            "Un chanteur sachant chanter sans chanter est un bon chanteur !",
          category: "Spectacle;Musique",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("impro + concerts hybride reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soirée impro",
          description: "Théâtre d'impro et concerts",
          category: "Musique;Spectacle",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("comédie musicale reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "West Side Story",
          description: "Comédie musicale",
          category: "Spectacle",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("Passerelle multi-tags sans override → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Festival Passerelle",
          description: "Concerts et ateliers",
          category: "Spectacle;Musique;Atelier;Conférence",
        }),
      ),
    ).toBe("Spectacle");
  });

  // --- PR-B : Cinéma (golden audit) ---

  it("Projection - cinéma → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "PROJECTION : Marc Bloch",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("Cinéma / Projection → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: '"Navalny" de Daniel Roher',
          category: "Cinéma / Projection",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("CINÉ-VACANCES → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "LE ROBOT SAUVAGE",
          category: "CINÉ-VACANCES",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("Ciné-séniors (texte) → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Ciné-séniors",
          description: "Projection de film. Gratuit, entrée libre.",
          category: null,
        }),
      ),
    ).toBe("Cinéma");
  });

  it("séance cinéma mal taguée Spectacle → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Séance cinéma : film d’animation",
          category: "Spectacle",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("atelier + projection reste Atelier", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Jeu indé en mode ciné ! Overcooked! 2",
          category: "Stage - atelier -  jeu;Projection - cinéma",
        }),
      ),
    ).toBe("Atelier");
  });

  it("stage histoire du cinéma reste Atelier", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Stage 7-10 ans : Une histoire du cinéma",
          category: "Stage - atelier -  jeu;Jeune public",
        }),
      ),
    ).toBe("Atelier");
  });

  it("conférence sur le cinéma reste Rencontre", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Le procès de Jeanne d'Arc au cinéma",
          category: "Balade - découverte - visite;Conférence - rencontre - débat",
        }),
      ),
    ).toBe("Rencontre");
  });

  it("spectacle vivant mentionnant le cinéma d'action reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Machine à spectacle - SOLÈNE WACHTER",
          description:
            "Chorégraphie inspirée du cinéma d'action, cascade et illusion.",
          category: "Spectacle",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("venue piscine ne déclenche pas Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Prix de la Ville de Saran - USM Saran Cyclisme",
          description: "Remise des prix",
          venue: "Piscine de Saran",
          category: null,
        }),
      ),
    ).toBe("Autre");
  });

  it("Stage;Projection avec stage principal → Atelier", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Jeu indé en mode ciné ! Overcooked! 2",
          category: "Stage - atelier -  jeu;Projection - cinéma",
        }),
      ),
    ).toBe("Atelier");
  });

  it("exposition Desbordes (tags Exposition+Projection) → Exposition", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Dans l'atelier de Michèle Desbordes",
          description:
            "Journée autour de l'écrivaine : exposition, lectures et échanges",
          category:
            "Exposition;Projection - cinéma;Conférence - rencontre - débat",
        }),
      ),
    ).toBe("Exposition");
  });

  it("captation d'opéra projetée (Platée) → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Micro-folie projection : Platée de Jean-Baptiste Rameau",
          description:
            "Projection d’un opéra, en partenariat avec l’Opéra national de Paris.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("festival de films de voyage → Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Festival des Bouts du Monde",
          description:
            "Festival de films de voyage, en présence des réalisateurs.",
          category: "Conférence - rencontre - débat;Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("agnostique adapter : mêmes tags Bouillon / OpenAgenda → Cinéma", () => {
    const payload = {
      title: '"Navalny" de Daniel Roher',
      category: "Cinéma / Projection",
    };
    expect(classifyEventCategory(event({ ...payload, source: "bouillon" }))).toBe(
      "Cinéma",
    );
    expect(
      classifyEventCategory(event({ ...payload, source: "openagenda" })),
    ).toBe("Cinéma");
  });

  it("« captation » seule ne force pas Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soirée documentaire",
          description: "Captation disponible en ligne après la séance.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("conférence mentionnant le cinéma reste Rencontre", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Conférence : une histoire du cinéma militant",
          description: "Échanges autour d’images d’archives et de documentaires.",
          category: "Conférence - rencontre - débat",
        }),
      ),
    ).toBe("Rencontre");
  });

  it("spectacle mentionnant un documentaire reste Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Lecture scénique",
          description:
            "Une création librement inspirée d’un documentaire récent.",
          category: "Spectacle",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("captation d’opéra (sans mot projection) → Spectacle", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soirée lyrique",
          description: "Captation de l’opéra Platée diffusée sur grand écran.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Spectacle");
  });

  it("balade sonore + projection secondaire → Visite", () => {
    expect(
      classifyEventCategory(
        event({
          title: "PARCOURS SONORE DANS LE QUARTIER DE LA SOURCE",
          description:
            "Portrait sonore du quartier : témoignages et créations sonores.",
          category: "Balade - découverte - visite;Projection - cinéma",
        }),
      ),
    ).toBe("Visite");
  });

  it("locution « projections de concerts » → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soirée écran : concert enregistré",
          description:
            "Les projections de concerts de la saison reviennent à la médiathèque.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Musique");
  });

  it("captation de concert / concert filmé → Musique", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Soirée musique live à l’écran",
          description: "Captation de concert diffusée en salle.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Musique");
    expect(
      classifyEventCategory(
        event({
          title: "Récital à l’écran",
          description: "Un récital filmé présenté en séance unique.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Musique");
  });

  it("titre « Projection … » + concert sans locution liée reste Cinéma (ambigu)", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Projection Philharmonie de Paris - Respect to Aretha",
          description:
            "Après un septembre disco, un novembre soul avec un concert en hommage à Aretha Franklin.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("mention isolée de concert dans un film reste Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: '"Bohemian Rhapsody"',
          description:
            "Film biographique. Une scène de concert mythique au Live Aid.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });

  it("film sur la musique / un concert reste Cinéma", () => {
    expect(
      classifyEventCategory(
        event({
          title: "Documentaire musical",
          description:
            "Portrait d’un orchestre ; le film suit une tournée et un concert final.",
          category: "Projection - cinéma",
        }),
      ),
    ).toBe("Cinéma");
  });
});
