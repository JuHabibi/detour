import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryFilter } from "@/features/home/components/explorer/CategoryFilter";

describe("CategoryFilter", () => {
  it("conserve les boutons Explorer par défaut", () => {
    const html = renderToStaticMarkup(
      createElement(CategoryFilter, {
        category: "tout",
        onCategoryChange: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Filtrer par catégorie"');
    expect(html).toContain("Musique");
    expect(html).not.toContain("<select");
  });

  it("propose un menu compact Détour sans select natif", () => {
    const html = renderToStaticMarkup(
      createElement(CategoryFilter, {
        category: "tout",
        onCategoryChange: () => undefined,
        presentation: "menu",
        allLabel: "Toutes les catégories",
      }),
    );

    expect(html).toContain("Catégorie");
    expect(html).toContain("Toutes les catégories");
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).not.toContain("<select");
  });
});
