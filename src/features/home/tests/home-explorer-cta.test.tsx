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
    children?: string | ReturnType<typeof createElement> | null;
    className?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

import { HomeExplorerCta } from "@/features/home/components/HomeExplorerCta";

describe("HomeExplorerCta", () => {
  it("contraste sélection Radar vs recherche libre", () => {
    const html = renderToStaticMarkup(createElement(HomeExplorerCta));

    expect(html).toContain("Cherchez librement parmi les sorties.");
    expect(html).toContain("sélection du Radar");
    expect(html).toContain('href="/explorer"');
    expect(html).toContain("Explorer les sorties");
    expect(html).not.toContain("Trouvez votre prochaine sortie autour d’Orléans.");
  });
});
