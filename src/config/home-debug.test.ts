import { describe, expect, it } from "vitest";
import { shouldExposeHomeDebug } from "@/config/home-debug";

describe("shouldExposeHomeDebug", () => {
  it("désactive le debug public en production", () => {
    expect(shouldExposeHomeDebug({ NODE_ENV: "production" })).toBe(false);
  });

  it("active le debug en development", () => {
    expect(shouldExposeHomeDebug({ NODE_ENV: "development" })).toBe(true);
  });

  it("active le debug hors production (test / undefined)", () => {
    expect(shouldExposeHomeDebug({ NODE_ENV: "test" })).toBe(true);
    expect(shouldExposeHomeDebug({})).toBe(true);
  });
});
