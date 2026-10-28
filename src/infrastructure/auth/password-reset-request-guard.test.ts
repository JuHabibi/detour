import { afterEach, describe, expect, it } from "vitest";
import {
  isPasswordResetRequestPath,
  passwordResetOpsUnavailableResponse,
  runPasswordResetRequestWithSendProbe,
  shouldBlockPasswordResetBeforeAuth,
} from "@/infrastructure/auth/password-reset-request-guard";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
  resetPasswordResetProviderCooldownForTests,
} from "@/infrastructure/email/password-reset-send-probe";

afterEach(() => {
  resetPasswordResetProviderCooldownForTests();
});

describe("isPasswordResetRequestPath", () => {
  it("détecte les chemins Better Auth de demande de reset", () => {
    expect(
      isPasswordResetRequestPath("/api/auth/request-password-reset"),
    ).toBe(true);
    expect(isPasswordResetRequestPath("/api/auth/forget-password")).toBe(true);
    expect(isPasswordResetRequestPath("/api/auth/sign-in/email")).toBe(false);
  });
});

describe("shouldBlockPasswordResetBeforeAuth", () => {
  it("ne bloque pas hors production", () => {
    expect(
      shouldBlockPasswordResetBeforeAuth({ NODE_ENV: "development" }),
    ).toBe(false);
  });

  it("bloque en production sans Resend (503 uniforme, sans lookup)", () => {
    expect(
      shouldBlockPasswordResetBeforeAuth({ NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("bloque en production pendant le cooldown provider", () => {
    markPasswordResetProviderUnavailable();
    expect(
      shouldBlockPasswordResetBeforeAuth({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBe(true);
  });

  it("laisse passer en production si Resend est prêt", () => {
    expect(
      shouldBlockPasswordResetBeforeAuth({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBe(false);
  });
});

describe("runPasswordResetRequestWithSendProbe", () => {
  it("renvoie 503 si la sonde signale un échec d’envoi", async () => {
    const response = await runPasswordResetRequestWithSendProbe(async () => {
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      return Response.json({ status: true }, { status: 200 });
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("PASSWORD_RESET_PROVIDER_UNAVAILABLE");
  });

  it("laisse passer la réponse BA si l’envoi a réussi", async () => {
    const response = await runPasswordResetRequestWithSendProbe(async () =>
      Response.json({ status: true }, { status: 200 }),
    );
    expect(response.status).toBe(200);
  });
});

describe("passwordResetOpsUnavailableResponse", () => {
  it("expose un message ops générique", async () => {
    const response = passwordResetOpsUnavailableResponse();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/indisponible/i);
  });
});
