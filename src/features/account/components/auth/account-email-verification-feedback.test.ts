import { describe, expect, it } from "vitest";
import {
  EMAIL_VERIFICATION_INVALID_LINK_MESSAGE,
  isEmailNotVerifiedError,
  mapVerifyEmailCallbackError,
} from "@/features/account/components/auth/account-email-verification-feedback";

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
