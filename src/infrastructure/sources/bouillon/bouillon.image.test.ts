import { describe, expect, it, vi } from "vitest";
import { enrichBouillonEventImage } from "./bouillon.image";
import { resolveBouillonCategoryFallback } from "./bouillon.category-fallback";
import { extractBouillonTitleCandidates } from "./bouillon.title-candidates";
import {
  normalizeReusableLicense,
  searchExactWikidataEntities,
  lookupWikimediaImageForCandidates,
} from "./bouillon.wikimedia";
import type { DetourEvent } from "@/domain/events/event";
import { WIKIDATA_API, COMMONS_API } from "./bouillon.wikimedia";

function eventStub(partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">): DetourEvent {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description ?? null,
    imageUrl: partial.imageUrl ?? null,
    imageCredit: partial.imageCredit ?? null,
    imageLicense: partial.imageLicense ?? null,
    imageSourceUrl: partial.imageSourceUrl ?? null,
    startAt: partial.startAt ?? "2026-09-17T20:30:00Z",
    endAt: partial.endAt ?? null,
    venue: partial.venue ?? "Le Bouillon",
    city: partial.city ?? "Orléans",
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    category: partial.category ?? "Spectacle / Concert",
    genre: partial.genre ?? null,
    conditions: partial.conditions ?? null,
    source: partial.source ?? "Université d'Orléans / Le Bouillon",
    sourceUrl: partial.sourceUrl ?? null,
    registrationUrl: partial.registrationUrl ?? null,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("extractBouillonTitleCandidates", () => {
  it("split multi-artistes Mona Guba + Imparfait", () => {
    expect(extractBouillonTitleCandidates("Mona Guba + Imparfait")).toEqual([
      "Mona Guba",
      "Imparfait",
    ]);
  });

  it("extrait l’œuvre entre guillemets", () => {
    expect(
      extractBouillonTitleCandidates(
        '"Jesus Christ Superstar" de Norman Jewison',
      ),
    ).toEqual(["Jesus Christ Superstar"]);
  });
});

describe("normalizeReusableLicense", () => {
  it("accepte CC0 / PD / CC BY / CC BY-SA", () => {
    expect(normalizeReusableLicense("CC0")).toBe("CC0");
    expect(normalizeReusableLicense("Public domain")).toBe("Public Domain");
    expect(normalizeReusableLicense("CC BY 4.0")).toBe("CC BY 4.0");
    expect(normalizeReusableLicense("CC BY-SA 4.0")).toBe("CC BY-SA 4.0");
  });

  it("refuse NC / ND / fair use / absente", () => {
    expect(normalizeReusableLicense("CC BY-NC 4.0")).toBeNull();
    expect(normalizeReusableLicense("CC BY-ND 3.0")).toBeNull();
    expect(normalizeReusableLicense("Fair use")).toBeNull();
    expect(normalizeReusableLicense(null)).toBeNull();
    expect(normalizeReusableLicense("")).toBeNull();
  });
});

describe("resolveBouillonCategoryFallback", () => {
  it("cinéma → slug cinema + path générique tant que l’asset n’existe pas", () => {
    const fallback = resolveBouillonCategoryFallback({
      category: "Cinéma",
      title: "Film",
    });
    expect(fallback.slug).toBe("cinema");
    expect(fallback.imageUrl).toBe("/images/fallbacks/culture.svg");
  });

  it("concert → slug concert", () => {
    expect(
      resolveBouillonCategoryFallback({
        category: "Spectacle / Concert",
      }).slug,
    ).toBe("concert");
  });
});

describe("wikimedia matching + enrichBouillonEventImage", () => {
  it("artiste avec image Commons réutilisable → image + crédit + licence + source", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith(WIKIDATA_API) && url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [
            { id: "Q1", label: "Mona Guba", aliases: [] },
            { id: "Q99", label: "Mona Guba (autre)", aliases: [] },
          ],
        });
      }
      if (url.startsWith(WIKIDATA_API) && url.includes("wbgetentities")) {
        return jsonResponse({
          entities: {
            Q1: {
              claims: {
                P18: [
                  {
                    mainsnak: {
                      datavalue: { value: "Mona_Guba.jpg" },
                    },
                  },
                ],
              },
            },
          },
        });
      }
      if (url.startsWith(COMMONS_API)) {
        return jsonResponse({
          query: {
            pages: {
              "1": {
                imageinfo: [
                  {
                    url: "https://upload.wikimedia.org/wikipedia/commons/m/mona.jpg",
                    thumburl:
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/m/mona.jpg/1280px-mona.jpg",
                    descriptionurl:
                      "https://commons.wikimedia.org/wiki/File:Mona_Guba.jpg",
                    extmetadata: {
                      LicenseShortName: { value: "CC BY-SA 4.0" },
                      Artist: { value: "<a href=\"https://example.com\">Jane Doe</a>" },
                    },
                  },
                ],
              },
            },
          },
        });
      }
      return jsonResponse({}, 404);
    });

    const exact = await searchExactWikidataEntities("Mona Guba", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(exact).toHaveLength(1);
    expect(exact[0]?.id).toBe("Q1");

    const enriched = await enrichBouillonEventImage(
      eventStub({
        id: "bouillon:1",
        title: "Mona Guba + Imparfait",
        category: "Spectacle / Concert",
      }),
      { fetchImpl, httpTimeoutMs: 5_000 },
    );

    expect(enriched.imageUrl).toContain("upload.wikimedia.org");
    expect(enriched.imageLicense).toBe("CC BY-SA 4.0");
    expect(enriched.imageCredit).toBe("Jane Doe");
    expect(enriched.imageSourceUrl).toBe(
      "https://commons.wikimedia.org/wiki/File:Mona_Guba.jpg",
    );
    expect(enriched.title).toBe("Mona Guba + Imparfait");
    expect(enriched.venue).toBe("Le Bouillon");
  });

  it("artiste introuvable → fallback catégorie", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ search: [] }));
    const enriched = await enrichBouillonEventImage(
      eventStub({
        id: "bouillon:2",
        title: "Groupe Inconnu XYZ",
        category: "Spectacle / Concert",
      }),
      { fetchImpl, httpTimeoutMs: 5_000 },
    );
    expect(enriched.imageUrl).toBe("/images/fallbacks/culture.svg");
    expect(enriched.imageCredit).toBeNull();
    expect(enriched.imageLicense).toBeNull();
    expect(enriched.imageSourceUrl).toBeNull();
  });

  it("résultat ambigu (plusieurs exact match) → fallback catégorie", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [
            { id: "Q1", label: "Imparfait", aliases: [] },
            { id: "Q2", label: "Imparfait", aliases: ["Imparfait"] },
          ],
        });
      }
      return jsonResponse({ search: [] });
    });

    const enriched = await enrichBouillonEventImage(
      eventStub({ id: "bouillon:3", title: "Imparfait" }),
      { fetchImpl, httpTimeoutMs: 5_000 },
    );
    expect(enriched.imageUrl).toBe("/images/fallbacks/culture.svg");
  });

  it("licence non compatible → fallback catégorie", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [{ id: "Q1", label: "Copycat", aliases: [] }],
        });
      }
      if (url.includes("wbgetentities")) {
        return jsonResponse({
          entities: {
            Q1: {
              claims: {
                P18: [{ mainsnak: { datavalue: { value: "Copycat.jpg" } } }],
              },
            },
          },
        });
      }
      if (url.startsWith(COMMONS_API)) {
        return jsonResponse({
          query: {
            pages: {
              "1": {
                imageinfo: [
                  {
                    url: "https://upload.wikimedia.org/wikipedia/commons/c.jpg",
                    descriptionurl:
                      "https://commons.wikimedia.org/wiki/File:Copycat.jpg",
                    extmetadata: {
                      LicenseShortName: { value: "CC BY-NC 4.0" },
                      Artist: { value: "Someone" },
                    },
                  },
                ],
              },
            },
          },
        });
      }
      return jsonResponse({}, 404);
    });

    const hit = await lookupWikimediaImageForCandidates(["Copycat"], {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(hit).toBeNull();

    const enriched = await enrichBouillonEventImage(
      eventStub({ id: "bouillon:4", title: "Copycat" }),
      { fetchImpl, httpTimeoutMs: 5_000 },
    );
    expect(enriched.imageUrl).toBe("/images/fallbacks/culture.svg");
  });

  it("erreur réseau Wikimedia → fallback catégorie", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const enriched = await enrichBouillonEventImage(
      eventStub({
        id: "bouillon:5",
        title: "Mona Guba",
        category: "Cinéma",
      }),
      { fetchImpl, httpTimeoutMs: 5_000 },
    );
    expect(enriched.imageUrl).toBe("/images/fallbacks/culture.svg");
    expect(enriched.imageLicense).toBeNull();
  });
});
