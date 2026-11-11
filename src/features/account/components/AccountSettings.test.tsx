import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { deleteUser: vi.fn() },
}));

vi.mock("@/features/personalization/AccountPreferencesSection", () => ({
  AccountPreferencesSection: () =>
    createElement(
      "section",
      { "aria-label": "Mes préférences culturelles" },
      "Mes préférences culturelles",
    ),
}));

import { AccountSettings } from "@/features/account/components/AccountSettings";

describe("AccountSettings", () => {
  it("affiche nom et email en lecture seule, avec préférences et zone sensible", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSettings, {
        userId: "11111111-1111-4111-8111-111111111111",
        name: "Julien Habibi",
        email: "j@exemple.fr",
        requiresPasswordForDelete: true,
      }),
    );
    expect(html).toContain("Paramètres.");
    expect(html).toContain("Julien Habibi");
    expect(html).toContain("j@exemple.fr");
    expect(html).toContain("Mes préférences culturelles");
    expect(html).toContain("Zone sensible");
    expect(html).toContain("Supprimer mon compte");
    expect(html).not.toContain("<input");
  });
});
