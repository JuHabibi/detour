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

  it("conditions « Gratuit » → free", () => {
    expect(resolveEventPriceSignal({ conditions: "Gratuit" })).toBe("free");
    expect(resolveEventPriceSignal({ conditions: "Entrée gratuite" })).toBe(
      "free",
    );
  });

  it("montant en € → paid", () => {
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
