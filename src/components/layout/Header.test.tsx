import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/layout/Header";

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
});
