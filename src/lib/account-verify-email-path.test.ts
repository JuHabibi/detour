import { describe, expect, it } from "vitest";
import {
  accountVerifyEmailCallbackPath,
  accountVerifyEmailPageHref,
} from "@/lib/account-verify-email-path";

describe("accountVerifyEmailCallbackPath", () => {
  it("cible verify-email avec confirmed et next safe", () => {
    expect(accountVerifyEmailCallbackPath("/explorer?addFavorite=e1")).toBe(
      "/account/verify-email?confirmed=1&next=%2Fexplorer%3FaddFavorite%3De1",
    );
    expect(accountVerifyEmailCallbackPath("/account")).toBe(
      "/account/verify-email?confirmed=1",
    );
  });
});

describe("accountVerifyEmailPageHref", () => {
  it("conserve email et next pour le renvoi", () => {
    expect(
      accountVerifyEmailPageHref({
        email: "a@b.fr",
        next: "/frise?addFavorite=x",
      }),
    ).toBe(
      "/account/verify-email?email=a%40b.fr&next=%2Ffrise%3FaddFavorite%3Dx",
    );
  });
});
