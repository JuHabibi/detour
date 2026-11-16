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

import {
  RadarEventCard,
} from "@/features/home/components/cards/RadarEventCard";
import { ExplorerEventCard } from "@/features/explorer/components/ExplorerEventCard";

function baseEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "openagenda:36101666",
    title: "Saison culturelle : La Fabrique",
    category: "Spectacle",
    genre: "Théâtre",
    venue: "Théâtre des Longues Allées",
    city: "Saint-Jean-de-Braye",
    date: "2026-10-28",
    dateLabel: "Mercredi 28 octobre",
    startAt: "2026-10-28T15:00:00+02:00",
    time: "15h00",
    image: "https://example.com/poster.jpg",
    description:
      "« La Fabrique », de la compagnie Sans soucis. Ce théâtre de papier et musique est à découvrir.",
    sourceUrl: "https://openagenda.example/fabrique",
    ...overrides,
  };
}

describe("RadarEventCard — CTA Radar (indicateur, pas de bouton)", () => {
  it("affiche « Pourquoi le repérer ? » avec une justification", () => {
    const html = renderToStaticMarkup(
      createElement(RadarEventCard, {
        event: baseEvent(),
        rank: 1,
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="radar-card-cta"');
    expect(html).toContain('data-cta="why-pick"');
    expect(html).toContain("Pourquoi le repérer ?");
    expect(html).not.toContain("Découvrir l’événement");
    expect(html).not.toContain("<details");
    expect(html).toContain("h-7");
    expect(html).toContain("h-[2.75rem]");
    expect(html).toContain("lucide-map-pin");
    expect(html).toContain("lucide-calendar-clock");
    expect(html).toContain("underline");
    expect(html).not.toMatch(
      /data-testid="radar-card-cta"[\s\S]*?lucide-move-up-right/,
    );
    expect(html).not.toMatch(/data-testid="radar-card-cta"[\s\S]*?<button/);
    expect(html).toContain("aspect-[4/5]");
  });

  it("affiche « Découvrir l’événement » sans justification", () => {
    const html = renderToStaticMarkup(
      createElement(RadarEventCard, {
        event: baseEvent({
          id: "openagenda:77305621",
          radarAiReasons: undefined,
        }),
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain('data-cta="discover"');
    expect(html).toContain("Découvrir l’événement");
    expect(html).not.toContain("<details");
    expect(html).toContain("h-7");
  });

  it.each(["https://example.com/poster.jpg", undefined])(
    "lie le libellé à une raison publiable, avec ou sans image : %s",
    (image) => {
      const event = baseEvent({
        id: "openagenda:55237041",
        image,
        title: "Une ville de mots",
        description: "Atelier d’écriture en forme de déambulation autour de la ville.",
        conditions: "Tarif dégressif à partir de 3 ateliers.",
      });
      const render = (radarAiReasons: string[]) => renderToStaticMarkup(
        createElement(RadarEventCard, {
          event: { ...event, radarAiReasons },
          onOpenDetail: () => undefined,
        }),
      );

      const pricing = render(["Tarif dégressif à partir de 3 ateliers."]);
      expect(pricing).toContain('data-cta="discover"');
      expect(pricing).not.toContain("Pourquoi le repérer ?");

      const cultural = render([
        "Tarif dégressif à partir de 3 ateliers.",
        "Atelier d’écriture en forme de déambulation autour de la ville.",
      ]);
      expect(cultural).toContain('data-cta="why-pick"');
      expect(cultural).toContain("Pourquoi le repérer ?");
      expect(cultural).not.toContain("<details");

      const unsupported = render(["Concert enregistré pour un album live."]);
      expect(unsupported).toContain('data-cta="discover"');
      expect(unsupported).not.toContain("Pourquoi le repérer ?");
    },
  );

  it("n’affiche pas le CTA Radar dans Explorer", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: baseEvent(),
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).not.toContain('data-testid="radar-card-cta"');
  });
});
