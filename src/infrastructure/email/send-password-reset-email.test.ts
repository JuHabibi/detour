import { describe, expect, it, vi } from "vitest";
import {
  resendFailureCode,
  sendPasswordResetEmail,
} from "@/infrastructure/email/send-password-reset-email";

describe("resendFailureCode", () => {
  it("mappe les statuts HTTP vers des codes contrôlés", () => {
    expect(resendFailureCode(401)).toBe("RESEND_UNAUTHORIZED");
    expect(resendFailureCode(403)).toBe("RESEND_UNAUTHORIZED");
    expect(resendFailureCode(422)).toBe("RESEND_VALIDATION");
    expect(resendFailureCode(429)).toBe("RESEND_RATE_LIMITED");
    expect(resendFailureCode(500)).toBe("RESEND_UPSTREAM");
    expect(resendFailureCode(418)).toBe("RESEND_ERROR");
  });
});

describe("sendPasswordResetEmail", () => {
  it("poste vers Resend sans journaliser l’URL", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl:
        "https://detour.website/api/auth/reset-password/secret-token-value?callbackURL=%2Faccount%2Freset-password",
      config: {
        apiKey: "re_test",
        from: "Détour <noreply@detour.website>",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test",
    );
    const body = JSON.parse(String(init?.body)) as {
      to: string[];
      from: string;
      text: string;
    };
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.from).toBe("Détour <noreply@detour.website>");
    expect(body.text).toContain("secret-token-value");
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("échoue avec un code contrôlé, sans détail Resend ni données sensibles", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: "Domain not verified for user@example.com",
          }),
          { status: 403 },
        ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendPasswordResetEmail({
        to: "user@example.com",
        resetUrl:
          "https://detour.website/api/auth/reset-password/secret-token-value",
        config: {
          apiKey: "re_test_secret_key",
          from: "Détour <noreply@detour.website>",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Failed to send password reset email/);

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("RESEND_UNAUTHORIZED");
    expect(logged).toContain('"status":403');
    expect(logged).not.toContain("secret-token-value");
    expect(logged).not.toContain("re_test_secret_key");
    expect(logged).not.toContain("user@example.com");
    expect(logged).not.toContain("Domain not verified");
    errorSpy.mockRestore();
  });
});
