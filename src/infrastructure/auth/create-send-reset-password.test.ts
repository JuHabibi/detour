import { afterEach, describe, expect, it, vi } from "vitest";
import { createSendResetPassword } from "@/infrastructure/auth/create-send-reset-password";
import {
  isPasswordResetProviderInCooldown,
  passwordResetSendProbe,
  resetPasswordResetProviderCooldownForTests,
} from "@/infrastructure/email/password-reset-send-probe";

afterEach(() => {
  resetPasswordResetProviderCooldownForTests();
});

describe("createSendResetPassword", () => {
  it("en développement sans Resend : stub sans URL ni jeton", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>();
    const send = createSendResetPassword({ NODE_ENV: "development" }, fetchImpl);

    await send({
      user: { email: "dev@example.com" },
      url: "https://example.com/api/auth/reset-password/secret-token-value",
      token: "secret-token-value",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(
      "secret-token-value",
    );
    expect(JSON.stringify(infoSpy.mock.calls)).toContain("dev@example.com");
    infoSpy.mockRestore();
  });

  it("en production sans Resend : throw + sonde + cooldown (pas de faux succès)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>();
    const send = createSendResetPassword({ NODE_ENV: "production" }, fetchImpl);
    const probe = { failed: false };

    await expect(
      passwordResetSendProbe.run(probe, () =>
        send({
          user: { email: "prod@example.com" },
          url: "https://detour.website/api/auth/reset-password/secret-token-value",
          token: "secret-token-value",
        }),
      ),
    ).rejects.toThrow(/not configured/i);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(probe.failed).toBe(true);
    expect(isPasswordResetProviderInCooldown()).toBe(true);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      "secret-token-value",
    );
    errorSpy.mockRestore();
  });

  it("envoie via Resend quand la config est présente (fetch mocké)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    const send = createSendResetPassword(
      {
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      },
      fetchImpl,
    );

    await send({
      user: { email: "user@example.com" },
      url: "https://detour.website/api/auth/reset-password/secret-token-value",
      token: "secret-token-value",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(typeof init?.body).toBe("string");
    if (typeof init?.body !== "string") {
      throw new Error("expected Resend request body to be a JSON string");
    }
    const body: unknown = JSON.parse(init.body);
    expect(body).toEqual(
      expect.objectContaining({
        to: ["user@example.com"],
      }),
    );
    expect(isPasswordResetProviderInCooldown()).toBe(false);
  });

  it("marque la sonde et le cooldown si Resend échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ message: "Domain not verified" }), {
          status: 403,
        }),
    );
    const send = createSendResetPassword(
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
          url: "https://detour.website/api/auth/reset-password/secret-token-value",
          token: "secret-token-value",
        }),
      ),
    ).rejects.toThrow(/Failed to send/);

    expect(probe.failed).toBe(true);
    expect(isPasswordResetProviderInCooldown()).toBe(true);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      "secret-token-value",
    );
    errorSpy.mockRestore();
  });
});
