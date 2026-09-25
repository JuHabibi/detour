import { describe, expect, it } from "vitest";
import {
  DETOUR_PLACEHOLDER,
  getEventFallbackImage,
  resolveEventCardImage,
} from "@/lib/resolve-event-card-image";

describe("getEventFallbackImage", () => {
  it("concert via title / category / genre", () => {
    expect(
      getEventFallbackImage({
        title: "Soirée live au parc",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);

    expect(
      getEventFallbackImage({
        title: "Atelier",
        category: "Musique",
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);

    expect(
      getEventFallbackImage({
        title: "Répétition",
        category: null,
        genre: "Chorale",
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);

    expect(
      getEventFallbackImage({
        title: "Apéro-concert estival",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);
  });

  it("spectacle via théâtre / humour / cirque (accents normalisés)", () => {
    expect(
      getEventFallbackImage({
        title: "Pièce de théâtre",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);

    expect(
      getEventFallbackImage({
        title: "One man show",
        category: "Humour",
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);

    expect(
      getEventFallbackImage({
        title: "Sur scène",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);
  });

  it("exposition via expo / photo / galerie", () => {
    expect(
      getEventFallbackImage({
        title: "Vernissage",
        category: "Exposition",
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.exposition);

    expect(
      getEventFallbackImage({
        title: "Salon photo",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.exposition);

    expect(
      getEventFallbackImage({
        title: "Ouverture galerie",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.exposition);
  });

  it("défaut découverte si aucun signal", () => {
    expect(
      getEventFallbackImage({
        title: "Forum des associations",
        category: "Fête - salon - marché",
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.decouverte);
  });

  it("priorité concert si plusieurs signaux", () => {
    expect(
      getEventFallbackImage({
        title: "Concert et spectacle",
        category: null,
        genre: null,
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);
  });
});

describe("resolveEventCardImage", () => {
  it("garde une image distante allowlistée + attribution", () => {
    const resolved = resolveEventCardImage({
      title: "Concert",
      category: "Musique",
      genre: null,
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/x.jpg",
      imageCredit: "Jane Doe",
      imageLicense: "CC BY-SA 4.0",
      imageSourceUrl: "https://commons.wikimedia.org/wiki/File:X.jpg",
    });

    expect(resolved.image).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/x.jpg",
    );
    expect(resolved.imageCredit).toBe("Jane Doe");
    expect(resolved.imageLicense).toBe("CC BY-SA 4.0");
    expect(resolved.imageSourceUrl).toBe(
      "https://commons.wikimedia.org/wiki/File:X.jpg",
    );
  });

  it("image absente → placeholder selon signaux", () => {
    expect(
      resolveEventCardImage({
        title: "Concert jazz",
        category: null,
        genre: null,
        imageUrl: null,
      }).image,
    ).toBe(DETOUR_PLACEHOLDER.concert);
  });

  it("URL filtrée (Billetweb) → placeholder, sans attribution", () => {
    const resolved = resolveEventCardImage({
      title: "Spectacle de cirque",
      category: null,
      genre: null,
      imageUrl: "https://www.billetweb.fr/files/event/150/1437112.jpg",
      imageCredit: "should-not-leak",
      imageLicense: "CC BY",
      imageSourceUrl: "https://www.billetweb.fr/x",
    });

    expect(resolved.image).toBe(DETOUR_PLACEHOLDER.spectacle);
    expect(resolved.imageCredit).toBeUndefined();
    expect(resolved.imageLicense).toBeUndefined();
    expect(resolved.imageSourceUrl).toBeUndefined();
  });

  it("fallback sync culture.svg → remplacé par placeholder Détour", () => {
    expect(
      resolveEventCardImage({
        title: "Atelier cuisine",
        category: null,
        genre: null,
        imageUrl: "/images/fallbacks/culture.svg",
      }).image,
    ).toBe(DETOUR_PLACEHOLDER.decouverte);
  });
});
