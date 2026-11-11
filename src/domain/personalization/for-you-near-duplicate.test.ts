import { describe, expect, it } from "vitest";
import { areNearDuplicateTitles } from "./select-for-you-events";

describe("areNearDuplicateTitles", () => {
  it("détecte une lettre manquante (Goria / Gloria)", () => {
    expect(
      areNearDuplicateTitles("goria de vivaldi", "gloria de vivaldi"),
    ).toBe(true);
  });

  it("refuse des titres distincts", () => {
    expect(areNearDuplicateTitles("concert jazz", "concert rock")).toBe(false);
    expect(
      areNearDuplicateTitles("gloria de vivaldi", "stabat mater de rheinberger"),
    ).toBe(false);
  });

  it("refuse les titres trop courts (anti faux positif)", () => {
    expect(areNearDuplicateTitles("a", "b")).toBe(false);
    expect(areNearDuplicateTitles("expo", "expu")).toBe(false);
  });

  it("identiques → true", () => {
    expect(areNearDuplicateTitles("trio addendum", "trio addendum")).toBe(true);
  });
});
