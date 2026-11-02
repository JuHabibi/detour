import { describe, expect, it, vi } from "vitest";
import { sendVerificationEmailMessage } from "@/infrastructure/email/send-verification-email";

describe("sendVerificationEmailMessage", () => {
  it("poste vers Resend sans journaliser l’URL ni le jeton", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendVerificationEmailMessage({
      to: "user@example.com",
      verifyUrl:
        "https://detour.website/api/auth/verify-email?token=secret-token-value&callbackURL=%2Faccount%2Fverify-email",
      config: {
        apiKey: "re_test",
        from: "Détour <noreply@detour.website>",
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(typeof init?.body).toBe("string");
    if (typeof init?.body !== "string") {
      throw new Error("expected Resend request body to be a JSON string");
    }
    const body: unknown = JSON.parse(init.body);
    expect(body).toEqual(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Confirmez votre email Détour",
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("échoue avec un code contrôlé, sans données sensibles dans les logs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ message: "Domain not verified for user@example.com" }),
          { status: 403 },
        ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendVerificationEmailMessage({
        to: "user@example.com",
        verifyUrl:
          "https://detour.website/api/auth/verify-email?token=secret-token-value",
        config: {
          apiKey: "re_test_secret_key",
          from: "Détour <noreply@detour.website>",
        },
        fetchImpl,
      }),
    ).rejects.toThrow(/Failed to send verification email/);

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("RESEND_UNAUTHORIZED");
    expect(logged).not.toContain("secret-token-value");
    expect(logged).not.toContain("re_test_secret_key");
    expect(logged).not.toContain("user@example.com");
    errorSpy.mockRestore();
  });
});
