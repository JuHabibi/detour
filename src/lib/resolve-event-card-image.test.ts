import { describe, expect, it } from "vitest";
import {
  DETOUR_PLACEHOLDER,
  getEventFallbackImage,
  resolveEventCardImage,
} from "@/lib/resolve-event-card-image";

describe("getEventFallbackImage", () => {
  it("mappe le label de présentation Spectacle → placeholder spectacle", () => {
    expect(
      getEventFallbackImage({
        presentationLabel: "Spectacle",
        productCategory: "Spectacle",
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);
  });

  it("mappe Musique / Exposition depuis le label", () => {
    expect(
      getEventFallbackImage({
        presentationLabel: "Musique",
        productCategory: "Autre",
      }),
    ).toBe(DETOUR_PLACEHOLDER.concert);

    expect(
      getEventFallbackImage({
        presentationLabel: "Exposition",
        productCategory: "Autre",
      }),
    ).toBe(DETOUR_PLACEHOLDER.exposition);
  });

  it("priorité au label, puis catégorie produit, sinon découverte", () => {
    expect(
      getEventFallbackImage({
        presentationLabel: "Cinéma / Projection",
        productCategory: "Autre",
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);

    expect(
      getEventFallbackImage({
        presentationLabel: "Forum des associations",
        productCategory: "Spectacle",
      }),
    ).toBe(DETOUR_PLACEHOLDER.spectacle);

    expect(
      getEventFallbackImage({
        presentationLabel: "Forum des associations",
        productCategory: "Visite",
      }),
    ).toBe(DETOUR_PLACEHOLDER.decouverte);
  });
});

describe("resolveEventCardImage", () => {
  it("garde une image distante allowlistée + attribution (priorité sur le fallback)", () => {
    const resolved = resolveEventCardImage({
      presentationLabel: "Spectacle",
      productCategory: "Spectacle",
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

  it("image absente → placeholder selon le label de présentation", () => {
    expect(
      resolveEventCardImage({
        presentationLabel: "Spectacle",
        productCategory: "Spectacle",
        imageUrl: null,
      }).image,
    ).toBe(DETOUR_PLACEHOLDER.spectacle);
  });

  it("URL filtrée (Billetweb) → placeholder, sans attribution", () => {
    const resolved = resolveEventCardImage({
      presentationLabel: "Spectacle",
      productCategory: "Spectacle",
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
        presentationLabel: "Atelier",
        productCategory: "Atelier",
        imageUrl: "/images/fallbacks/culture.svg",
      }).image,
    ).toBe(DETOUR_PLACEHOLDER.decouverte);
  });
});
