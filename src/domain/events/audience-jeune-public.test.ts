import { describe, expect, it } from "vitest";
import {
  EXPLORER_AUDIENCE_JEUNE_PUBLIC,
  isJeunePublicAudience,
  sqlJeunePublicAudiencePredicate,
} from "@/domain/events/audience-jeune-public";

describe("isJeunePublicAudience — golden V1", () => {
  it("tag source seul Jeune public → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "Réveil livres de 0 à 3 ans",
        category: "Jeune public",
      }),
    ).toBe(true);
  });

  it("Spectacle;Jeune public (un compagnon) → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "BULLE",
        category: "Spectacle;Jeune public",
      }),
    ).toBe(true);
  });

  it("Spectacle « Jeune public, dès 6 ans » → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "Spectacle jeune public, dès 6 ans",
        category: "Spectacle",
      }),
    ).toBe(true);
  });

  it("Passerelle multi-tags sans cue jeunesse → non", () => {
    expect(
      isJeunePublicAudience({
        title: "La Passerelle - Inavouable",
        category:
          "Spectacle;Musique;Exposition;Conférence - rencontre - débat;Jeune public",
      }),
    ).toBe(false);
  });

  it("CINÉ-VACANCES → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "MIGRATION",
        category: "CINÉ-VACANCES",
      }),
    ).toBe(true);
  });

  it("petites oreilles sans tag → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "Histoires pour les petites oreilles",
        category: null,
      }),
    ).toBe(true);
  });

  it("familial seul → non", () => {
    expect(
      isJeunePublicAudience({
        title: "Audition en famille",
        category: "Musique",
      }),
    ).toBe(false);
  });

  it("conte seul dans titre artistique → non", () => {
    expect(
      isJeunePublicAudience({
        title: "La belle histoire de Sarah",
        category: null,
      }),
    ).toBe(false);
  });

  it("Scrapbooking Ados → oui (public ado explicite)", () => {
    expect(
      isJeunePublicAudience({
        title: "Scrapbooking Ados",
        category: "Stage - atelier -  jeu",
      }),
    ).toBe(true);
  });

  it("tarif enfant / −12 ans seul → non", () => {
    expect(
      isJeunePublicAudience({
        title: "Concert symphonique",
        description: "Plein tarif 24 € · Tarif -12 ans : 8 €",
        category: "Musique",
      }),
    ).toBe(false);
  });

  it("enfants générique seul → non", () => {
    expect(
      isJeunePublicAudience({
        title: "Maëlle + Lize",
        description: "Ouvert aux enfants accompagnés",
        category: "Spectacle / Concert",
      }),
    ).toBe(false);
  });

  it("tranche d’âge cible (6-8 ans) → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "Atelier fresque (6-8 ans)",
        category: "Stage - atelier -  jeu",
      }),
    ).toBe(true);
  });

  it("Atelier « Pour les 12–16 ans » → oui", () => {
    expect(
      isJeunePublicAudience({
        title: "Atelier écriture",
        description: "Pour les 12–16 ans",
        category: "Stage - atelier -  jeu",
      }),
    ).toBe(true);
  });

  it("Exposition historique « Dès 14 ans » seule → non", () => {
    expect(
      isJeunePublicAudience({
        title: "Une histoire du Front Populaire (1934–1938)",
        description:
          "Conférence historique sur la période du Front populaire. Dès 14 ans.",
        category: "Exposition",
      }),
    ).toBe(false);
  });

  it("« À partir de 12 ans » seul → non", () => {
    expect(
      isJeunePublicAudience({
        title: "Visite du musée",
        description: "À partir de 12 ans",
        category: "Balade - découverte - visite",
      }),
    ).toBe(false);
  });

  it("exporte le slug URL canonique", () => {
    expect(EXPLORER_AUDIENCE_JEUNE_PUBLIC).toBe("jeune_public");
  });

  it("sql predicate est non vide et référence alias e", () => {
    const sql = sqlJeunePublicAudiencePredicate("e");
    expect(sql).toContain("e.category");
    expect(sql).toContain("e.title");
    expect(sql).toContain("cine-vacances");
    expect(sql).toContain("jeune public");
    expect(sql).not.toContain("a partir de\\s+");
    // Garde-fou : mapping translate 1:1 (– → -), pas « 12o16 ».
    expect(sql).toContain("oo--  ");
  });
});
