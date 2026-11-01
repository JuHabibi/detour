import { describe, expect, it } from "vitest";
import {
  isPraCinemaBackfillChange,
  PRA_CINEMA_BACKFILL_TO,
} from "./backfill-product-category-cinema.guard";

describe("isPraCinemaBackfillChange", () => {
  it("autorise Spectacle → Cinéma et Autre → Cinéma", () => {
    expect(isPraCinemaBackfillChange("Spectacle", PRA_CINEMA_BACKFILL_TO)).toBe(
      true,
    );
    expect(isPraCinemaBackfillChange("Autre", "Cinéma")).toBe(true);
  });

  it("refuse toute autre transition", () => {
    expect(isPraCinemaBackfillChange("Cinéma", "Cinéma")).toBe(false);
    expect(isPraCinemaBackfillChange("Spectacle", "Spectacle")).toBe(false);
    expect(isPraCinemaBackfillChange("Musique", "Cinéma")).toBe(false);
    expect(isPraCinemaBackfillChange("Rencontre", "Cinéma")).toBe(false);
    expect(isPraCinemaBackfillChange("Atelier", "Cinéma")).toBe(false);
    expect(isPraCinemaBackfillChange("Spectacle", "Musique")).toBe(false);
    expect(isPraCinemaBackfillChange(null, "Cinéma")).toBe(false);
    expect(isPraCinemaBackfillChange(undefined, "Cinéma")).toBe(false);
  });
});
