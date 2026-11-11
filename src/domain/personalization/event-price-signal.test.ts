import { describe, expect, it } from "vitest";
import { resolveEventPriceSignal } from "./event-price-signal";

describe("resolveEventPriceSignal", () => {
  it("price free / 0 → free", () => {
    expect(resolveEventPriceSignal({ price: "free" })).toBe("free");
    expect(resolveEventPriceSignal({ price: 0 })).toBe("free");
  });

  it("price numérique > 0 → paid", () => {
    expect(resolveEventPriceSignal({ price: 12 })).toBe("paid");
  });

  it("gratuit / entrée libre sans restriction → free", () => {
    expect(resolveEventPriceSignal({ conditions: "Gratuit" })).toBe("free");
    expect(resolveEventPriceSignal({ conditions: "Entrée gratuite" })).toBe(
      "free",
    );
    expect(resolveEventPriceSignal({ conditions: "Accès gratuit." })).toBe(
      "free",
    );
    expect(resolveEventPriceSignal({ conditions: "Entrée libre" })).toBe(
      "free",
    );
    expect(resolveEventPriceSignal({ conditions: "Entrée libre et gratuite" })).toBe(
      "free",
    );
  });

  it("gratuit conditionnel (âge) → unknown", () => {
    expect(
      resolveEventPriceSignal({
        conditions: "Gratuit pour les moins de 12 ans",
      }),
    ).toBe("unknown");
  });

  it("non gratuit → unknown (≠ free)", () => {
    expect(resolveEventPriceSignal({ conditions: "Non gratuit" })).toBe(
      "unknown",
    );
  });

  it("gratuit certains jours / mixte → unknown", () => {
    expect(
      resolveEventPriceSignal({
        conditions: "Gratuit certains jours, payant les autres",
      }),
    ).toBe("unknown");
    expect(
      resolveEventPriceSignal({
        conditions: "Gratuit le dimanche — 8 € en semaine",
      }),
    ).toBe("unknown");
  });

  it("tarif payant explicite → paid", () => {
    expect(resolveEventPriceSignal({ conditions: "12 €" })).toBe("paid");
    expect(resolveEventPriceSignal({ conditions: "Tarif 8 euros" })).toBe(
      "paid",
    );
  });

  it("absent ou ambigu → unknown (≠ gratuit)", () => {
    expect(resolveEventPriceSignal({})).toBe("unknown");
    expect(resolveEventPriceSignal({ conditions: null })).toBe("unknown");
    expect(resolveEventPriceSignal({ conditions: "Sur réservation" })).toBe(
      "unknown",
    );
    expect(resolveEventPriceSignal({ conditions: "Tarif unique" })).toBe(
      "unknown",
    );
  });
});
