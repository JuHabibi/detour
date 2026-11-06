import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  CONFIDENTIALITE_SEO,
  MENTIONS_LEGALES_SEO,
} from "@/config/legal";
import type { LegalPublisher } from "@/config/legal-publisher";
import { ConfidentialitePage } from "@/features/legal/components/ConfidentialitePage";
import {
  buildConfidentialiteMetadata,
  buildMentionsLegalesMetadata,
} from "@/features/legal/legal-seo";

const samplePublisher: LegalPublisher = {
  name: "Exemple Éditeur",
  legalStatus: null,
  registrationNumber: null,
  addressLines: null,
  email: "contact@exemple.fr",
  publicationDirector: null,
};

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
    expect(footer).toContain('href="/"');
    expect(footer).toContain('href="/explorer"');
    expect(footer).toContain('href="/orleans/ce-week-end"');
  });

  it("confidentialité décrit comptes, cookies nécessaires et PostHog inactif", () => {
    const html = renderToStaticMarkup(createElement(ConfidentialitePage));
    expect(html).toContain("Confidentialité");
    expect(html).toContain("Compte");
    expect(html).toContain("Better Auth");
    expect(html).toContain("PostHog n’est plus initialisé");
    expect(html).toContain("Vercel Inc.");
    expect(html).toContain("Resend");
  });

  it("mentions légales : 404 si éditeur non configuré", async () => {
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
    const { MentionsLegalesPage } = await import(
      "@/features/legal/components/MentionsLegalesPage"
    );
    expect(() =>
      renderToStaticMarkup(createElement(MentionsLegalesPage)),
    ).toThrow("NEXT_NOT_FOUND");
  });

  it("mentions légales : contenu réel si éditeur configuré", async () => {
    vi.doMock("@/config/legal", async () => {
      const actual = await vi.importActual<typeof import("@/config/legal")>(
        "@/config/legal",
      );
      return {
        ...actual,
        legalPublisher: samplePublisher,
        isLegalPublisherReady: () => true,
      };
    });
    const { MentionsLegalesPage } = await import(
      "@/features/legal/components/MentionsLegalesPage"
    );
    const html = renderToStaticMarkup(createElement(MentionsLegalesPage));
    expect(html).toContain("Mentions légales");
    expect(html).toContain("Exemple Éditeur");
    expect(html).toContain("contact@exemple.fr");
    expect(html).toContain("Vercel Inc.");
    expect(html).not.toContain("TODO");
    expect(html).not.toContain("À compléter");
  });
});
