// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountLoginEmailVerificationPanel } from "@/features/account/components/auth/AccountLoginEmailVerificationPanel";
import {
  EMAIL_VERIFICATION_OPS_ERROR,
  EMAIL_VERIFICATION_REQUIRED_TITLE,
  EMAIL_VERIFICATION_SENT_LEAD,
} from "@/features/account/components/auth/account-email-verification-feedback";
import { authClient } from "@/lib/auth-client";
import {
  clearPendingFavoriteIntent,
  readPendingFavoriteIntent,
} from "@/lib/pending-favorite";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: vi.fn(),
  },
}));

describe("AccountLoginEmailVerificationPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChangeEmail = vi.fn();

  beforeEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
    onChangeEmail.mockReset();
    vi.mocked(authClient.sendVerificationEmail).mockReset();
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

  function renderPanel() {
    act(() => {
      root.render(
        createElement(AccountLoginEmailVerificationPanel, {
          email: "camille@exemple.fr",
          nextPath: "/explorer?addFavorite=e9",
          onChangeEmail,
        }),
      );
    });
  }

  it("est informatif : titre, email, pas d’alerte avant envoi", () => {
    renderPanel();
    expect(container.textContent).toContain(EMAIL_VERIFICATION_REQUIRED_TITLE);
    expect(container.textContent).toContain("camille@exemple.fr");
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain(EMAIL_VERIFICATION_SENT_LEAD);
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("envoie via l’API puis affiche succès ; libellé passe à Renvoyer", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({
      data: { status: true },
      error: null,
    } as never);
    renderPanel();

    const sendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Envoyer un lien de confirmation",
    );
    expect(sendBtn).toBeTruthy();

    await act(async () => {
      sendBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "camille@exemple.fr",
      callbackURL:
        "/account/verify-email?confirmed=1&next=%2Fexplorer%3FaddFavorite%3De9",
    });
    expect(container.textContent).toContain(EMAIL_VERIFICATION_SENT_LEAD);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (b) => b.textContent === "Renvoyer",
      ),
    ).toBe(true);
    expect(readPendingFavoriteIntent()?.eventId).toBe("e9");
  });

  it("en cas d’échec API : alerte ops, pas de message d’envoi", async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({
      data: null,
      error: { message: "unavailable", status: 503 },
    } as never);
    renderPanel();

    const sendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Envoyer un lien de confirmation",
    )!;

    await act(async () => {
      sendBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain(EMAIL_VERIFICATION_OPS_ERROR);
    expect(container.textContent).not.toContain(EMAIL_VERIFICATION_SENT_LEAD);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      EMAIL_VERIFICATION_OPS_ERROR,
    );
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (b) => b.textContent === "Envoyer un lien de confirmation",
      ),
    ).toBe(true);
  });

  it("lie la page verify-email et permet de modifier l’adresse", () => {
    renderPanel();
    const link = container.querySelector(
      'a[href*="/account/verify-email"]',
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("email=camille%40exemple.fr");
    expect(link.getAttribute("href")).toContain(
      "next=%2Fexplorer%3FaddFavorite%3De9",
    );

    const changeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Modifier l’adresse",
    )!;
    act(() => {
      changeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChangeEmail).toHaveBeenCalledOnce();
  });
});
