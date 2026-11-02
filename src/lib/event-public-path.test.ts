import { describe, expect, it } from "vitest";
import {
  eventPublicPath,
  normalizeEventIdParam,
} from "@/lib/event-public-path";

describe("eventPublicPath", () => {
  it("encode les caractères spéciaux de l’id", () => {
    expect(eventPublicPath("openagenda:7937057")).toBe(
      "/evenements/openagenda%3A7937057",
    );
    expect(
      eventPublicPath(
        "saran:calendar.12529.field_date_debut.0@www.mairie-saran.fr",
      ),
    ).toBe(
      "/evenements/saran%3Acalendar.12529.field_date_debut.0%40www.mairie-saran.fr",
    );
  });

  it("reste stable si le titre change (ne dépend que de l’id)", () => {
    const id = "bouillon:18149";
    expect(eventPublicPath(id)).toBe(eventPublicPath(` ${id} `));
  });
});

describe("normalizeEventIdParam", () => {
  it("décode un segment URL", () => {
    expect(normalizeEventIdParam("openagenda%3A7937057")).toBe(
      "openagenda:7937057",
    );
    expect(
      normalizeEventIdParam(
        "saran%3Acalendar.12529.field_date_debut.0%40www.mairie-saran.fr",
      ),
    ).toBe("saran:calendar.12529.field_date_debut.0@www.mairie-saran.fr");
  });

  it("accepte un id déjà décodé par Next", () => {
    expect(normalizeEventIdParam("openagenda:1")).toBe("openagenda:1");
  });

  it("refuse vide / mal formé", () => {
    expect(normalizeEventIdParam("")).toBeNull();
    expect(normalizeEventIdParam("   ")).toBeNull();
    expect(normalizeEventIdParam("%E0%A4%A")).toBeNull();
  });
});
