import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { deleteUser: vi.fn() },
}));

import { AccountSettings } from "@/features/account/components/AccountSettings";

describe("AccountSettings", () => {
  it("affiche nom et email en lecture seule, avec la zone sensible", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSettings, {
        name: "Julien Habibi",
        email: "j@exemple.fr",
        requiresPasswordForDelete: true,
      }),
    );
    expect(html).toContain("Paramètres.");
    expect(html).toContain("Julien Habibi");
    expect(html).toContain("j@exemple.fr");
    expect(html).toContain("Zone sensible");
    expect(html).toContain("Supprimer mon compte");
    expect(html).not.toContain("<input");
  });
});
