import { describe, expect, it } from "vitest";
import {
  accountLoginHref,
  accountSignupHref,
  safeAccountNextPath,
} from "@/features/account/safe-account-next-path";

describe("safeAccountNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeAccountNextPath("/frise")).toBe("/frise");
    expect(safeAccountNextPath("/frise?category=Musique")).toBe(
      "/frise?category=Musique",
    );
  });

  it("rejette les open redirects", () => {
    expect(safeAccountNextPath("https://evil.test")).toBe("/account");
    expect(safeAccountNextPath("//evil.test")).toBe("/account");
    expect(safeAccountNextPath("/\\evil")).toBe("/account");
    expect(safeAccountNextPath(undefined)).toBe("/account");
  });
});

describe("account auth hrefs", () => {
  it("encode next", () => {
    expect(accountLoginHref("/frise")).toBe(
      "/account/login?next=%2Ffrise",
    );
    expect(accountSignupHref("/frise?category=Musique")).toContain("next=");
  });
});
