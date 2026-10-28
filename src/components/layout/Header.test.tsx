import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Header,
  closeMobileMenuOnEscape,
} from "@/components/layout/Header";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
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

describe("Header — visiteur", () => {
  it("Radar · Explorer · Se connecter — pas de cœur ni liens compte", () => {
    const html = renderToStaticMarkup(
      createElement(Header, { favoriteCount: 0 }),
    );
    expect(html).toContain(">Radar<");
    expect(html).toContain('href="/"');
    expect(html).toContain("Explorer");
    expect(html).toContain('href="/explorer"');
    expect(html).toContain("Se connecter");
    expect(html).toContain('href="/account"');
    expect(html).toContain("Ouvrir le menu");
    expect(html).not.toContain("Mes carnets");
    expect(html).not.toContain("Mon parcours");
    expect(html).not.toContain("Voir mes favoris");
    expect(html).not.toContain("/account#favoris");
    expect(html).not.toContain("Menu compte");
    expect(html).not.toContain("Sur le radar");
    expect(html).not.toContain("Mon parcours culturel");
  });

  it("logo depuis Explorer pointe vers la Home", () => {
    const html = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 0,
        homeHref: "/",
      }),
    );
    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="#top"');
  });
});

describe("Header — connecté", () => {
  it("Radar · Explorer · Mes carnets · Mon parcours · ♡ · avatar", () => {
    const html = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 2,
        user: { name: "Julien Habibi", email: "j@exemple.fr" },
      }),
    );
    expect(html).toContain(">Radar<");
    expect(html).toContain("Explorer");
    expect(html).toContain("Mes carnets");
    expect(html).toContain('href="/account"');
    expect(html).toContain("Mon parcours");
    expect(html).toContain('href="/frise"');
    expect(html).toContain("Voir mes 2 favoris");
    expect(html).toContain('href="/account#favoris"');
    expect(html).toContain("Menu compte — Julien Habibi");
    expect(html).toContain("JH");
    expect(html).not.toContain("Se connecter");
    expect(html).not.toContain("Sur le radar");
    expect(html).not.toContain("Mon parcours culturel");
  });

  it("cœur filled + badge quand favoriteCount > 0 ; masqué à 0", () => {
    const withFavs = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 3,
        user: { name: "A", email: "a@exemple.fr" },
      }),
    );
    expect(withFavs).toContain("fill-coral stroke-coral");
    expect(withFavs).toContain("opacity-100");
    expect(withFavs).toContain(">3<");

    const empty = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 0,
        user: { name: "A", email: "a@exemple.fr" },
      }),
    );
    expect(empty).toContain("Voir mes favoris");
    expect(empty).toContain("opacity-0");
    expect(empty).not.toContain("fill-coral stroke-coral");
  });
});

describe("HeaderAccountMenu", () => {
  it("menu minimal : e-mail + déconnexion, sans liens carnets/favoris", () => {
    const html = renderToStaticMarkup(
      createElement(HeaderAccountMenu, {
        user: { name: "Julien Habibi", email: "j@exemple.fr" },
      }),
    );
    // Menu fermé par défaut — ouvrir via markup du bouton seulement
    expect(html).toContain("Menu compte — Julien Habibi");
    expect(html).toContain("JH");
    expect(html).not.toContain("Mes carnets");
    expect(html).not.toContain("Mes favoris");
    expect(html).not.toContain('href="/account#favoris"');
  });
});

describe("closeMobileMenuOnEscape", () => {
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
