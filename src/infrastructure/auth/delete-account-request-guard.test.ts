import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELETE_ACCOUNT_PASSWORD_REQUIRED_CODE,
  deleteAccountOpsUnavailableResponse,
  isDeleteUserCallbackPath,
  isDeleteUserRequestPath,
  isUsableDeleteAccountPassword,
  runDeleteAccountRequestWithSendProbe,
  runDeleteUserPostWithCredentialGate,
  shouldBlockDeleteAccountBeforeAuth,
} from "@/infrastructure/auth/delete-account-request-guard";
import {
  markPasswordResetProviderUnavailable,
  passwordResetSendProbe,
  resetPasswordResetProviderCooldownForTests,
} from "@/infrastructure/email/password-reset-send-probe";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function deleteUserRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/delete-user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  resetPasswordResetProviderCooldownForTests();
});

describe("isDeleteUserRequestPath", () => {
  it("détecte uniquement le POST /delete-user", () => {
    expect(isDeleteUserRequestPath("/api/auth/delete-user")).toBe(true);
    expect(isDeleteUserRequestPath("/delete-user")).toBe(true);
    expect(isDeleteUserRequestPath("/api/auth/delete-user/")).toBe(true);
  });

  it("ignore le callback et les autres routes auth", () => {
    expect(isDeleteUserRequestPath("/api/auth/delete-user/callback")).toBe(
      false,
    );
    expect(isDeleteUserRequestPath("/api/auth/sign-out")).toBe(false);
    expect(isDeleteUserRequestPath("/api/auth/callback/google")).toBe(false);
  });
});

describe("isDeleteUserCallbackPath", () => {
  it("détecte le callback de confirmation", () => {
    expect(isDeleteUserCallbackPath("/api/auth/delete-user/callback")).toBe(
      true,
    );
    expect(isDeleteUserCallbackPath("/delete-user/callback")).toBe(true);
    expect(isDeleteUserCallbackPath("/api/auth/delete-user")).toBe(false);
  });
});

