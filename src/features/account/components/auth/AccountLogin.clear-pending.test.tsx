// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountLogin } from "@/features/account/components/auth/AccountLogin";
import {
  clearPendingFavoriteIntent,
  PENDING_FAVORITE_STORAGE_KEY,
  readPendingFavoriteIntent,
  savePendingFavoriteIntent,
} from "@/lib/pending-favorite";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    className?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

vi.mock("next/image", () => ({
  default: function MockImage() {
    return createElement("img", { alt: "" });
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
  },
}));

describe("AccountLogin — intention abandonnée", () => {
  beforeEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
  });

  it("efface sessionStorage sur login classique sans addFavorite", async () => {
    savePendingFavoriteIntent("abandoned", "/");
    expect(sessionStorage.getItem(PENDING_FAVORITE_STORAGE_KEY)).toBeTruthy();

    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(AccountLogin, {
          nextPath: "/account",
          googleEnabled: true,
        }),
      );
      await Promise.resolve();
    });

    expect(readPendingFavoriteIntent()).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("conserve / réécrit l’intention quand next porte addFavorite", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(AccountLogin, {
          nextPath: "/explorer?addFavorite=keep-me",
        }),
      );
      await Promise.resolve();
    });

    expect(readPendingFavoriteIntent()?.eventId).toBe("keep-me");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
