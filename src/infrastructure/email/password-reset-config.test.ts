import { describe, expect, it } from "vitest";
import {
  isPasswordResetDeliveryReady,
  isPasswordResetPublicLinkEnabled,
  resolveResendPasswordResetConfig,
} from "@/infrastructure/email/password-reset-config";

const resendEnv = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
};

describe("resolveResendPasswordResetConfig", () => {
  it("retourne null si clé ou from manquant", () => {
    expect(resolveResendPasswordResetConfig({})).toBeNull();
    expect(
      resolveResendPasswordResetConfig({ RESEND_API_KEY: "re_test" }),
    ).toBeNull();
    expect(
      resolveResendPasswordResetConfig({
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBeNull();
  });

  it("retourne la config quand les deux sont présents", () => {
    expect(
      resolveResendPasswordResetConfig({
        RESEND_API_KEY: " re_test ",
        RESEND_FROM_EMAIL: " Détour <noreply@detour.website> ",
      }),
    ).toEqual({
      apiKey: "re_test",
      from: "Détour <noreply@detour.website>",
    });
  });
});

describe("isPasswordResetDeliveryReady", () => {
  it("est prêt hors production même sans Resend (stub)", () => {
    expect(isPasswordResetDeliveryReady({ NODE_ENV: "development" })).toBe(
      true,
    );
  });

  it("en production exige Resend, pas le flag public", () => {
    expect(
      isPasswordResetDeliveryReady({
        NODE_ENV: "production",
        ...resendEnv,
      }),
    ).toBe(true);
    expect(
      isPasswordResetDeliveryReady({
        NODE_ENV: "production",
        DETOUR_PASSWORD_RESET_ENABLED: "true",
      }),
    ).toBe(false);
  });
});

describe("isPasswordResetPublicLinkEnabled", () => {
  it("reste off en prod tant que le flag public est absent", () => {
    expect(
      isPasswordResetPublicLinkEnabled({
        NODE_ENV: "production",
        ...resendEnv,
      }),
    ).toBe(false);
  });

  it("s’active en prod seulement avec flag + Resend (activation publique)", () => {
    expect(
      isPasswordResetPublicLinkEnabled({
        NODE_ENV: "production",
        DETOUR_PASSWORD_RESET_ENABLED: "true",
        ...resendEnv,
      }),
    ).toBe(true);
  });
});
