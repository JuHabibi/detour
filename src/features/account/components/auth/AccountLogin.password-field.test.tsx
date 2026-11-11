// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountLogin } from "@/features/account/components/auth/AccountLogin";
import { clearPendingFavoriteIntent } from "@/lib/pending-favorite";

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

describe("AccountLogin — champ mot de passe", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    clearPendingFavoriteIntent();
  });

  it("place le lien oublié sous le champ, aligné à droite", () => {
    act(() => {
      root.render(
        createElement(AccountLogin, {
          showForgotPassword: true,
        }),
      );
    });

    const password = container.querySelector(
      "#account-login-password",
    ) as HTMLInputElement;
    const forgot = container.querySelector(
      'a[href="/account/forgot-password"]',
    ) as HTMLAnchorElement;

    expect(password).toBeTruthy();
    expect(password.type).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
    expect(password.getAttribute("placeholder")).toBeNull();
    expect(forgot).toBeTruthy();
    expect(forgot.textContent).toContain("Mot de passe oublié ?");
    expect(
      forgot.compareDocumentPosition(password) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(forgot.parentElement?.className).toContain("text-right");
  });
});
