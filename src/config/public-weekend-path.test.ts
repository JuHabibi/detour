import { describe, expect, it } from "vitest";
import { publicWeekendPath } from "@/config/public-weekend-path";

describe("publicWeekendPath", () => {
  it("dérive l’URL du slug territoire public", () => {
    expect(publicWeekendPath()).toBe("/orleans/ce-week-end");
    expect(publicWeekendPath("orleans")).toBe("/orleans/ce-week-end");
  });
});
