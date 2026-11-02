import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EventItem } from "@/data/types";
import { EventPublicView } from "@/features/event-page/components/EventPublicView";

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
