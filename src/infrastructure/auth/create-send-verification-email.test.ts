import { afterEach, describe, expect, it, vi } from "vitest";
import { createSendVerificationEmail } from "@/infrastructure/auth/create-send-verification-email";
import {
  isPasswordResetProviderInCooldown,
  passwordResetSendProbe,
  resetPasswordResetProviderCooldownForTests,
} from "@/infrastructure/email/password-reset-send-probe";

afterEach(() => {
  resetPasswordResetProviderCooldownForTests();
});

describe("createSendVerificationEmail", () => {
  it("en développement sans Resend : stub sans URL ni jeton", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>();
    const send = createSendVerificationEmail(
      { NODE_ENV: "development" },
      fetchImpl,
    );

    await send({
      user: { email: "dev@example.com" },
      url: "https://example.com/api/auth/verify-email?token=secret-token-value",
      token: "secret-token-value",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(
      "secret-token-value",
    );
    infoSpy.mockRestore();
  });

  it("en production sans Resend : throw + sonde + cooldown", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = createSendVerificationEmail(
      { NODE_ENV: "production" },
      vi.fn<typeof fetch>(),
    );
    const probe = { failed: false };

    await expect(
      passwordResetSendProbe.run(probe, () =>
        send({
          user: { email: "prod@example.com" },
          url: "https://detour.website/api/auth/verify-email?token=secret-token-value",
          token: "secret-token-value",
        }),
      ),
    ).rejects.toThrow(/not configured/i);

    expect(probe.failed).toBe(true);
    expect(isPasswordResetProviderInCooldown()).toBe(true);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      "secret-token-value",
    );
    errorSpy.mockRestore();
  });

  it("marque la sonde si Resend échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 500 }),
    );
    const send = createSendVerificationEmail(
      {
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      },
      fetchImpl,
    );
    const probe = { failed: false };

    await expect(
      passwordResetSendProbe.run(probe, () =>
        send({
          user: { email: "user@example.com" },
          url: "https://detour.website/api/auth/verify-email?token=secret-token-value",
          token: "secret-token-value",
        }),
      ),
    ).rejects.toThrow(/Failed to send/);

    expect(probe.failed).toBe(true);
    expect(isPasswordResetProviderInCooldown()).toBe(true);
    errorSpy.mockRestore();
  });
});
