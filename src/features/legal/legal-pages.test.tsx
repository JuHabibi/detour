import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  CONFIDENTIALITE_SEO,
  MENTIONS_LEGALES_SEO,
} from "@/config/legal";
import { ConfidentialitePage } from "@/features/legal/components/ConfidentialitePage";
import { MentionsLegalesPage } from "@/features/legal/components/MentionsLegalesPage";
import {
  buildConfidentialiteMetadata,
  buildMentionsLegalesMetadata,
} from "@/features/legal/legal-seo";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => createElement("header", { "data-testid": "header" }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

describe("pages légales", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("métadonnées mentions + confidentialité (title, description, canonical)", () => {
    const mentions = buildMentionsLegalesMetadata();
    expect(mentions.title).toBe(MENTIONS_LEGALES_SEO.title);
    expect(mentions.description).toBe(MENTIONS_LEGALES_SEO.description);
    expect(mentions.alternates).toEqual({
      canonical: MENTIONS_LEGALES_SEO.canonicalPath,
    });

    const privacy = buildConfidentialiteMetadata();
    expect(privacy.title).toBe(CONFIDENTIALITE_SEO.title);
    expect(privacy.description).toBe(CONFIDENTIALITE_SEO.description);
    expect(privacy.alternates).toEqual({
      canonical: CONFIDENTIALITE_SEO.canonicalPath,
    });
  });

  it("footer expose Mentions légales et Confidentialité", () => {
    const footer = renderToStaticMarkup(createElement(SiteFooter));
    expect(footer).toContain('href="/mentions-legales"');
    expect(footer).toContain("Mentions légales");
    expect(footer).toContain('href="/confidentialite"');
    expect(footer).toContain("Confidentialité");
  });

  it("confidentialité : responsable, contact effectif, PostHog inactif", () => {
    const html = renderToStaticMarkup(createElement(ConfidentialitePage));
    expect(html).toContain("Julien Habibi");
    expect(html).toContain("detour.orleans@gmail.com");
    expect(html).toContain("Better Auth");
    expect(html).toContain("PostHog n’est plus initialisé");
    expect(html).not.toContain("TODO");
  });

  it("mentions : régime non professionnel, hébergeur, sans adresse personnelle", () => {
    const html = renderToStaticMarkup(createElement(MentionsLegalesPage));
    expect(html).toContain("titre non professionnel");
    expect(html).toContain("Vercel Inc.");
    expect(html).toContain("440 N Barranca Ave #4133");
    expect(html).toContain("detour.orleans@gmail.com");
    expect(html).toContain("article 1-1");
    // Identité RT dans la privacy, pas d’adresse perso ici.
    expect(html).not.toContain("Julien Habibi");
    expect(html).not.toContain("TODO");
    expect(html).not.toContain("À compléter");
  });

  it("mentions légales : 404 si configuration absente", async () => {
    vi.doMock("@/config/legal", async () => {
      const actual = await vi.importActual<typeof import("@/config/legal")>(
        "@/config/legal",
      );
      return {
        ...actual,
        legalPublisher: null,
        isLegalPublisherReady: () => false,
      };
    });
    const { MentionsLegalesPage: Page } = await import(
      "@/features/legal/components/MentionsLegalesPage"
    );
    expect(() => renderToStaticMarkup(createElement(Page))).toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