describe("shouldBlockDeleteAccountBeforeAuth", () => {
  it("ne bloque pas hors production", () => {
    expect(
      shouldBlockDeleteAccountBeforeAuth({ NODE_ENV: "development" }),
    ).toBe(false);
  });

  it("bloque en production sans Resend", () => {
    expect(
      shouldBlockDeleteAccountBeforeAuth({ NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("bloque en production pendant le cooldown provider", () => {
    markPasswordResetProviderUnavailable();
    expect(
      shouldBlockDeleteAccountBeforeAuth({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBe(true);
  });

  it("laisse passer en production si Resend est prêt", () => {
    expect(
      shouldBlockDeleteAccountBeforeAuth({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Détour <noreply@detour.website>",
      }),
    ).toBe(false);
  });
});

describe("runDeleteAccountRequestWithSendProbe", () => {
  it("renvoie 503 si la sonde signale un échec d’envoi", async () => {
    const response = await runDeleteAccountRequestWithSendProbe(async () => {
      const probe = passwordResetSendProbe.getStore();
      if (probe) probe.failed = true;
      return Response.json(
        { success: true, message: "Verification email sent" },
        { status: 200 },
      );
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("DELETE_ACCOUNT_PROVIDER_UNAVAILABLE");
  });

  it("laisse passer la réponse BA si l’envoi a réussi", async () => {
    const response = await runDeleteAccountRequestWithSendProbe(async () =>
      Response.json(
        { success: true, message: "Verification email sent" },
        { status: 200 },
      ),
    );
    expect(response.status).toBe(200);
  });
});

describe("deleteAccountOpsUnavailableResponse", () => {
  it("expose un message ops générique", async () => {
    const response = deleteAccountOpsUnavailableResponse();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/indisponible/i);
  });
});

describe("isUsableDeleteAccountPassword", () => {
  it("refuse absent, vide, espaces et non-string", () => {
    expect(isUsableDeleteAccountPassword(undefined)).toBe(false);
    expect(isUsableDeleteAccountPassword("")).toBe(false);
    expect(isUsableDeleteAccountPassword("   ")).toBe(false);
    expect(isUsableDeleteAccountPassword(null)).toBe(false);
    expect(isUsableDeleteAccountPassword(1)).toBe(false);
  });

  it("accepte une string non vide", () => {
    expect(isUsableDeleteAccountPassword("secret")).toBe(true);
  });
});

describe("runDeleteUserPostWithCredentialGate", () => {
  it("credential sans password : 400, BA non appelé", async () => {
    const handleAuth = vi.fn();
    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({ callbackURL: "/account/deleted" }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe(DELETE_ACCOUNT_PASSWORD_REQUIRED_CODE);
    expect(handleAuth).not.toHaveBeenCalled();
  });

  it("credential + password vide / espaces : 400, BA non appelé", async () => {
    for (const password of ["", "   "]) {
      const handleAuth = vi.fn();
      const response = await runDeleteUserPostWithCredentialGate({
        request: deleteUserRequest({
          password,
          callbackURL: "/account/deleted",
        }),
        getSessionUserId: async () => USER_ID,
        hasCredentialPassword: async () => true,
        handleAuth,
      });

      expect(response.status).toBe(400);
      expect(handleAuth).not.toHaveBeenCalled();
    }
  });

  it("credential + mauvais password : laisse BA répondre INVALID_PASSWORD", async () => {
    const handleAuth = vi.fn(async (request: Request) => {
      const body = (await request.json()) as { password?: string };
      expect(body.password).toBe("wrong-password");
      return Response.json(
        { message: "Invalid password", code: "INVALID_PASSWORD" },
        { status: 400 },
      );
    });

    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({
        password: "wrong-password",
        callbackURL: "/account/deleted",
      }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(handleAuth).toHaveBeenCalledOnce();
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("INVALID_PASSWORD");
  });

  it("credential + password correct : laisse BA envoyer l’email", async () => {
    const handleAuth = vi.fn(async (request: Request) => {
      const body = (await request.json()) as { password?: string };
      expect(body.password).toBe("correct-password");
      return Response.json(
        { success: true, message: "Verification email sent" },
        { status: 200 },
      );
    });

    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({
        password: "correct-password",
        callbackURL: "/account/deleted",
      }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(handleAuth).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("Verification email sent");
  });

  it("Google-only sans password : passe à BA (email obligatoire côté BA)", async () => {
    const handleAuth = vi.fn(async (request: Request) => {
      const body = (await request.json()) as { password?: string };
      expect(body.password).toBeUndefined();
      return Response.json(
        { success: true, message: "Verification email sent" },
        { status: 200 },
      );
    });

    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({ callbackURL: "/account/deleted" }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => false,
      handleAuth,
    });

    expect(handleAuth).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("multi-provider (credential+Google) sans password : 400", async () => {
    const handleAuth = vi.fn();
    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({ callbackURL: "/account/deleted" }),
      getSessionUserId: async () => USER_ID,
      // credential présent parmi les providers
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(response.status).toBe(400);
    expect(handleAuth).not.toHaveBeenCalled();
  });

  it("multi-provider avec password : passe à BA", async () => {
    const handleAuth = vi.fn(async () =>
      Response.json(
        { success: true, message: "Verification email sent" },
        { status: 200 },
      ),
    );

    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({
        password: "ok",
        callbackURL: "/account/deleted",
      }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(handleAuth).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("absence de session : ne déduit pas de userId, laisse BA gérer", async () => {
    const hasCredentialPassword = vi.fn();
    const handleAuth = vi.fn(async () =>
      Response.json(
        { message: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      ),
    );

    const response = await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({ callbackURL: "/account/deleted" }),
      getSessionUserId: async () => null,
      hasCredentialPassword,
      handleAuth,
    });

    expect(hasCredentialPassword).not.toHaveBeenCalled();
    expect(handleAuth).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
  });

  it("reconstruit une Request lisible pour Better Auth après lecture du body", async () => {
    const handleAuth = vi.fn(async (request: Request) => {
      // Doit pouvoir relire le body (pas de body consommé).
      const body = (await request.json()) as {
        password: string;
        callbackURL: string;
      };
      expect(body).toEqual({
        password: "correct-password",
        callbackURL: "/account/deleted",
      });
      return Response.json({ success: true }, { status: 200 });
    });

    await runDeleteUserPostWithCredentialGate({
      request: deleteUserRequest({
        password: "correct-password",
        callbackURL: "/account/deleted",
      }),
      getSessionUserId: async () => USER_ID,
      hasCredentialPassword: async () => true,
      handleAuth,
    });

    expect(handleAuth).toHaveBeenCalledOnce();
  });
});
