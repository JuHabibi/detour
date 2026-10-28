import { describe, expect, it } from "vitest";
import {
  mapResetPasswordClientError,
  RESET_PASSWORD_INVALID_LINK_MESSAGE,
  RESET_PASSWORD_RETRYABLE_MESSAGE,
} from "@/features/account/components/auth/account-reset-password-feedback";

describe("mapResetPasswordClientError", () => {
  it("traite INVALID_TOKEN / TOKEN_EXPIRED / USER_NOT_FOUND comme lien mort", () => {
    for (const code of ["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"]) {
      expect(mapResetPasswordClientError({ code })).toEqual({
        kind: "invalid_link",
        message: RESET_PASSWORD_INVALID_LINK_MESSAGE,
      });
    }
    expect(
      mapResetPasswordClientError({ code: "invalid_token" }).kind,
    ).toBe("invalid_link");
  });

  it("traite les autres erreurs et l’absence de code comme retryable", () => {
    expect(mapResetPasswordClientError({ code: "PASSWORD_TOO_SHORT" })).toEqual(
      {
        kind: "retryable",
        message: RESET_PASSWORD_RETRYABLE_MESSAGE,
      },
    );
    expect(mapResetPasswordClientError({ message: "network" })).toEqual({
      kind: "retryable",
      message: RESET_PASSWORD_RETRYABLE_MESSAGE,
    });
    expect(mapResetPasswordClientError(null)).toEqual({
      kind: "retryable",
      message: RESET_PASSWORD_RETRYABLE_MESSAGE,
    });
  });

  it("n’expose jamais le message technique Better Auth", () => {
    const feedback = mapResetPasswordClientError({
      code: "INVALID_TOKEN",
      message: "Invalid token abc-secret",
    });
    expect(feedback.message).toBe(RESET_PASSWORD_INVALID_LINK_MESSAGE);
    expect(feedback.message).not.toContain("abc-secret");
    expect(feedback.message).not.toContain("Invalid token");
  });
});
