// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteAuthModal } from "@/components/favorites/FavoriteAuthModal";
import {
  clearPendingFavoriteIntent,
  PENDING_FAVORITE_STORAGE_KEY,
  readPendingFavoriteIntent,
} from "@/lib/pending-favorite";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) {
    return createElement("a", { href, onClick, ...rest }, children);
  },
}));

vi.mock("@/lib/use-stacked-dialog-lifecycle", () => ({
  useStackedDialogLifecycle: () => undefined,
}));

describe("FavoriteAuthModal — intention pending", () => {
  beforeEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
  });

  it("n’écrit pas sessionStorage à l’ouverture seule", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(FavoriteAuthModal, {
          eventId: "openagenda:stale",
          returnPath: "/",
          onClose: () => undefined,
        }),
      );
    });

    expect(sessionStorage.getItem(PENDING_FAVORITE_STORAGE_KEY)).toBeNull();
    expect(readPendingFavoriteIntent()).toBeNull();
    expect(container.innerHTML).toContain("addFavorite");
    expect(container.innerHTML).toContain("/account/login?next=");
    expect(container.innerHTML).toContain("/account/signup?next=");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("persiste l’intention au clic login/signup volontaire", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(FavoriteAuthModal, {
          eventId: "e-commit",
          returnPath: "/explorer",
          onClose: () => undefined,
        }),
      );
    });

    const login = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("J’ai déjà un compte"),
    );
    expect(login).toBeTruthy();

    act(() => {
      login?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(readPendingFavoriteIntent()?.eventId).toBe("e-commit");
    expect(readPendingFavoriteIntent()?.returnPath).toContain(
      "addFavorite=e-commit",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("efface l’intention à la fermeture (annulation)", () => {
    sessionStorage.setItem(
      PENDING_FAVORITE_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        eventId: "e-cancel",
        returnPath: "/?addFavorite=e-cancel",
        updatedAt: new Date().toISOString(),
      }),
    );

    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(FavoriteAuthModal, {
          eventId: "e-cancel",
          returnPath: "/",
          onClose,
        }),
      );
    });

    const close = container.querySelector(
      'button[aria-label="Fermer la fenêtre"]',
    );
    act(() => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(readPendingFavoriteIntent()).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
