import { describe, expect, it } from "vitest";
import { mergeExplorerUrlWriteMode } from "@/features/explorer/explorer-url-write-mode";

describe("mergeExplorerUrlWriteMode", () => {
  it("accepte push et replace depuis null", () => {
    expect(mergeExplorerUrlWriteMode(null, "push")).toBe("push");
    expect(mergeExplorerUrlWriteMode(null, "replace")).toBe("replace");
  });

  it("ne rétrograde pas un push en replace (race search debouncée)", () => {
    expect(mergeExplorerUrlWriteMode("push", "replace")).toBe("push");
  });

  it("laisse un push écraser un replace en attente", () => {
    expect(mergeExplorerUrlWriteMode("replace", "push")).toBe("push");
  });

  it("conserve replace si replace redemandé", () => {
    expect(mergeExplorerUrlWriteMode("replace", "replace")).toBe("replace");
  });
});
