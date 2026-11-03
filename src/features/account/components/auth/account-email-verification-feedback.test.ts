import { describe, expect, it } from "vitest";
import {
  EMAIL_VERIFICATION_INVALID_LINK_MESSAGE,
  EMAIL_VERIFICATION_REQUIRED_LEAD,
  EMAIL_VERIFICATION_SENT_LEAD,
  isEmailNotVerifiedError,
  mapVerifyEmailCallbackError,
} from "@/features/account/components/auth/account-email-verification-feedback";

describe("copy vérification email (anti-énumération UI)", () => {
  it("reste neutre : ne confirme pas l’existence du compte", () => {
    expect(EMAIL_VERIFICATION_REQUIRED_LEAD).toBe(
      "Pour terminer la connexion, vérifiez votre adresse email à l’aide du lien de confirmation.",
    );
    expect(EMAIL_VERIFICATION_REQUIRED_LEAD.toLowerCase()).not.toMatch(
      /compte existe|existe déjà|adresse n’a pas/,
    );
    expect(EMAIL_VERIFICATION_SENT_LEAD.toLowerCase()).toMatch(
      /si un compte correspond/,
    );
  });
});

describe("isEmailNotVerifiedError", () => {
  it("détecte le code Better Auth", () => {
    expect(isEmailNotVerifiedError({ code: "EMAIL_NOT_VERIFIED" })).toBe(true);
    expect(
      isEmailNotVerifiedError({ message: "Email not verified" }),
    ).toBe(true);
    expect(isEmailNotVerifiedError({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
      false,
    );
  });
});

describe("mapVerifyEmailCallbackError", () => {
  it("mappe TOKEN_EXPIRED sans exposer de détail technique", () => {
    expect(mapVerifyEmailCallbackError("TOKEN_EXPIRED")).toBe(
      EMAIL_VERIFICATION_INVALID_LINK_MESSAGE,
    );
    expect(mapVerifyEmailCallbackError("INVALID_TOKEN")).toBe(
      EMAIL_VERIFICATION_INVALID_LINK_MESSAGE,
    );
    expect(mapVerifyEmailCallbackError(undefined)).toBeNull();
  });
});
