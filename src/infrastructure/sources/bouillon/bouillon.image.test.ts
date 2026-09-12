import { describe, expect, it, vi } from "vitest";
import { enrichBouillonEventImage } from "./bouillon.image";
import { resolveBouillonCategoryFallback } from "./bouillon.category-fallback";
import { extractBouillonTitleCandidates } from "./bouillon.title-candidates";
import {
  normalizeReusableLicense,
  searchExactWikidataEntities,
  lookupWikimediaImageForCandidates,
  hasCompatibleWikidataP31,
  licenseRequiresCredit,
  fetchCommonsImageAttribution,
  WIKIDATA_API,
  COMMONS_API,
} from "./bouillon.wikimedia";
import type { DetourEvent } from "@/domain/events/event";

function eventStub(
  partial: Partial<DetourEvent> & Pick<DetourEvent, "id" | "title">,
): DetourEvent {
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

function p31(id: string) {
  return {
    mainsnak: {
      datavalue: { value: { id } },
    },
  };
}

function p18(filename: string) {
  return {
    mainsnak: {
      datavalue: { value: filename },
    },
  };
}

function commonsPage(params: {
  license: string;
  artist?: string;
  credit?: string;
  attribution?: string;
}) {
  const extmetadata: Record<string, { value: string }> = {
    LicenseShortName: { value: params.license },
  };
  if (params.artist) extmetadata.Artist = { value: params.artist };
  if (params.credit) extmetadata.Credit = { value: params.credit };
  if (params.attribution) extmetadata.Attribution = { value: params.attribution };

  return {
    query: {
      pages: {
        "1": {
          imageinfo: [
            {
              url: "https://upload.wikimedia.org/wikipedia/commons/x.jpg",
              thumburl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/x.jpg/1280px-x.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:X.jpg",
              extmetadata,
            },
          ],
        },
      },
    },
  };
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

describe("hasCompatibleWikidataP31", () => {
  it("accepte humain / groupe musical / film", () => {
    expect(hasCompatibleWikidataP31(["Q5"])).toBe(true);
    expect(hasCompatibleWikidataP31(["Q215380"])).toBe(true);
    expect(hasCompatibleWikidataP31(["Q11424"])).toBe(true);
  });

  it("rejette type hors allowlist ou vide", () => {
    expect(hasCompatibleWikidataP31(["Q6256"])).toBe(false); // country
    expect(hasCompatibleWikidataP31([])).toBe(false);
  });
});

describe("licenseRequiresCredit", () => {
  it("CC BY / CC BY-SA → obligatoire ; CC0 / PD → optionnel", () => {
    expect(licenseRequiresCredit("CC BY 4.0")).toBe(true);
    expect(licenseRequiresCredit("CC BY-SA 4.0")).toBe(true);
    expect(licenseRequiresCredit("CC0")).toBe(false);
    expect(licenseRequiresCredit("Public Domain")).toBe(false);
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

describe("wikimedia P31 + crédit", () => {
  it("exact match + type musical valide → accepté", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [{ id: "Q1", label: "Imparfait", aliases: [] }],
        });
      }
      if (url.includes("wbgetentities")) {
        return jsonResponse({
          entities: {
            Q1: {
              claims: {
                P31: [p31("Q215380")],
                P18: [p18("Imparfait.jpg")],
              },
            },
          },
        });
      }
      if (url.startsWith(COMMONS_API)) {
        return jsonResponse(
          commonsPage({ license: "CC BY-SA 4.0", artist: "Photo Club" }),
        );
      }
      return jsonResponse({}, 404);
    });

    const hit = await lookupWikimediaImageForCandidates(["Imparfait"], {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(hit?.entityId).toBe("Q1");
    expect(hit?.imageLicense).toBe("CC BY-SA 4.0");
    expect(hit?.imageCredit).toBe("Photo Club");
  });

  it("exact match + mauvais type → rejeté", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [{ id: "Q1", label: "Orléans", aliases: [] }],
        });
      }
      if (url.includes("wbgetentities")) {
        return jsonResponse({
          entities: {
            Q1: {
              claims: {
                P31: [p31("Q515")], // city
                P18: [p18("Orleans.jpg")],
              },
            },
          },
        });
      }
      return jsonResponse(commonsPage({ license: "CC0", artist: "X" }));
    });

    const hit = await lookupWikimediaImageForCandidates(["Orléans"], {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(hit).toBeNull();
  });

  it("exact match sans type exploitable → rejeté", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("wbsearchentities")) {
        return jsonResponse({
          search: [{ id: "Q1", label: "Mona Guba", aliases: [] }],
        });
      }
      if (url.includes("wbgetentities")) {
        return jsonResponse({
          entities: {
            Q1: {
              claims: {
                P18: [p18("Mona.jpg")],
                // pas de P31
              },
            },
          },
        });
      }
      return jsonResponse(commonsPage({ license: "CC0" }));
    });

    const hit = await lookupWikimediaImageForCandidates(["Mona Guba"], {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(hit).toBeNull();
  });

  it("CC BY-SA + auteur présent → accepté", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(commonsPage({ license: "CC BY-SA 4.0", artist: "Jane Doe" })),
    );
    const meta = await fetchCommonsImageAttribution("File:X.jpg", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(meta?.imageLicense).toBe("CC BY-SA 4.0");
    expect(meta?.imageCredit).toBe("Jane Doe");
  });

  it("CC BY + crédit présent → accepté", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(commonsPage({ license: "CC BY 4.0", credit: "Studio Z" })),
    );
    const meta = await fetchCommonsImageAttribution("File:X.jpg", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(meta?.imageLicense).toBe("CC BY 4.0");
    expect(meta?.imageCredit).toBe("Studio Z");
  });

  it("CC BY-SA sans crédit → rejeté", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(commonsPage({ license: "CC BY-SA 4.0" })),
    );
    const meta = await fetchCommonsImageAttribution("File:X.jpg", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(meta).toBeNull();
  });

  it("CC0 sans crédit → accepté", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(commonsPage({ license: "CC0" })),
    );
    const meta = await fetchCommonsImageAttribution("File:X.jpg", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(meta?.imageLicense).toBe("CC0");
    expect(meta?.imageCredit).toBeNull();
  });

  it("Public Domain sans crédit → accepté", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(commonsPage({ license: "Public domain" })),
    );
    const meta = await fetchCommonsImageAttribution("File:X.jpg", {
      fetchImpl,
      httpTimeoutMs: 5_000,
    });
    expect(meta?.imageLicense).toBe("Public Domain");
    expect(meta?.imageCredit).toBeNull();
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
                P31: [p31("Q5")],
                P18: [p18("Mona_Guba.jpg")],
              },
            },
          },
        });
      }
      if (url.startsWith(COMMONS_API)) {
        return jsonResponse(
          commonsPage({
            license: "CC BY-SA 4.0",
            artist: '<a href="https://example.com">Jane Doe</a>',
          }),
        );
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
      "https://commons.wikimedia.org/wiki/File:X.jpg",
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
                P31: [p31("Q5")],
                P18: [p18("Copycat.jpg")],
              },
            },
          },
        });
      }
      if (url.startsWith(COMMONS_API)) {
        return jsonResponse(
          commonsPage({ license: "CC BY-NC 4.0", artist: "Someone" }),
        );
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
