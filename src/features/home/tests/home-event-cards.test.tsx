import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

import { ExplorerEventCard } from "@/features/home/components/cards/ExplorerEventCard";
import {
  EventOpenControl,
  isolateCardAction,
  runHomeFavoriteAction,
} from "@/features/home/components/cards/HomeEventCardInteractions";
import { RadarEventCard } from "@/features/home/components/cards/RadarEventCard";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    title: "Une sortie à Orléans",
    category: "Spectacle",
    genre: "Théâtre",
    venue: "Théâtre d’Orléans",
    city: "Orléans",
    date: "2026-10-12",
    dateLabel: "Lundi 12 octobre",
    time: "20h00",
    startAt: "2026-10-12T20:00:00+02:00",
    image: "https://example.com/poster.jpg",
    ...overrides,
  };
}

describe("cartes home explicites", () => {
  it("conserve la composition Radar et son contrôle d’ouverture clavier", () => {
    const html = renderToStaticMarkup(
      createElement(RadarEventCard, {
        event: event(),
        rank: 1,
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain("aspect-[4/5]");
    expect(html).toContain("01");
    expect(html).toContain('type="button"');
    expect(html).toContain(
      "Voir le détail — « Une sortie à Orléans »",
    );
    expect(html).toContain('data-testid="radar-card-cta"');
  });

  it("conserve Explorer avec image", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: event(),
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain('src="https://example.com/poster.jpg"');
    expect(html).toContain("aspect-[3/4]");
    expect(html).toContain("md:aspect-[16/10]");
    expect(html).not.toContain('data-testid="radar-card-cta"');
  });

  it("conserve Explorer sans image", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: event({ image: undefined }),
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("min-h-[15.5rem]");
    expect(html).toContain("Une sortie à Orléans");
    expect(html).not.toContain('data-testid="radar-card-cta"');
  });
});

describe("interactions des cartes home", () => {
  it("ouvre la fiche avec l’événement, la surface et le déclencheur", () => {
    const onOpenDetail = vi.fn();
    const item = event();
    const trigger = {} as HTMLElement;

    const control = EventOpenControl({
      event: item,
      surface: "radar",
      onOpenDetail,
    });
    expect(control).not.toBeNull();
    if (!control) throw new Error("Le contrôle d’ouverture est requis.");
    control.props.onClick({ currentTarget: trigger });

    expect(onOpenDetail).toHaveBeenCalledWith(item, "radar", trigger);
  });

  it("isole les actions du cœur et des badges du clic de carte", () => {
    const action = vi.fn();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    isolateCardAction({ preventDefault, stopPropagation }, action);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
  });

  it("ajoute un favori vide mais ouvre le classement pour un cœur rempli", () => {
    const item = event();
    const onToggleFavorite = vi.fn();
    const onOrganizeCarnets = vi.fn();

    runHomeFavoriteAction({
      event: item,
      favorited: false,
      onToggleFavorite,
      onOrganizeCarnets,
    });
    expect(onToggleFavorite).toHaveBeenCalledWith(item.id);
    expect(onOrganizeCarnets).not.toHaveBeenCalled();

    onToggleFavorite.mockClear();
    runHomeFavoriteAction({
      event: item,
      favorited: true,
      onToggleFavorite,
      onOrganizeCarnets,
    });
    expect(onToggleFavorite).not.toHaveBeenCalled();
    expect(onOrganizeCarnets).toHaveBeenCalledWith(item);
  });

  it("rend le cœur et le badge carnet comme actions distinctes", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerEventCard, {
        event: event(),
        isFavorite: true,
        onToggleFavorite: () => undefined,
        carnetCount: 2,
        onOrganizeCarnets: () => undefined,
        onOpenDetail: () => undefined,
      }),
    );

    expect(html).toContain("Ranger « Une sortie à Orléans » dans un carnet");
    expect(html).toContain(
      "Dans 2 carnets — modifier le classement de « Une sortie à Orléans »",
    );
  });
});
