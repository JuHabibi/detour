import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

import { AccountDeleted } from "@/features/account/components/AccountDeleted";
import {
  DELETE_ACCOUNT_DIRECT_ACCESS,
  DELETE_ACCOUNT_INVALID_LINK,
} from "@/features/account/components/auth/account-delete-feedback";

describe("AccountDeleted", () => {
  it("affiche la confirmation lorsque le statut flash est success", () => {
    const html = renderToStaticMarkup(
      createElement(AccountDeleted, { status: "success" }),
    );
    expect(html).toContain("Compte supprimé.");
    expect(html).toContain("définitivement effacés");
  });

  it("affiche le message lien invalide", () => {
    const html = renderToStaticMarkup(
      createElement(AccountDeleted, { status: "invalid" }),
    );
    expect(html).toContain("Lien invalide.");
    expect(html).toContain(DELETE_ACCOUNT_INVALID_LINK);
    expect(html).not.toContain("Compte supprimé.");
  });

  it("accès direct (unknown) : pas de faux succès", () => {
    const html = renderToStaticMarkup(createElement(AccountDeleted));
    expect(html).toContain("Suppression de compte.");
    expect(html).toContain(DELETE_ACCOUNT_DIRECT_ACCESS);
    expect(html).not.toContain("Compte supprimé.");
    expect(html).not.toContain("définitivement effacés");
  });
});
