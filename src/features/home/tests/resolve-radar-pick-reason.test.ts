import { describe, expect, it } from "vitest";
import type { EventItem } from "@/data/types";
import { resolveRadarPickReason } from "@/features/home/resolve-radar-pick-reason";

function radarItem(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "evt-1",
    title: "Concert local",
    category: "Musique",
    genre: "Concert",
    venue: "Salle municipale",
    city: "Orléans",
    date: "2026-11-12",
    dateLabel: "Jeudi 12 novembre",
    startAt: "2026-11-12T20:00:00+02:00",
    ...overrides,
  };
}

describe("resolveRadarPickReason", () => {
  it("publie une reason IA concrète et étayée par la fiche", () => {
    const reason = resolveRadarPickReason(
      radarItem({
        title: "Duo Zéphyr",
        description:
          "Concerts enregistrés pour la réalisation d’un CD live à la MJC.",
        radarAiReasons: [
          "Concerts enregistrés pour la réalisation d’un CD live.",
        ],
        radarSelectionReasons: ["high-appeal", "local-discovery"],
      }),
    );
    expect(reason).toBe(
      "Concerts enregistrés pour la réalisation d’un CD live.",
    );
  });

  it("publie une singularité de format étayée (théâtre de papier)", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          title: "Saison culturelle : La Fabrique",
          city: "Saint-Jean-de-Braye",
          description:
            "« La Fabrique », de la compagnie Sans soucis. Ce théâtre de papier et musique est à découvrir.",
          radarAiReasons: [
            "Théâtre de papier et musique présenté par la compagnie Sans soucis.",
          ],
        }),
      ),
    ).toBe(
      "Théâtre de papier et musique présenté par la compagnie Sans soucis.",
    );
  });

  it("rejette une reason IA non étayée par la fiche", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          title: "Concert de saison",
          description: "Un concert de la saison culturelle.",
          radarAiReasons: [
            "Performance qui transforme un loto en proposition chorégraphique.",
          ],
        }),
      ),
    ).toBeNull();
  });

  it("rejette ville / commune seule (justification pauvre)", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          city: "Saint-Jean-de-Braye",
          description: "Spectacle de la compagnie Sans soucis.",
          radarSelectionReasons: ["local-discovery", "high-appeal"],
          radarAiReasons: ["Programmé à Saint-Jean-de-Braye."],
        }),
      ),
    ).toBeNull();
  });

  it("rejette billetterie / inscription seule", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          registrationUrl: "https://book.example/event",
          radarSelectionReasons: ["booking-available"],
          radarAiReasons: ["Billetterie ou inscription disponible en ligne."],
        }),
      ),
    ).toBeNull();
  });

  it("rejette gratuité seule", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          conditions: "Gratuit",
          radarAiReasons: ["Entrée gratuite."],
          radarSelectionReasons: ["singular"],
        }),
      ),
    ).toBeNull();
  });

  it("ne crée pas de fallback générique sans reason IA ni override", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          id: "openagenda:unknown",
          city: "La Chapelle-Saint-Mesmin",
          venue: "Médiathèque",
          conditions: "Gratuit, sur inscription",
          registrationUrl: "https://example.com/resa",
          editorialBadge: "À réserver",
          radarSelectionReasons: [
            "local-discovery",
            "booking-available",
            "headline-appeal",
          ],
          radarSlot: "worth-planning",
          radarAiReasons: undefined,
        }),
      ),
    ).toBeNull();
  });

  it("applique les overrides manuels temporaires par id OpenAgenda", () => {
    expect(
      resolveRadarPickReason(
        radarItem({ id: "openagenda:36101666", radarAiReasons: undefined }),
      ),
    ).toBe(
      "Un spectacle où le papier prend vie en musique, porté par la compagnie Sans soucis.",
    );

    expect(
      resolveRadarPickReason(
        radarItem({ id: "openagenda:96155797", radarAiReasons: undefined }),
      ),
    ).toBe(
      "Quatre jours pour passer de l’autre côté de la caméra et s’essayer au cinéma d’horreur, entre improvisation, quiz et défis.",
    );

    expect(
      resolveRadarPickReason(
        radarItem({ id: "openagenda:56369478", radarAiReasons: undefined }),
      ),
    ).toBe(
      "Un voyage musical dans l’Amérique des années 20 et 30, entre ragtime, country blues et premiers accents du jazz, avec humour et groove.",
    );
  });

  it("ne force pas d’override sur Un monde en couleurs (encart masqué)", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          id: "openagenda:77305621",
          title: "Un monde en couleurs",
          description:
            'Exposition en lien avec le spectacle "Le magicien des couleurs"',
          radarAiReasons: undefined,
        }),
      ),
    ).toBeNull();
  });

  it("laisse une reason IA validée primer sur l’override manuel", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          id: "openagenda:36101666",
          title: "Saison culturelle : La Fabrique",
          description:
            "Ce théâtre de papier et musique est à découvrir. Concerts enregistrés pour un CD live.",
          radarAiReasons: [
            "Concerts enregistrés pour la réalisation d’un CD live.",
          ],
        }),
      ),
    ).toBe("Concerts enregistrés pour la réalisation d’un CD live.");
  });

  it("ignore relevanceReason machine", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          relevanceReason: "strong-category:spectacle",
          radarSelectionReasons: ["high-appeal"],
        }),
      ),
    ).toBeNull();
  });

  it("rejette une reason IA d’urgence inventée", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          description: "Concert enregistré pour un CD live.",
          radarAiReasons: ["Dernière chance, bientôt complet."],
        }),
      ),
    ).toBeNull();
  });

  it("n’invente pas d’urgence à partir d’une date proche", () => {
    expect(
      resolveRadarPickReason(
        radarItem({
          startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          dateLabel: "Demain",
          radarSelectionReasons: ["singular"],
        }),
      ),
    ).toBeNull();
  });
});
