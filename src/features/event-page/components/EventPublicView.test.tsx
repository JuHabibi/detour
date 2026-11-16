import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EventItem } from "@/data/types";
import { EventPublicView } from "@/features/event-page/components/EventPublicView";
import { EventDetailModal } from "@/components/event/EventDetailModal";

vi.mock("next/image", () => ({
  default: function MockImage(props: {
    alt?: string;
    src?: string | { src: string };
  }) {
    const src = typeof props.src === "string" ? props.src : props.src?.src ?? "";
    return createElement("img", { alt: props.alt ?? "", src });
  },
}));

function item(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "openagenda:1",
    title: "Concert test",
    category: "Musique",
    genre: "",
    venue: "Scène",
    city: "Orléans",
    date: "2026-11-10",
    dateLabel: "Mardi 10 novembre",
    time: "20h00",
    description: "<p>Soirée <em>live</em></p>",
    source: "OpenAgenda",
    sourceUrl: "https://example.com/source",
    registrationUrl: "https://example.com/book",
    image: "https://img.openagenda.com/x.jpg",
    ...overrides,
  };
}

describe("EventPublicView", () => {
  it.each([
    "70€ le cycle de 6 semaines (dégressif à partir de 3 ateliers) + adhésion 15€",
    "2 euros par personne — gratuit pour les étudiants. Sans réservation ni inscription préalable.",
    "18 mois à 5 ans.\nGratuit sur réservation.",
  ])("fiche et modale conservent intégralement les conditions : %s", (conditions) => {
    const event = item({ conditions });
    const views = [
      renderToStaticMarkup(createElement(EventPublicView, { item: event, isEnded: false })),
      renderToStaticMarkup(createElement(EventDetailModal, {
        event, surface: "explorer", onClose: () => undefined,
      })),
    ];
    for (const html of views) {
      expect(html).toContain("Informations pratiques");
      expect(html).toContain(conditions);
      expect(html).not.toContain('data-testid="event-price"');
      expect(html.indexOf('data-testid="event-practical"')).toBeLessThan(html.indexOf('data-testid="event-about"'));
    }
  });

  it("ne laisse pas de rubrique pratique vide après expiration d’un badge de disponibilité", () => {
    const html = renderToStaticMarkup(createElement(EventPublicView, {
      item: item({ availabilityBadge: "Complet", availabilityStatus: "sold_out" }),
      isEnded: true,
    }));
    expect(html).not.toContain('data-testid="event-practical"');
    expect(html).not.toContain("Informations pratiques");
    expect(html).not.toContain("Complet");
  });

  it("conserve les conditions d’un événement terminé, sans son ancien badge", () => {
    const html = renderToStaticMarkup(createElement(EventPublicView, {
      item: item({ conditions: "Sur réservation", availabilityBadge: "Complet" }),
      isEnded: true,
    }));
    expect(html).toContain("Informations pratiques");
    expect(html).toContain("Sur réservation");
    expect(html).not.toContain("Complet");
  });

  it.each([
    ["sold_out_online", "Complet en ligne"],
    ["sold_out", "Complet"],
  ] as const)("affiche %s sans proposer de réserver", (availabilityStatus, availabilityBadge) => {
    const html = renderToStaticMarkup(createElement(EventPublicView, {
      item: item({ availabilityStatus, availabilityBadge }), isEnded: false,
    }));
    expect(html).toContain(availabilityBadge);
    expect(html).toContain('data-cta="official"');
    expect(html).toContain("Voir la fiche officielle");
    expect(html).not.toContain('data-cta="booking"');
    expect(html).not.toContain("réserver");
  });

  it("affiche le contenu en texte sans HTML brut", () => {
    const html = renderToStaticMarkup(
      createElement(EventPublicView, { item: item(), isEnded: false }),
    );
    expect(html).toContain("Concert test");
    expect(html).toContain("Soirée live");
    expect(html).not.toContain("<em>");
    expect(html).toContain('data-cta="booking"');
    expect(html).toContain("Source : OpenAgenda");
  });

  it("signale un événement terminé sans CTA réservation", () => {
    const html = renderToStaticMarkup(
      createElement(EventPublicView, { item: item(), isEnded: true }),
    );
    expect(html).toContain("Événement terminé");
    expect(html).toContain("Voir la fiche officielle");
    expect(html).not.toContain("réserver");
    expect(html).toContain('data-cta="official"');
  });
});
