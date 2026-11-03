// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
    role?: string;
    onClick?: () => void;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

describe("HeaderAccountMenu — paramètres", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("expose Paramètres du compte vers /account/settings, conserve Se déconnecter", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        createElement(HeaderAccountMenu, {
          user: { name: "Julien", email: "j@exemple.fr" },
        }),
      );
    });

    act(() => {
      container
        .querySelector("button[aria-haspopup='menu']")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const settings = container.querySelector(
      'a[href="/account/settings"]',
    );
    expect(settings?.textContent).toMatch(/Paramètres du compte/i);
    expect(container.textContent).toMatch(/Se déconnecter/i);
    expect(container.textContent).not.toMatch(/Mes carnets/i);
  });
});
