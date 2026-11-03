// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountLogin } from "@/features/account/components/auth/AccountLogin";
import { EMAIL_VERIFICATION_REQUIRED_TITLE } from "@/features/account/components/auth/account-email-verification-feedback";
import { authClient } from "@/lib/auth-client";
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
    sendVerificationEmail: vi.fn(),
  },
}));

/** Met à jour un input contrôlé React (happy-dom). */
function setInputValue(input: HTMLInputElement, value: string) {
  const tracker = (
    input as unknown as {
      _valueTracker?: { setValue: (v: string) => void };
    }
  )._valueTracker;
  const proto = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  proto?.set?.call(input, value);
  tracker?.setValue("");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("AccountLogin — bascule EMAIL_NOT_VERIFIED", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    clearPendingFavoriteIntent();
    sessionStorage.clear();
    vi.mocked(authClient.signIn.email).mockReset();
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

  it("remplace le formulaire par le panneau informatif (sans role=alert)", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    } as never);

    act(() => {
      root.render(
        createElement(AccountLogin, {
          nextPath: "/explorer?addFavorite=e9",
        }),
      );
    });

    const email = container.querySelector(
      'input[name="email"]',
    ) as HTMLInputElement;
    const password = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement;

    await act(async () => {
      setInputValue(email, "camille@exemple.fr");
      setInputValue(password, "password1");
      (
        container.querySelector("form") as HTMLFormElement
      ).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain(EMAIL_VERIFICATION_REQUIRED_TITLE);
    expect(container.textContent).toContain("camille@exemple.fr");
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled();

    const changeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Modifier l’adresse",
    )!;
    await act(async () => {
      changeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('input[name="email"]')).toBeTruthy();
    expect(
      (container.querySelector('input[name="email"]') as HTMLInputElement)
        .value,
    ).toBe("camille@exemple.fr");
  });
});
