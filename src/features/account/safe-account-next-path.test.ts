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

  it("conserve le fallback par défaut et personnalisé", () => {
    expect(safeAccountNextPath(undefined)).toBe("/account");
    expect(safeAccountNextPath(null)).toBe("/account");
    expect(safeAccountNextPath("")).toBe("/account");
    expect(safeAccountNextPath("//evil.test", "/frise")).toBe("/frise");
  });

  it("rejette les open redirects classiques", () => {
    expect(safeAccountNextPath("https://evil.test")).toBe("/account");
    expect(safeAccountNextPath("//evil.test")).toBe("/account");
    expect(safeAccountNextPath("/\\evil")).toBe("/account");
    expect(safeAccountNextPath("evil.test")).toBe("/account");
  });

  it("rejette les caractères de contrôle qui normalisent vers une origine externe", () => {
    expect(safeAccountNextPath("/\t/evil.test")).toBe("/account");
    expect(safeAccountNextPath("/\n/evil.test")).toBe("/account");
    expect(safeAccountNextPath("/\r/evil.test")).toBe("/account");
    expect(safeAccountNextPath("/\u0000/evil.test")).toBe("/account");
  });
});

describe("account auth hrefs", () => {
  it("encode next pour login et signup", () => {
    expect(accountLoginHref("/frise")).toBe(
      "/account/login?next=%2Ffrise",
    );
    expect(accountSignupHref("/frise?category=Musique")).toBe(
      "/account/signup?next=%2Ffrise%3Fcategory%3DMusique",
    );
  });

  it("omet next si la cible est invalide", () => {
    expect(accountLoginHref("//evil.test")).toBe("/account/login");
    expect(accountSignupHref("/\t/evil.test")).toBe("/account/signup");
    expect(accountLoginHref(null)).toBe("/account/login");
    expect(accountSignupHref(undefined)).toBe("/account/signup");
  });
});
