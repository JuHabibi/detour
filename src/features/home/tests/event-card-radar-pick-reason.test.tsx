import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EventItem } from "@/data/types";

vi.mock("next/image", () => ({
  default: function MockImage(props: {
    alt?: string;
    src?: string | { src: string };
  }) {
    const src = typeof props.src === "string" ? props.src : props.src?.src ?? "";
    return createElement("img", { alt: props.alt ?? "", src });
  },
}));

import { StandardEventCard } from "@/features/home/components/EventCard";

function baseEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "evt-radar",
    title: "Duo Zéphyr",
    category: "Musique",
    genre: "Concert",
    venue: "MJC",
    city: "Orléans",
    date: "2026-10-28",
    dateLabel: "Mercredi 28 octobre",
    startAt: "2026-10-28T15:00:00+02:00",
    image: "https://example.com/poster.jpg",
    description:
      "Concerts enregistrés pour la réalisation d’un CD live à la MJC.",
    radarAiReasons: [
      "Concerts enregistrés pour la réalisation d’un CD live.",
    ],
    radarSelectionReasons: ["local-discovery", "headline-appeal"],
    ...overrides,
  };
}

describe("StandardEventCard — Pourquoi le repérer ?", () => {
  it("affiche l’encart sur Radar quand une reason IA informative est étayée", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent(),
        surface: "radar",
        rank: 1,
      }),
    );

    expect(html).toContain("Pourquoi le repérer");
    expect(html).toContain(
      "Concerts enregistrés pour la réalisation d’un CD live.",
    );
    expect(html).toContain('data-testid="radar-pick-reason"');
  });

  it("masque l’encart sur Radar si seules des justifications pauvres existent", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent({
          city: "Saint-Jean-de-Braye",
          description: "Spectacle de saison.",
          radarAiReasons: undefined,
          radarSelectionReasons: ["local-discovery", "booking-available"],
          registrationUrl: "https://example.com/resa",
          conditions: "Gratuit",
        }),
        surface: "radar",
      }),
    );

    expect(html).not.toContain("Pourquoi le repérer");
    expect(html).not.toContain("Programmé à");
    expect(html).not.toContain("Billetterie");
  });

  it("n’affiche jamais l’encart dans Explorer", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent(),
        surface: "explorer",
      }),
    );

    expect(html).not.toContain("Pourquoi le repérer");
  });

  it("reste lisible en largeur mobile Radar (classes compactes)", () => {
    const html = renderToStaticMarkup(
      createElement(StandardEventCard, {
        event: baseEvent(),
        surface: "radar",
      }),
    );

    expect(html).toContain("text-[12px]");
    expect(html).toContain("text-[10px]");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("px-3");
  });
});
