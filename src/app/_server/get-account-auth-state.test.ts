import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/infrastructure/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { headers } from "next/headers";
import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import { auth } from "@/infrastructure/auth/auth";

describe("getAccountAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
  });

  it("passe disableCookieCache pour lire emailVerified frais", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await getAccountAuthState();

    expect(auth.api.getSession).toHaveBeenCalledWith({
      headers: expect.anything(),
      query: { disableCookieCache: true },
    });
  });

  it("retourne unauthenticated sans session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await expect(getAccountAuthState()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("mappe la session Better Auth vérifiée vers un DTO plat", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "camille@exemple.fr",
        name: "Camille R.",
        emailVerified: true,
      },
      session: { id: "sess" },
    } as never);

    await expect(getAccountAuthState()).resolves.toEqual({
      status: "authenticated",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "camille@exemple.fr",
        name: "Camille R.",
      },
    });
  });

  it("refuse une session dont l’email n’est pas vérifié", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "camille@exemple.fr",
        name: "Camille R.",
        emailVerified: false,
      },
      session: { id: "sess" },
    } as never);

    await expect(getAccountAuthState()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("fallback name → email si name vide", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "seul@exemple.fr",
        name: "  ",
        emailVerified: true,
      },
      session: { id: "sess" },
    } as never);

    const state = await getAccountAuthState();
    expect(state).toEqual({
      status: "authenticated",
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "seul@exemple.fr",
        name: "seul@exemple.fr",
      },
    });
  });

  it("unauthenticated si email manquant", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "",
        name: "X",
        emailVerified: true,
      },
      session: { id: "sess" },
    } as never);

    await expect(getAccountAuthState()).resolves.toEqual({
      status: "unauthenticated",
    });
  });
});
