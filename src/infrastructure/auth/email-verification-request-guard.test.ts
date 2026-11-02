import { afterEach, describe, expect, it } from "vitest";
import {
  emailVerificationOpsUnavailableResponse,
  isEmailSignUpRequestPath,
  isSendVerificationEmailRequestPath,
  runEmailVerificationRequestWithSendProbe,
  shouldBlockEmailVerificationBeforeAuth,
} from "@/infrastructure/auth/email-verification-request-guard";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
  resetPasswordResetProviderCooldownForTests,
} from "@/infrastructure/email/password-reset-send-probe";

afterEach(() => {
  resetPasswordResetProviderCooldownForTests();
});

describe("email verification request paths", () => {
  it("détecte sign-up email et send-verification-email", () => {
    expect(isEmailSignUpRequestPath("/api/auth/sign-up/email")).toBe(true);
    expect(isEmailSignUpRequestPath("/sign-up/email")).toBe(true);
    expect(isSendVerificationEmailRequestPath("/api/auth/send-verification-email")).toBe(
      true,
    );
    expect(isEmailSignUpRequestPath("/api/auth/sign-in/email")).toBe(false);
  });
});

describe("shouldBlockEmailVerificationBeforeAuth", () => {
  it("ne bloque pas hors production", () => {
    expect(
      shouldBlockEmailVerificationBeforeAuth({ NODE_ENV: "development" }),
    ).toBe(false);
  });

  it("bloque en prod sans Resend", () => {
    expect(
      shouldBlockEmailVerificationBeforeAuth({ NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("bloque en prod pendant le cooldown", () => {
    markPasswordResetProviderUnavailable();
    expect(
      shouldBlockEmailVerificationBeforeAuth({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBe(true);
  });
});

describe("runEmailVerificationRequestWithSendProbe", () => {
  it("renvoie 503 si la sonde signale un échec d’envoi", async () => {
    const response = await runEmailVerificationRequestWithSendProbe(
      async () => {
        const probe = passwordResetSendProbe.getStore();
        if (probe) probe.failed = true;
        return Response.json({ status: true });
      },
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("EMAIL_VERIFICATION_PROVIDER_UNAVAILABLE");
  });
});

describe("emailVerificationOpsUnavailableResponse", () => {
  it("répond 503 uniforme", () => {
    const response = emailVerificationOpsUnavailableResponse();
    expect(response.status).toBe(503);
  });
});
