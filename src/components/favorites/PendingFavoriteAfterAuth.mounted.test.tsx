// @vitest-environment happy-dom

import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFavorite } from "@/app/actions/favorites";
import { PendingFavoriteAfterAuth } from "@/components/favorites/PendingFavoriteAfterAuth";
import {
  ADD_FAVORITE_PARAM,
  clearPendingFavoriteIntent,
  PENDING_FAVORITE_STORAGE_KEY,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const replace = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => searchParams,
}));

vi.mock("@/app/actions/favorites", () => ({
  addFavorite: vi.fn(),
}));

function mount(node: ReactNode): { unmount: () => void; container: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("PendingFavoriteAfterAuth monté", () => {
  beforeEach(() => {
    replace.mockReset();
    searchParams.delete(ADD_FAVORITE_PARAM);
    clearPendingFavoriteIntent();
    sessionStorage.clear();
    vi.mocked(addFavorite).mockReset();
  });

  afterEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
  });

  it("enregistre le favori pending et affiche la confirmation", async () => {
    searchParams.set(ADD_FAVORITE_PARAM, "openagenda:99");
    savePendingFavoriteIntent("openagenda:99", "/");
    vi.mocked(addFavorite).mockResolvedValue({ ok: true });

    const onFavoriteSaved = vi.fn();
    const { container, unmount } = mount(
      createElement(PendingFavoriteAfterAuth, {
        enabled: true,
        onFavoriteSaved,
      }),
    );

    await flushEffects();

    expect(addFavorite).toHaveBeenCalledWith("openagenda:99");
    expect(onFavoriteSaved).toHaveBeenCalledWith("openagenda:99");
    expect(container.textContent).toContain(
      "Événement enregistré dans vos favoris.",
    );
    expect(sessionStorage.getItem(PENDING_FAVORITE_STORAGE_KEY)).toBeNull();
    expect(replace).toHaveBeenCalledWith("/", { scroll: false });

    unmount();
  });

  it("affiche une erreur visible si l’enregistrement échoue", async () => {
    searchParams.set(ADD_FAVORITE_PARAM, "e-fail");
    vi.mocked(addFavorite).mockResolvedValue({
      ok: false,
      reason: "error",
    });

    const { container, unmount } = mount(
      createElement(PendingFavoriteAfterAuth, {
        enabled: true,
      }),
    );

    await flushEffects();

    expect(addFavorite).toHaveBeenCalledWith("e-fail");
    expect(container.textContent).toContain(
      "Impossible d’enregistrer ce détour. Réessayez depuis la fiche.",
    );

    unmount();
  });
});
