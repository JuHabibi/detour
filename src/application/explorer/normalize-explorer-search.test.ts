import { describe, expect, it } from "vitest";
import { normalizeExplorerSearch } from "@/application/explorer/normalize-explorer-search";

describe("normalizeExplorerSearch", () => {
  it("trim + vide → null", () => {
    expect(normalizeExplorerSearch(null)).toBeNull();
    expect(normalizeExplorerSearch(undefined)).toBeNull();
    expect(normalizeExplorerSearch("")).toBeNull();
    expect(normalizeExplorerSearch("   ")).toBeNull();
  });

  it("wrap ILIKE et échappe % _ \\", () => {
    expect(normalizeExplorerSearch("  Jazz  ")).toBe("%Jazz%");
    expect(normalizeExplorerSearch("100% live")).toBe("%100\\% live%");
    expect(normalizeExplorerSearch("a_b")).toBe("%a\\_b%");
    expect(normalizeExplorerSearch("a\\b")).toBe("%a\\\\b%");
  });

  it("borne à 80 caractères", () => {
    const long = "x".repeat(100);
    const pattern = normalizeExplorerSearch(long)!;
    expect(pattern.length).toBe(82); // % + 80 + %
  });
});
