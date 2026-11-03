// @vitest-environment happy-dom

import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDangerZone } from "@/features/account/components/AccountDangerZone";
import { DELETE_ACCOUNT_EMAIL_SENT } from "@/features/account/components/auth/account-delete-feedback";
import { authClient } from "@/lib/auth-client";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    deleteUser: vi.fn(),
  },
}));

describe("AccountDangerZone", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.mocked(authClient.deleteUser).mockReset();
  });

  function mount(requiresPassword: boolean) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        createElement(AccountDangerZone, { requiresPassword }),
      );
    });
  }

  it("annulation : aucune requête de suppression", () => {
    mount(false);

    const open = container.querySelector("button");
    expect(open?.textContent).toMatch(/Supprimer définitivement/i);
    act(() => {
      open?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const cancel = Array.from(container.querySelectorAll("button")).find((b) =>
      /Annuler/i.test(b.textContent ?? ""),
    );
    act(() => {
      cancel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(authClient.deleteUser).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("compte Google : envoie deleteUser sans password, puis statut email", async () => {
    vi.mocked(authClient.deleteUser).mockResolvedValue({
      data: { success: true, message: "Verification email sent" },
      error: null,
    } as never);

    mount(false);

    act(() => {
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const submit = Array.from(container.querySelectorAll("button")).find((b) =>
      /Envoyer le lien de confirmation/i.test(b.textContent ?? ""),
    );
    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(authClient.deleteUser).toHaveBeenCalledWith({
      callbackURL: "/account/deleted",
    });
    expect(container.textContent).toContain(DELETE_ACCOUNT_EMAIL_SENT);
  });

  it("compte credential : exige le mot de passe et ne montre pas de succès si erreur", async () => {
    vi.mocked(authClient.deleteUser).mockResolvedValue({
      data: null,
      error: { code: "INVALID_PASSWORD", message: "Invalid password" },
    } as never);

    mount(true);

    act(() => {
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const submit = Array.from(container.querySelectorAll("button")).find((b) =>
      /Envoyer le lien de confirmation/i.test(b.textContent ?? ""),
    );
    expect(submit?.hasAttribute("disabled") || (submit as HTMLButtonElement).disabled).toBe(
      true,
    );

    const password = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(password, "wrong-password");
      password.dispatchEvent(new Event("input", { bubbles: true }));
      password.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(authClient.deleteUser).toHaveBeenCalledWith({
      password: "wrong-password",
      callbackURL: "/account/deleted",
    });
    expect(container.textContent).toMatch(/Mot de passe incorrect/i);
    expect(container.textContent).not.toContain(DELETE_ACCOUNT_EMAIL_SENT);
  });
});
