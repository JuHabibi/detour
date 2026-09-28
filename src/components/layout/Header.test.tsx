import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Header,
  closeMobileMenuOnEscape,
} from "@/components/layout/Header";

describe("Header", () => {
  it("mobile menu markup : liens de base sans promenade si déconnecté", () => {
    const html = renderToStaticMarkup(
      createElement(Header, { favoriteCount: 0, showFriseNav: false }),
    );
    expect(html).toContain("Ouvrir le menu");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Sur le radar");
    expect(html).toContain("Explorer");
    expect(html).not.toContain("La promenade");
    expect(html).toContain('href="/account"');
    expect(html).toContain("Mes détours, 0 enregistré");
  });

  it("affiche La promenade quand showFriseNav", () => {
    const html = renderToStaticMarkup(
      createElement(Header, {
        favoriteCount: 2,
        showFriseNav: true,
        accountLabel: "Mon compte",
      }),
    );
    expect(html).toContain("La promenade");
    expect(html).toContain("Mes détours, 2 enregistrés");
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
