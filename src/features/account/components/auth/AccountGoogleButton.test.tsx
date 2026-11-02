// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountGoogleButton } from "@/features/account/components/auth/AccountGoogleButton";
import { authClient } from "@/lib/auth-client";
import {
  PENDING_FAVORITE_STORAGE_KEY,
  readPendingFavoriteIntent,
} from "@/lib/pending-favorite";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

describe("AccountGoogleButton", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.mocked(authClient.signIn.social).mockReset();
  });

  it("persiste le favori pending et appelle signIn.social avec callbackURL/next", async () => {
    vi.mocked(authClient.signIn.social).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;
    const onError = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(AccountGoogleButton, {
          nextPath: "/explorer?addFavorite=openagenda:7",
          variant: "login",
          onError,
        }),
      );
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Continuer avec Google");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/explorer?addFavorite=openagenda:7",
      errorCallbackURL:
        "/account/login?next=%2Fexplorer%3FaddFavorite%3Dopenagenda%3A7",
    });
    expect(readPendingFavoriteIntent()?.eventId).toBe("openagenda:7");
    expect(sessionStorage.getItem(PENDING_FAVORITE_STORAGE_KEY)).toBeTruthy();
    expect(onError).toHaveBeenCalledWith("");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("sur signup, errorCallbackURL conserve next pour le retour OAuth", async () => {
    vi.mocked(authClient.signIn.social).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(AccountGoogleButton, {
          nextPath: "/?addFavorite=e9",
          variant: "signup",
          onError: vi.fn(),
        }),
      );
    });

    await act(async () => {
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/?addFavorite=e9",
      errorCallbackURL: "/account/signup?next=%2F%3FaddFavorite%3De9",
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
