import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/_server/get-account-auth-state", () => ({
  getAccountAuthState: vi.fn(),
}));

vi.mock("@/infrastructure/db/favorite.repository", () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavoriteEventIdsForUser: vi.fn(),
}));

import { getAccountAuthState } from "@/app/_server/get-account-auth-state";
import {
  addFavorite,
  listMyFavoriteEventIds,
  removeFavorite,
} from "@/app/actions/favorites";
import * as favoriteRepository from "@/infrastructure/db/favorite.repository";

describe("favorites actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listMyFavoriteEventIds unauthenticated → pas de repository", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    });

    await expect(listMyFavoriteEventIds()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(favoriteRepository.listFavoriteEventIdsForUser).not.toHaveBeenCalled();
  });

  it("listMyFavoriteEventIds authenticated → IDs scopés session", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "a@exemple.fr",
        name: "A",
      },
    });
    vi.mocked(favoriteRepository.listFavoriteEventIdsForUser).mockResolvedValue([
      "openagenda:1",
    ]);

    await expect(listMyFavoriteEventIds()).resolves.toEqual({
      ok: true,
      eventIds: ["openagenda:1"],
    });
    expect(favoriteRepository.listFavoriteEventIdsForUser).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(listMyFavoriteEventIds.length).toBe(0);
  });

  it("unauthenticated → ne persiste pas et n’appelle pas le repository", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "unauthenticated",
    });

    await expect(addFavorite("openagenda:1")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(favoriteRepository.addFavorite).not.toHaveBeenCalled();
  });

  it("authenticated → addFavorite utilise userId session, jamais un userId client", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "a@exemple.fr",
        name: "A",
      },
    });
    vi.mocked(favoriteRepository.addFavorite).mockResolvedValue(undefined);

    await expect(addFavorite("openagenda:1")).resolves.toEqual({ ok: true });

    expect(favoriteRepository.addFavorite).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "openagenda:1",
    );
    // Signature publique : (eventId) uniquement — pas de userId en argument.
    expect(addFavorite.length).toBe(1);
  });

  it("BOLA : removeFavorite de B ne cible que le userId de B", async () => {
    vi.mocked(getAccountAuthState).mockResolvedValue({
      status: "authenticated",
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "b@exemple.fr",
        name: "B",
      },
    });
    vi.mocked(favoriteRepository.removeFavorite).mockResolvedValue(false);

    await expect(removeFavorite("openagenda:1")).resolves.toEqual({
      ok: true,
    });

    expect(favoriteRepository.removeFavorite).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      "openagenda:1",
    );
    expect(removeFavorite.length).toBe(1);
  });

  it("eventId vide → invalid", async () => {
    await expect(addFavorite("   ")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(getAccountAuthState).not.toHaveBeenCalled();
  });
});
