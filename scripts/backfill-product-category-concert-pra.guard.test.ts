import { describe, expect, it } from "vitest";
import {
  isPraConcertBackfillChange,
  PRA_CONCERT_BACKFILL_FROM,
  PRA_CONCERT_BACKFILL_TO,
} from "./backfill-product-category-concert-pra.guard";

describe("isPraConcertBackfillChange", () => {
  it("autorise uniquement Spectacle → Musique", () => {
    expect(
      isPraConcertBackfillChange(
        PRA_CONCERT_BACKFILL_FROM,
        PRA_CONCERT_BACKFILL_TO,
      ),
    ).toBe(true);
    expect(isPraConcertBackfillChange("Spectacle", "Musique")).toBe(true);
  });

  it("refuse toute autre transition", () => {
    expect(isPraConcertBackfillChange("Musique", "Spectacle")).toBe(false);
    expect(isPraConcertBackfillChange("Spectacle", "Spectacle")).toBe(false);
    expect(isPraConcertBackfillChange("Musique", "Musique")).toBe(false);
    expect(isPraConcertBackfillChange("Spectacle", "Autre")).toBe(false);
    expect(isPraConcertBackfillChange("Autre", "Musique")).toBe(false);
    expect(isPraConcertBackfillChange(null, "Musique")).toBe(false);
    expect(isPraConcertBackfillChange(undefined, "Musique")).toBe(false);
    expect(isPraConcertBackfillChange("Spectacle", "Jeune public")).toBe(false);
  });
});
