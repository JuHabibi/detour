import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Header,
  closeMobileMenuOnEscape,
} from "@/components/layout/Header";
import { userInitials } from "@/components/layout/user-initials";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

describe("userInitials", () => {
  it("prend prénom + nom, sinon e-mail, sinon ?", () => {
    expect(userInitials("Julien Habibi", "j@exemple.fr")).toBe("JH");
    expect(userInitials("Julien", "j@exemple.fr")).toBe("JU");
    expect(userInitials("", "alice@exemple.fr")).toBe("AL");
    expect(userInitials("  ", "")).toBe("?");
  });
});

describe("Header", () => {
  it("non connecté : Se connecter, pas d’avatar ni de compteur", () => {
    const html = renderToStaticMarkup(
      createElement(Header, { favoriteCount: 0, showFriseNav: false }),
    );
    expect(html).toContain("Ouvrir le menu");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Sur le radar");
    expect(html).toContain('href="/"');
    expect(html).toContain("Explorer");
    expect(html).toContain('href="/explorer"');
    expect(html).not.toContain("Mon parcours culturel");
    expect(html).toContain("Se connecter");
    expect(html).not.toContain("Mon compte");
    expect(html).toContain('href="/account"');
    expect(html).toContain("Voir mes favoris");
    expect(html).not.toContain("Menu compte");
  });

  it("logo depuis Explorer pointe vers la Home", () => {
    const html = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 0,
        homeHref: "/",
        showFriseNav: false,
      }),
    );
    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="#top"');
  });

  it("connecté : parcours culturel, avatar, cœur vers #favoris", () => {
    const html = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 2,
        showFriseNav: true,
        user: { name: "Julien Habibi", email: "j@exemple.fr" },
      }),
    );
    expect(html).toContain("Mon parcours culturel");
    expect(html).toContain("Voir mes 2 favoris");
    expect(html).toContain('href="/account#favoris"');
    expect(html).toContain("Menu compte — Julien Habibi");
    expect(html).toContain("JH");
    expect(html).not.toContain("Mon compte");
    expect(html).not.toContain("Se connecter");
  });

  it("Échap restaure le focus puis ferme ; les autres touches n’agissent pas", () => {
    const restoreFocus = vi.fn();
    const close = vi.fn();
    const preventDefault = vi.fn();

    expect(
      closeMobileMenuOnEscape(
        { key: "Enter", preventDefault },
        restoreFocus,
        close,
      ),
    ).toBe(false);
    expect(restoreFocus).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    expect(
      closeMobileMenuOnEscape(
        { key: "Escape", preventDefault },
        restoreFocus,
        close,
      ),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(restoreFocus.mock.invocationCallOrder[0]).toBeLessThan(
      close.mock.invocationCallOrder[0]!,
    );
  });
});
