// @vitest-environment happy-dom

import { createElement, act, useState, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPasswordField } from "@/features/account/components/auth/AccountPasswordField";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function PasswordFieldHarness({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [password, setPassword] = useState("secret123");

  return createElement(
    "form",
    { onSubmit },
    createElement(AccountPasswordField, {
      id: "test-password",
      name: "password",
      label: "Mot de passe",
      autoComplete: "current-password",
      required: true,
      minLength: 8,
      value: password,
      onChange: (event) => setPassword(event.target.value),
    }),
    createElement("button", { type: "submit" }, "Envoyer"),
  );
}

describe("AccountPasswordField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("masque le mot de passe par défaut et bascule la visibilité", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    act(() => {
      root.render(createElement(PasswordFieldHarness, { onSubmit }));
    });

    const input = container.querySelector(
      "#test-password",
    ) as HTMLInputElement;
    const toggle = container.querySelector(
      'button[aria-label="Afficher le mot de passe"]',
    ) as HTMLButtonElement;

    expect(input.type).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("current-password");
    expect(input.getAttribute("placeholder")).toBeNull();
    expect(toggle.type).toBe("button");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-label")).toBe("Masquer le mot de passe");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-label")).toBe("Afficher le mot de passe");
  });

  it("ne soumet pas le formulaire au clic sur le toggle", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    act(() => {
      root.render(createElement(PasswordFieldHarness, { onSubmit }));
    });

    const toggle = container.querySelector(
      'button[type="button"]',
    ) as HTMLButtonElement;

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
