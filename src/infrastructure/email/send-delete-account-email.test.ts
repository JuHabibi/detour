import { describe, expect, it, vi } from "vitest";
import { sendDeleteAccountEmailMessage } from "@/infrastructure/email/send-delete-account-email";

describe("sendDeleteAccountEmailMessage", () => {
  it("poste vers Resend avec un corps explicite, sans journaliser l’URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendDeleteAccountEmailMessage({
      to: "user@example.com",
      deleteUrl:
        "https://detour.website/api/auth/delete-user/callback?token=secret-token-value&callbackURL=%2Faccount%2Fdeleted",
      config: {
        apiKey: "re_test",
        from: "Détour <noreply@detour.website>",
      },
      fetchImpl,
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
        text: expect.stringContaining("secret-token-value"),
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("événements culturels publics"),
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("échoue sans journaliser destinataire ni jeton", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ message: "Domain not verified" }), {
          status: 403,
        }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendDeleteAccountEmailMessage({
        to: "user@example.com",
        deleteUrl:
          "https://detour.website/api/auth/delete-user/callback?token=secret-token-value",
        config: {
          apiKey: "re_test",
          from: "Détour <noreply@detour.website>",
        },
        fetchImpl,
      }),
    ).rejects.toThrow(/Failed to send/);

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("user@example.com");
    expect(logged).not.toContain("secret-token-value");
    errorSpy.mockRestore();
  });
});
